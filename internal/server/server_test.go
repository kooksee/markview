package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func newTestState(t *testing.T) *State {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	s := &State{
		groups:      make(map[string]*Group),
		nextID:      1,
		subscribers: make(map[chan sseEvent]struct{}),
		restartCh:   make(chan string, 1),
		shutdownCh:  make(chan struct{}, 1),
		watchedDirs: make(map[string]int),
	}
	_ = ctx
	return s
}

func TestReorderFiles(t *testing.T) {
	t.Run("reorders files successfully", func(t *testing.T) {
		s := newTestState(t)
		s.groups[DefaultGroup] = &Group{
			Name: DefaultGroup,
			Files: []*FileEntry{
				{ID: 1, Name: "a.md", Path: "/a.md"},
				{ID: 2, Name: "b.md", Path: "/b.md"},
				{ID: 3, Name: "c.md", Path: "/c.md"},
			},
		}

		ok := s.ReorderFiles(DefaultGroup, []int{3, 1, 2})
		if !ok {
			t.Fatal("ReorderFiles returned false, want true")
		}

		files := s.groups[DefaultGroup].Files
		if files[0].ID != 3 || files[1].ID != 1 || files[2].ID != 2 {
			t.Errorf("got order [%d, %d, %d], want [3, 1, 2]", files[0].ID, files[1].ID, files[2].ID)
		}
	})

	t.Run("returns false for unknown group", func(t *testing.T) {
		s := newTestState(t)
		ok := s.ReorderFiles("nonexistent", []int{1})
		if ok {
			t.Fatal("ReorderFiles returned true for unknown group")
		}
	})

	t.Run("returns false for mismatched count", func(t *testing.T) {
		s := newTestState(t)
		s.groups[DefaultGroup] = &Group{
			Name: DefaultGroup,
			Files: []*FileEntry{
				{ID: 1, Name: "a.md", Path: "/a.md"},
				{ID: 2, Name: "b.md", Path: "/b.md"},
			},
		}

		ok := s.ReorderFiles(DefaultGroup, []int{1})
		if ok {
			t.Fatal("ReorderFiles returned true for mismatched count")
		}
	})

	t.Run("returns false for unknown file ID", func(t *testing.T) {
		s := newTestState(t)
		s.groups[DefaultGroup] = &Group{
			Name: DefaultGroup,
			Files: []*FileEntry{
				{ID: 1, Name: "a.md", Path: "/a.md"},
				{ID: 2, Name: "b.md", Path: "/b.md"},
			},
		}

		ok := s.ReorderFiles(DefaultGroup, []int{1, 99})
		if ok {
			t.Fatal("ReorderFiles returned true for unknown file ID")
		}
	})
}

func TestMoveFile(t *testing.T) {
	t.Run("moves file to existing group", func(t *testing.T) {
		s := newTestState(t)
		s.groups["src"] = &Group{
			Name:  "src",
			Files: []*FileEntry{{ID: 1, Name: "a.md", Path: "/a.md"}, {ID: 2, Name: "b.md", Path: "/b.md"}},
		}
		s.groups["dst"] = &Group{
			Name:  "dst",
			Files: []*FileEntry{{ID: 3, Name: "c.md", Path: "/c.md"}},
		}

		if err := s.MoveFile(1, "dst"); err != nil {
			t.Fatalf("MoveFile returned error: %v", err)
		}

		if len(s.groups["src"].Files) != 1 || s.groups["src"].Files[0].ID != 2 {
			t.Error("source group should have only file 2")
		}
		if len(s.groups["dst"].Files) != 2 || s.groups["dst"].Files[1].ID != 1 {
			t.Error("target group should have file 1 appended")
		}
	})

	t.Run("auto-creates target group", func(t *testing.T) {
		s := newTestState(t)
		s.groups["src"] = &Group{
			Name:  "src",
			Files: []*FileEntry{{ID: 1, Name: "a.md", Path: "/a.md"}, {ID: 2, Name: "b.md", Path: "/b.md"}},
		}

		if err := s.MoveFile(1, "newgroup"); err != nil {
			t.Fatalf("MoveFile returned error: %v", err)
		}

		if _, ok := s.groups["newgroup"]; !ok {
			t.Fatal("target group should have been created")
		}
		if s.groups["newgroup"].Files[0].ID != 1 {
			t.Error("target group should contain file 1")
		}
	})

	t.Run("deletes empty source group", func(t *testing.T) {
		s := newTestState(t)
		s.groups["src"] = &Group{
			Name:  "src",
			Files: []*FileEntry{{ID: 1, Name: "a.md", Path: "/a.md"}},
		}
		s.groups["dst"] = &Group{
			Name:  "dst",
			Files: []*FileEntry{{ID: 2, Name: "b.md", Path: "/b.md"}},
		}

		if err := s.MoveFile(1, "dst"); err != nil {
			t.Fatalf("MoveFile returned error: %v", err)
		}

		if _, ok := s.groups["src"]; ok {
			t.Error("empty source group should have been deleted")
		}
	})

	t.Run("returns error for duplicate path", func(t *testing.T) {
		s := newTestState(t)
		s.groups["src"] = &Group{
			Name:  "src",
			Files: []*FileEntry{{ID: 1, Name: "a.md", Path: "/a.md"}},
		}
		s.groups["dst"] = &Group{
			Name:  "dst",
			Files: []*FileEntry{{ID: 2, Name: "a.md", Path: "/a.md"}},
		}

		err := s.MoveFile(1, "dst")
		if err == nil {
			t.Fatal("MoveFile should return error for duplicate path")
		}
	})

	t.Run("returns error for same group", func(t *testing.T) {
		s := newTestState(t)
		s.groups["src"] = &Group{
			Name:  "src",
			Files: []*FileEntry{{ID: 1, Name: "a.md", Path: "/a.md"}},
		}

		err := s.MoveFile(1, "src")
		if err == nil {
			t.Fatal("MoveFile should return error for same group")
		}
	})

	t.Run("returns error for unknown file", func(t *testing.T) {
		s := newTestState(t)
		err := s.MoveFile(999, "dst")
		if err == nil {
			t.Fatal("MoveFile should return error for unknown file")
		}
	})
}

