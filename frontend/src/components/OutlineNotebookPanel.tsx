import { useMemo, useState } from "react";
import type { NotebookHeadingLike } from "../utils/notebookOutline";

interface OutlineNotebookPanelProps {
    groupName: string;
    headings: NotebookHeadingLike[];
    onNavigateHeading?: (headingId: string) => void;
}

interface ParsedHeadingItem {
    id: string;
    text: string;
    level: number;
}

function hasChildren(items: ParsedHeadingItem[], index: number): boolean {
    if (index < 0 || index >= items.length - 1) return false;
    const baseLevel = items[index].level;
    for (let i = index + 1; i < items.length; i += 1) {
        if (items[i].level <= baseLevel) return false;
        return true;
    }
    return false;
}

function getHiddenIndices(items: ParsedHeadingItem[], collapsedIds: Set<string>): Set<number> {
    const hidden = new Set<number>();
    const collapseLevels: number[] = [];

    for (let i = 0; i < items.length; i += 1) {
        const current = items[i];

        while (collapseLevels.length > 0 && current.level <= collapseLevels[collapseLevels.length - 1]) {
            collapseLevels.pop();
        }

        if (collapseLevels.length > 0) {
            hidden.add(i);
        }

        if (collapsedIds.has(current.id) && hasChildren(items, i)) {
            collapseLevels.push(current.level);
        }
    }

    return hidden;
}

export function OutlineNotebookPanel({
    headings,
    onNavigateHeading,
}: OutlineNotebookPanelProps) {
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

    const items = useMemo<ParsedHeadingItem[]>(() => {
        return headings.map((heading) => ({
            id: heading.id,
            text: heading.text,
            level: Math.max(1, Math.min(6, heading.level)),
        }));
    }, [headings]);

    const hiddenIndices = useMemo(() => getHiddenIndices(items, collapsedIds), [items, collapsedIds]);

    const handleToggleCollapse = (id: string) => {
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        setCollapsedIds(new Set());
    };

    return (
        <div className="flex h-full flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleExpandAll}
                    disabled={collapsedIds.size === 0}
                >
                    全部展开
                </button>
                <span className="text-xs text-gh-text-secondary">当前文档解析到 {items.length} 个标题</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {items.length === 0 && (
                    <div className="rounded-md border border-gh-border bg-gh-bg px-3 py-2 text-sm text-gh-text-secondary">
                        当前文档暂无标题，请先在右侧文档中使用 `#`/`##` 等标题语法。
                    </div>
                )}
                {items.map((item, index) => {
                    if (hiddenIndices.has(index)) return null;

                    const hasChild = hasChildren(items, index);
                    const isCollapsed = collapsedIds.has(item.id);

                    return (
                        <div
                            key={item.id}
                            className="mb-1 flex items-center gap-2 rounded"
                            style={{ paddingLeft: `${(item.level - 1) * 16}px` }}
                        >
                            <button
                                type="button"
                                className={`inline-flex h-4 w-4 items-center justify-center rounded text-gh-text-secondary ${hasChild ? "hover:bg-gh-bg-hover" : "opacity-40"}`}
                                onClick={() => {
                                    if (hasChild) {
                                        handleToggleCollapse(item.id);
                                    }
                                }}
                                aria-label={isCollapsed ? "展开子项" : "折叠子项"}
                                title={hasChild ? (isCollapsed ? "展开子项" : "折叠子项") : "无子项"}
                            >
                                {hasChild ? (
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
                            <button
                                type="button"
                                className="flex-1 rounded-md border border-gh-border bg-gh-bg px-2 py-1 text-left text-sm text-gh-text-primary hover:bg-gh-bg-hover"
                                onClick={() => onNavigateHeading?.(item.id)}
                                title={`定位到 ${item.text}`}
                            >
                                <span className="mr-2 text-[10px] text-gh-text-secondary">H{item.level}</span>
                                <span>{item.text}</span>
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="pt-2 text-xs text-gh-text-secondary">
                大纲笔记已切换为当前文档标题解析视图（点击任一标题可定位到右侧内容）。
            </div>
        </div>
    );
}
