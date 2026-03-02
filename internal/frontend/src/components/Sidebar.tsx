import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FileEntry, Group } from "../hooks/useApi";
import { removeFile, moveFile } from "../hooks/useApi";
import { buildFileUrl } from "../utils/groups";

const MENU_ITEM_CLASS =
  "w-full px-3 py-1.5 text-left text-sm bg-transparent border-none cursor-pointer text-gh-text-secondary hover:bg-gh-bg-hover hover:text-gh-text transition-colors duration-150 flex items-center gap-2";

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 260;
const STORAGE_KEY = "mo-sidebar-width";

function getInitialWidth(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  }
  return DEFAULT_WIDTH;
}

interface SortableFileItemProps {
  file: FileEntry;
  isActive: boolean;
  menuOpenId: number | null;
  otherGroups: Group[];
  onFileSelect: (id: number) => void;
  onMenuToggle: (id: number) => void;
  onOpenInNewTab: (id: number) => void;
  onMoveToGroup: (id: number, group: string) => void;
  onRemove: (id: number) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

function SortableFileItem({
  file,
  isActive,
  menuOpenId,
  otherGroups,
  onFileSelect,
  onMenuToggle,
  onOpenInNewTab,
  onMoveToGroup,
  onRemove,
  menuRef,
}: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/file" {...attributes} {...listeners}>
      <button
        className={`flex items-center gap-2 w-full px-3 py-2 border-none cursor-pointer text-left text-sm transition-colors duration-150 ${
          isActive
            ? "bg-gh-bg-active text-gh-text font-semibold"
            : "bg-transparent text-gh-text-secondary hover:bg-gh-bg-hover"
        }`}
        onClick={() => onFileSelect(file.id)}
        title={file.path}
      >
        <svg className="size-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z" />
        </svg>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-6">
          {file.name}
        </span>
      </button>
      <button
        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/file:opacity-100 flex items-center justify-center bg-transparent border-none cursor-pointer text-gh-text-secondary hover:text-gh-text rounded p-0.5 transition-opacity duration-150"
        onClick={(e) => {
          e.stopPropagation();
          onMenuToggle(file.id);
        }}
        title="More actions"
      >
        <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        </svg>
      </button>
      {menuOpenId === file.id && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-10 bg-gh-bg border border-gh-border rounded-md shadow-lg py-1 min-w-[160px]"
        >
          <button
            className={MENU_ITEM_CLASS}
            onClick={() => onOpenInNewTab(file.id)}
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z" />
            </svg>
            Open in new tab
          </button>
          {otherGroups.length > 0 && (
            <>
              <div className="border-t border-gh-border my-1" />
              <div className="px-3 py-1.5 text-sm text-gh-text-secondary flex items-center gap-2">
                <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.25 2a.75.75 0 0 1 0 1.5H3.75a.25.25 0 0 0-.25.25v8.5a.25.25 0 0 0 .25.25h8.5a.75.75 0 0 0 0 1.5H3.75A1.75 1.75 0 0 1 2 12.25V3.75A1.75 1.75 0 0 1 3.75 2Z" />
                  <path d="M12 5l3.5 3-3.5 3ZM8.75 7.25a.75.75 0 0 0 0 1.5H12.5V7.25H8.75Z" />
                </svg>
                Move to...
              </div>
              {otherGroups.map((g) => (
                <button
                  key={g.name}
                  className={`${MENU_ITEM_CLASS} !pl-9`}
                  onClick={() => onMoveToGroup(file.id, g.name)}
                >
                  <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
                    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
                    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
                    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
                  </svg>
                  {g.name === "default" ? "(default)" : g.name}
                </button>
              ))}
            </>
          )}
          <div className="border-t border-gh-border my-1" />
          <button
            className={MENU_ITEM_CLASS}
            onClick={() => onRemove(file.id)}
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
            </svg>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  groups: Group[];
  activeGroup: string;
  activeFileId: number | null;
  onFileSelect: (id: number) => void;
  onFilesReorder: (groupName: string, fileIds: number[]) => void;
}

export function Sidebar({
  groups,
  activeGroup,
  activeFileId,
  onFileSelect,
  onFilesReorder,
}: SidebarProps) {
  const currentGroup = groups.find((g) => g.name === activeGroup);
  const files = currentGroup?.files ?? [];
  const [width, setWidth] = useState(getInitialWidth);
  const resizeDragging = useRef(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = files.findIndex((f) => f.id === active.id);
      const newIndex = files.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(files, oldIndex, newIndex);
      onFilesReorder(activeGroup, reordered.map((f) => f.id));
    },
    [files, activeGroup, onFilesReorder],
  );

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeDragging.current) return;
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(clamped);
    };
    const onMouseUp = () => {
      if (!resizeDragging.current) return;
      resizeDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  // Close menu on outside click
  useEffect(() => {
    if (menuOpenId == null) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenId]);

  const handleOpenInNewTab = useCallback(
    (id: number) => {
      setMenuOpenId(null);
      window.open(buildFileUrl(activeGroup, id), "_blank");
    },
    [activeGroup],
  );

  const otherGroups = useMemo(() => {
    return [...groups]
      .filter((g) => g.name !== activeGroup)
      .sort((a, b) => {
        if (a.name === "default") return 1;
        if (b.name === "default") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [groups, activeGroup]);

  const handleMoveToGroup = useCallback(
    async (id: number, group: string) => {
      setMenuOpenId(null);
      try {
        await moveFile(id, group);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed to move file");
      }
    },
    [],
  );

  const handleRemove = useCallback((id: number) => {
    setMenuOpenId(null);
    removeFile(id);
  }, []);

  const handleMenuToggle = useCallback((id: number) => {
    setMenuOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <aside
      className="relative bg-gh-bg-sidebar border-r border-gh-border flex flex-col overflow-y-auto shrink-0"
      style={{ width }}
    >
      <nav className="flex flex-col pb-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={files.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {files.map((f) => (
              <SortableFileItem
                key={f.id}
                file={f}
                isActive={f.id === activeFileId}
                menuOpenId={menuOpenId}
                otherGroups={otherGroups}
                onFileSelect={onFileSelect}
                onMenuToggle={handleMenuToggle}
                onOpenInNewTab={handleOpenInNewTab}
                onMoveToGroup={handleMoveToGroup}
                onRemove={handleRemove}
                menuRef={menuRef}
              />
            ))}
          </SortableContext>
        </DndContext>
      </nav>
      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gh-border active:bg-gh-border transition-colors"
        onMouseDown={onMouseDown}
      />
    </aside>
  );
}