func TestHandleMoveFile(t *testing.T) {
	t.Run("moves file via HTTP", func(t *testing.T) {
		s := newTestState(t)
		s.groups["src"] = &Group{
			Name:  "src",
			Files: []*FileEntry{{ID: 1, Name: "a.md", Path: "/a.md"}},
		}
		s.groups["dst"] = &Group{
			Name:  "dst",
			Files: []*FileEntry{{ID: 2, Name: "b.md", Path: "/b.md"}},
		}

		handler := NewHandler(s)
		body, err := json.Marshal(moveFileRequest{Group: "dst"})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest("PUT", "/_/api/files/1/group", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("got status %d, want %d", rec.Code, http.StatusNoContent)
		}
		if len(s.groups["dst"].Files) != 2 {
			t.Error("target group should have 2 files")
		}
	})

	t.Run("returns 409 for duplicate path", func(t *testing.T) {
		s := newTestState(t)
		s.groups["src"] = &Group{
			Name:  "src",
			Files: []*FileEntry{{ID: 1, Name: "a.md", Path: "/a.md"}},
		}
		s.groups["dst"] = &Group{
			Name:  "dst",
			Files: []*FileEntry{{ID: 2, Name: "a.md", Path: "/a.md"}},
		}

		handler := NewHandler(s)
		body, err := json.Marshal(moveFileRequest{Group: "dst"})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest("PUT", "/_/api/files/1/group", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusConflict {
			t.Fatalf("got status %d, want %d", rec.Code, http.StatusConflict)
		}
	})
}

func TestHandleShutdown(t *testing.T) {
	t.Run("returns 202 and signals shutdownCh", func(t *testing.T) {
		s := newTestState(t)
		handler := NewHandler(s)
		req := httptest.NewRequest("POST", "/_/api/shutdown", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusAccepted {
			t.Fatalf("got status %d, want %d", rec.Code, http.StatusAccepted)
		}

		select {
		case <-s.ShutdownCh():
		default:
			t.Fatal("shutdownCh should have received a signal")
		}
	})

	t.Run("does not block on duplicate signal", func(t *testing.T) {
		s := newTestState(t)
		handler := NewHandler(s)

		for i := 0; i < 2; i++ {
			req := httptest.NewRequest("POST", "/_/api/shutdown", nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusAccepted {
				t.Fatalf("call %d: got status %d, want %d", i+1, rec.Code, http.StatusAccepted)
			}
		}
	})
}

func TestHandleReorderFiles(t *testing.T) {
	t.Run("reorders files via HTTP", func(t *testing.T) {
		s := newTestState(t)
		s.groups["docs"] = &Group{
			Name: "docs",
			Files: []*FileEntry{
				{ID: 1, Name: "a.md", Path: "/a.md"},
				{ID: 2, Name: "b.md", Path: "/b.md"},
			},
		}

		handler := NewHandler(s)
		body, err := json.Marshal(reorderFilesRequest{Group: "docs", FileIDs: []int{2, 1}})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest("PUT", "/_/api/reorder", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("got status %d, want %d", rec.Code, http.StatusNoContent)
		}

		files := s.groups["docs"].Files
		if files[0].ID != 2 || files[1].ID != 1 {
			t.Errorf("got order [%d, %d], want [2, 1]", files[0].ID, files[1].ID)
		}
	})

	t.Run("reorders files in group with slashes", func(t *testing.T) {
		s := newTestState(t)
		s.groups["api/docs"] = &Group{
			Name: "api/docs",
			Files: []*FileEntry{
				{ID: 1, Name: "a.md", Path: "/a.md"},
				{ID: 2, Name: "b.md", Path: "/b.md"},
			},
		}

		handler := NewHandler(s)
		body, err := json.Marshal(reorderFilesRequest{Group: "api/docs", FileIDs: []int{2, 1}})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest("PUT", "/_/api/reorder", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("got status %d, want %d", rec.Code, http.StatusNoContent)
		}

		files := s.groups["api/docs"].Files
		if files[0].ID != 2 || files[1].ID != 1 {
			t.Errorf("got order [%d, %d], want [2, 1]", files[0].ID, files[1].ID)
		}
	})

	t.Run("returns 400 for invalid group", func(t *testing.T) {
		s := newTestState(t)
		handler := NewHandler(s)
		body, err := json.Marshal(reorderFilesRequest{Group: "nonexistent", FileIDs: []int{1}})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest("PUT", "/_/api/reorder", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("got status %d, want %d", rec.Code, http.StatusBadRequest)
		}
	})

	t.Run("returns 400 for invalid JSON", func(t *testing.T) {
		s := newTestState(t)
		s.groups[DefaultGroup] = &Group{Name: DefaultGroup, Files: []*FileEntry{}}
		handler := NewHandler(s)
		req := httptest.NewRequest("PUT", "/_/api/reorder", bytes.NewReader([]byte("invalid")))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("got status %d, want %d", rec.Code, http.StatusBadRequest)
		}
	})
}

func TestAddPattern_InitialExpansion(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.md"), []byte("# A"), 0o600) //nolint:errcheck
	os.WriteFile(filepath.Join(dir, "b.md"), []byte("# B"), 0o600) //nolint:errcheck
	os.WriteFile(filepath.Join(dir, "c.txt"), []byte("text"), 0o600) //nolint:errcheck

	s := newTestState(t)
	pattern := filepath.Join(dir, "*.md")
	matched, err := s.AddPattern(pattern, DefaultGroup)
	if err != nil {
		t.Fatalf("AddPattern returned error: %v", err)
	}
	if matched != 2 {
		t.Fatalf("got matched=%d, want 2", matched)
	}

	groups := s.Groups()
	if len(groups) != 1 {
		t.Fatalf("got %d groups, want 1", len(groups))
	}
	if len(groups[0].Files) != 2 {
		t.Fatalf("got %d files, want 2", len(groups[0].Files))
	}
}

func TestAddPattern_Duplicate(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.md"), []byte("# A"), 0o600) //nolint:errcheck

	s := newTestState(t)
	pattern := filepath.Join(dir, "*.md")
	_, err := s.AddPattern(pattern, DefaultGroup)
	if err != nil {
		t.Fatalf("AddPattern returned error: %v", err)
	}

	matched, err := s.AddPattern(pattern, DefaultGroup)
	if err != nil {
		t.Fatalf("duplicate AddPattern returned error: %v", err)
	}
	if matched != 0 {
		t.Fatalf("duplicate AddPattern returned matched=%d, want 0", matched)
	}

	patterns := s.Patterns()
	if len(patterns) != 1 {
		t.Fatalf("got %d patterns, want 1", len(patterns))
	}
}

func TestAddPattern_InvalidBaseDir(t *testing.T) {
	s := newTestState(t)
	_, err := s.AddPattern("/nonexistent/dir/*.md", DefaultGroup)
	if err == nil {
		t.Fatal("AddPattern should return error for nonexistent base dir")
	}
}

func TestExportState_WithPatterns(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.md"), []byte("# A"), 0o600) //nolint:errcheck

	s := newTestState(t)
	pattern := filepath.Join(dir, "*.md")
	_, err := s.AddPattern(pattern, DefaultGroup)
	if err != nil {
		t.Fatalf("AddPattern returned error: %v", err)
	}

	restoreFile, err := s.ExportState()
	if err != nil {
		t.Fatalf("ExportState returned error: %v", err)
	}
	defer os.Remove(restoreFile)

	data, err := os.ReadFile(restoreFile)
	if err != nil {
		t.Fatalf("failed to read restore file: %v", err)
	}

	var rd RestoreData
	if err := json.Unmarshal(data, &rd); err != nil {
		t.Fatalf("failed to unmarshal restore data: %v", err)
	}

	if len(rd.Patterns) == 0 {
		t.Fatal("RestoreData.Patterns should not be empty")
	}
	pats, ok := rd.Patterns[DefaultGroup]
	if !ok || len(pats) != 1 || pats[0] != pattern {
		t.Fatalf("got patterns=%v, want [%s]", pats, pattern)
	}
}

func TestHandleAddPattern(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.md"), []byte("# A"), 0o600) //nolint:errcheck

	s := newTestState(t)
	handler := NewHandler(s)

	pattern := filepath.Join(dir, "*.md")
	body, err := json.Marshal(addPatternRequest{Pattern: pattern, Group: DefaultGroup})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/_/api/patterns", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got status %d, want %d: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var resp addPatternResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Matched != 1 {
		t.Fatalf("got matched=%d, want 1", resp.Matched)
	}
}
