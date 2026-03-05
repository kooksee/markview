package cmd

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestResolvePatterns_NoGlobChars(t *testing.T) {
	_, err := resolvePatterns([]string{"README.md"})
	if err == nil {
		t.Fatal("resolvePatterns should return error for pattern without glob chars")
	}
}

func TestResolvePatterns_Valid(t *testing.T) {
	patterns, err := resolvePatterns([]string{"**/*.md", "docs/*.md"})
	if err != nil {
		t.Fatalf("resolvePatterns returned error: %v", err)
	}
	if len(patterns) != 2 {
		t.Fatalf("got %d patterns, want 2", len(patterns))
	}
	for _, p := range patterns {
		if !filepath.IsAbs(p) {
			t.Errorf("pattern %q is not absolute", p)
		}
	}
}

func TestRun_WatchWithArgs(t *testing.T) {
	t.Run("with glob pattern", func(t *testing.T) {
		watchPatterns = []string{"**/*.md"}
		defer func() { watchPatterns = nil }()

		err := run(rootCmd, []string{"README.md"})
		if err == nil {
			t.Fatal("run should return error when --watch and args are both specified")
		}
		want := "cannot use --watch (-w) with file arguments"
		if err.Error() != want {
			t.Fatalf("got error %q, want %q", err.Error(), want)
		}
	})

	t.Run("without glob chars hints shell expansion", func(t *testing.T) {
		watchPatterns = []string{"README.md"}
		defer func() { watchPatterns = nil }()

		err := run(rootCmd, []string{"CHANGELOG.md"})
		if err == nil {
			t.Fatal("run should return error when --watch and args are both specified")
		}
		if !strings.Contains(err.Error(), "shell may have expanded") {
			t.Fatalf("error should hint shell expansion, got %q", err.Error())
		}
	})
}
