import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NotebookHeadingLike, NotebookOutlineItem } from "../utils/notebookOutline";
import {
    createNotebookOutlineItem,
    importHeadingsAsNotebookItems,
    indentNotebookItem,
    insertNotebookItemAfter,
    outdentNotebookItem,
    removeNotebookItemAt,
    sanitizeNotebookItems,
    updateNotebookItemText,
} from "../utils/notebookOutline";

const STORAGE_PREFIX = "markview-notebook-outline:";

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
    const [items, setItems] = useState<NotebookOutlineItem[]>(() => [createNotebookOutlineItem()]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [focusIndex, setFocusIndex] = useState<number | null>(null);
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                setItems([createNotebookOutlineItem()]);
                setActiveIndex(0);
                return;
            }
            const parsed = JSON.parse(raw);
            const restored = sanitizeNotebookItems(parsed);
            setItems(restored);
            setActiveIndex(0);
        } catch {
            setItems([createNotebookOutlineItem()]);
            setActiveIndex(0);
        }
    }, [storageKey]);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(items));
    }, [items, storageKey]);

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
            return;
        }
        setItems(imported);
        setActiveIndex(0);
        setFocusIndex(0);
    }, [headings]);

    const handleClear = useCallback(() => {
        setItems([createNotebookOutlineItem()]);
        setActiveIndex(0);
        setFocusIndex(0);
    }, []);

    const handleKeyDown = useCallback((index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
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
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className="mb-1 flex items-center gap-2"
                        style={{ paddingLeft: `${item.level * 16}px` }}
                    >
                        <span className="w-3 text-xs text-gh-text-secondary select-none">{item.level === 0 ? "•" : "◦"}</span>
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
                ))}
            </div>

            <div className="pt-2 text-xs text-gh-text-secondary">
                快捷键：Enter 新建、Tab/Shift+Tab 调整层级、↑/↓ 切换、空条目 Backspace 删除
            </div>
        </div>
    );
}
