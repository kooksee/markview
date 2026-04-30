import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NotebookHeadingLike, NotebookOutlineItem } from "../utils/notebookOutline";
import {
    createNotebookOutlineItem,
    getHiddenNotebookIndices,
    hasNotebookChildren,
    indentNotebookItemsByIds,
    importHeadingsAsNotebookItems,
    indentNotebookItem,
    insertNotebookItemAfter,
    moveNotebookItem,
    outdentNotebookItemsByIds,
    outdentNotebookItem,
    removeNotebookItemAt,
    removeNotebookItemsByIds,
    sanitizeNotebookItems,
    updateNotebookItemText,
} from "../utils/notebookOutline";

const STORAGE_PREFIX = "markview-notebook-outline:";
const COLLAPSED_STORAGE_PREFIX = "markview-notebook-outline-collapsed:";

interface OutlineNotebookPanelProps {
    groupName: string;
    headings: NotebookHeadingLike[];
    onNavigateHeading?: (headingId: string) => void;
}

export function OutlineNotebookPanel({
    groupName,
    headings,
    onNavigateHeading,
}: OutlineNotebookPanelProps) {
    const storageKey = useMemo(() => `${STORAGE_PREFIX}${groupName}`, [groupName]);
    const collapsedStorageKey = useMemo(() => `${COLLAPSED_STORAGE_PREFIX}${groupName}`, [groupName]);
    const [items, setItems] = useState<NotebookOutlineItem[]>(() => [createNotebookOutlineItem()]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [focusIndex, setFocusIndex] = useState<number | null>(null);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

    const hiddenIndices = useMemo(
        () => getHiddenNotebookIndices(items, collapsedIds),
        [items, collapsedIds],
    );

    const visibleItems = useMemo(
        () => items.filter((_, index) => !hiddenIndices.has(index)),
        [items, hiddenIndices],
    );

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                setItems([createNotebookOutlineItem()]);
                setActiveIndex(0);
                setSelectedIds(new Set());
            } else {
                const parsed = JSON.parse(raw);
                const restored = sanitizeNotebookItems(parsed);
                setItems(restored);
                setActiveIndex(0);
                setSelectedIds(new Set());
            }
        } catch {
            setItems([createNotebookOutlineItem()]);
            setActiveIndex(0);
            setSelectedIds(new Set());
        }
    }, [storageKey]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(collapsedStorageKey);
            if (!raw) {
                setCollapsedIds(new Set());
                return;
            }
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const ids = parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
                setCollapsedIds(new Set(ids));
                return;
            }
        } catch {
            // ignore
        }
        setCollapsedIds(new Set());
    }, [collapsedStorageKey]);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(items));
    }, [items, storageKey]);

    useEffect(() => {
        localStorage.setItem(collapsedStorageKey, JSON.stringify([...collapsedIds]));
    }, [collapsedIds, collapsedStorageKey]);

    useEffect(() => {
        setSelectedIds((prev) => {
            if (prev.size === 0) return prev;
            const existing = new Set(items.map((item) => item.id));
            const next = new Set([...prev].filter((id) => existing.has(id)));
            if (next.size === prev.size) return prev;
            return next;
        });
    }, [items]);

    useEffect(() => {
        if (focusIndex == null) return;
        const target = inputRefs.current[focusIndex];
        if (!target) return;
        target.focus();
        const length = target.value.length;
        target.setSelectionRange(length, length);
        setFocusIndex(null);
    }, [focusIndex, items]);

    const moveFocus = useCallback((index: number) => {
        if (index < 0 || index >= items.length) return;
        setActiveIndex(index);
        setFocusIndex(index);
    }, [items.length]);

    const handleAddItem = useCallback(() => {
        setItems((prev) => {
            const inserted = insertNotebookItemAfter(prev, activeIndex);
            setActiveIndex(inserted.focusIndex);
            setFocusIndex(inserted.focusIndex);
            return inserted.items;
        });
    }, [activeIndex]);

    const handleImportHeadings = useCallback(() => {
        const imported = importHeadingsAsNotebookItems(headings);
        if (imported.length === 0) {
            setItems([createNotebookOutlineItem()]);
            setActiveIndex(0);
            setFocusIndex(0);
            setSelectedIds(new Set());
            setCollapsedIds(new Set());
            return;
        }
        setItems(imported);
        setCollapsedIds(new Set());
        setSelectedIds(new Set());
        setActiveIndex(0);
        setFocusIndex(0);
    }, [headings]);

    const handleClear = useCallback(() => {
        setItems([createNotebookOutlineItem()]);
        setCollapsedIds(new Set());
        setSelectedIds(new Set());
        setActiveIndex(0);
        setFocusIndex(0);
    }, []);

    const handleToggleCollapse = useCallback((id: string) => {
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleExpandAll = useCallback(() => {
        setCollapsedIds(new Set());
    }, []);

    const handleToggleSelectItem = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleSelectAllVisible = useCallback(() => {
        setSelectedIds(new Set(visibleItems.map((item) => item.id)));
    }, [visibleItems]);

    const handleClearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const handleBatchIndent = useCallback(() => {
        if (selectedIds.size === 0) return;
        setItems((prev) => indentNotebookItemsByIds(prev, selectedIds));
    }, [selectedIds]);

    const handleBatchOutdent = useCallback(() => {
        if (selectedIds.size === 0) return;
        setItems((prev) => outdentNotebookItemsByIds(prev, selectedIds));
    }, [selectedIds]);

    const handleBatchRemove = useCallback(() => {
        if (selectedIds.size === 0) return;
        setItems((prev) => {
            const removed = removeNotebookItemsByIds(prev, selectedIds);
            setActiveIndex(removed.focusIndex);
            setFocusIndex(removed.focusIndex);
            return removed.items;
        });
        setSelectedIds(new Set());
    }, [selectedIds]);

    const handleKeyDown = useCallback((index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.altKey && event.key === "ArrowUp") {
            event.preventDefault();
            setItems((prev) => {
                const moved = moveNotebookItem(prev, index, "up");
                setActiveIndex(moved.focusIndex);
                setFocusIndex(moved.focusIndex);
                return moved.items;
            });
            return;
        }

        if (event.altKey && event.key === "ArrowDown") {
            event.preventDefault();
            setItems((prev) => {
                const moved = moveNotebookItem(prev, index, "down");
                setActiveIndex(moved.focusIndex);
                setFocusIndex(moved.focusIndex);
                return moved.items;
            });
            return;
        }

        if (event.key === "Tab") {
            event.preventDefault();
            setItems((prev) => (event.shiftKey ? outdentNotebookItem(prev, index) : indentNotebookItem(prev, index)));
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            setItems((prev) => {
                const inserted = insertNotebookItemAfter(prev, index);
                setActiveIndex(inserted.focusIndex);
                setFocusIndex(inserted.focusIndex);
                return inserted.items;
            });
            return;
        }

        if (event.key === "Backspace" && items[index]?.text === "" && items.length > 1) {
            event.preventDefault();
            setItems((prev) => {
                const removed = removeNotebookItemAt(prev, index);
                setActiveIndex(removed.focusIndex);
                setFocusIndex(removed.focusIndex);
                return removed.items;
            });
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            moveFocus(index - 1);
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            moveFocus(index + 1);
        }
    }, [items, moveFocus]);

    return (
        <div className="flex h-full flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                    onClick={handleAddItem}
                >
                    新增条目
                </button>
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                    onClick={handleImportHeadings}
                >
                    导入当前文档标题
                </button>
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                    onClick={handleClear}
                >
                    清空
                </button>
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleExpandAll}
                    disabled={collapsedIds.size === 0}
                >
                    全部展开
                </button>
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSelectAllVisible}
                    disabled={visibleItems.length === 0}
                >
                    全选可见
                </button>
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleClearSelection}
                    disabled={selectedIds.size === 0}
                >
                    清空选择
                </button>
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleBatchIndent}
                    disabled={selectedIds.size === 0}
                >
                    批量缩进
                </button>
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleBatchOutdent}
                    disabled={selectedIds.size === 0}
                >
                    批量反缩进
                </button>
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleBatchRemove}
                    disabled={selectedIds.size === 0}
                >
                    批量删除
                </button>
                <span className="text-xs text-gh-text-secondary">已选 {selectedIds.size} 项</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {items.map((item, index) => {
                    if (hiddenIndices.has(index)) return null;

                    const hasChildren = hasNotebookChildren(items, index);
                    const isCollapsed = collapsedIds.has(item.id);

                    return (
                        <div
                            key={item.id}
                            className={`mb-1 flex items-center gap-2 rounded ${selectedIds.has(item.id) ? "bg-gh-bg-hover/60" : ""}`}
                            style={{ paddingLeft: `${item.level * 16}px` }}
                        >
                            <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-gh-text-secondary"
                                checked={selectedIds.has(item.id)}
                                onChange={() => handleToggleSelectItem(item.id)}
                                aria-label="选择条目"
                            />
                            <button
                                type="button"
                                className={`inline-flex h-4 w-4 items-center justify-center rounded text-gh-text-secondary ${hasChildren ? "hover:bg-gh-bg-hover" : "opacity-40"}`}
                                onClick={() => {
                                    if (hasChildren) {
                                        handleToggleCollapse(item.id);
                                    }
                                }}
                                aria-label={isCollapsed ? "展开子项" : "折叠子项"}
                                title={hasChildren ? (isCollapsed ? "展开子项" : "折叠子项") : "无子项"}
                            >
                                {hasChildren ? (
                                    <svg
                                        className={`size-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M6 4l8 6-8 6V4z" />
                                    </svg>
                                ) : (
                                    <span className="text-[10px]">•</span>
                                )}
                            </button>
                            <input
                                ref={(el) => {
                                    inputRefs.current[index] = el;
                                }}
                                className="flex-1 rounded-md border border-gh-border bg-gh-bg px-2 py-1 text-sm text-gh-text-primary outline-none focus:border-gh-text-secondary"
                                value={item.text}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setItems((prev) => updateNotebookItemText(prev, index, value));
                                }}
                                onFocus={() => setActiveIndex(index)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                placeholder="输入条目，Enter 新建，Tab 缩进"
                            />
                            <button
                                type="button"
                                className="rounded-md border border-gh-border bg-transparent px-1.5 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                                onClick={() => {
                                    setItems((prev) => {
                                        const moved = moveNotebookItem(prev, index, "up");
                                        setActiveIndex(moved.focusIndex);
                                        setFocusIndex(moved.focusIndex);
                                        return moved.items;
                                    });
                                }}
                                title="上移（含子项）"
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                className="rounded-md border border-gh-border bg-transparent px-1.5 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                                onClick={() => {
                                    setItems((prev) => {
                                        const moved = moveNotebookItem(prev, index, "down");
                                        setActiveIndex(moved.focusIndex);
                                        setFocusIndex(moved.focusIndex);
                                        return moved.items;
                                    });
                                }}
                                title="下移（含子项）"
                            >
                                ↓
                            </button>
                            {item.headingId && (
                                <button
                                    type="button"
                                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                                    onClick={() => onNavigateHeading?.(item.headingId!)}
                                    title="定位到右侧标题"
                                >
                                    定位
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="pt-2 text-xs text-gh-text-secondary">
                快捷键：Enter 新建、Tab/Shift+Tab 调整层级、↑/↓ 切换、Alt+↑/↓ 上下移动、空条目 Backspace 删除；支持多选批量缩进/删除
            </div>
        </div>
    );
}
