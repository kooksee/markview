import { useMemo } from "react";
import type { NotebookHeadingLike } from "../utils/notebookOutline";

interface MindmapNode {
    id: string;
    text: string;
    level: number;
    children: MindmapNode[];
}

interface DocumentMindmapPanelProps {
    headings: NotebookHeadingLike[];
    onNavigateHeading?: (headingId: string) => void;
}

function buildMindmapTree(headings: NotebookHeadingLike[]): MindmapNode[] {
    const roots: MindmapNode[] = [];
    const stack: MindmapNode[] = [];

    for (const heading of headings) {
        const level = Math.max(1, Math.min(6, heading.level));
        const node: MindmapNode = {
            id: heading.id,
            text: heading.text,
            level,
            children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        if (stack.length === 0) {
            roots.push(node);
        } else {
            stack[stack.length - 1].children.push(node);
        }

        stack.push(node);
    }

    return roots;
}

function MindmapTree({
    nodes,
    onNavigateHeading,
}: {
    nodes: MindmapNode[];
    onNavigateHeading?: (headingId: string) => void;
}) {
    if (nodes.length === 0) return null;

    return (
        <ul className="space-y-1 pl-3">
            {nodes.map((node) => (
                <li key={node.id}>
                    <button
                        type="button"
                        className="w-full rounded-md border border-gh-border bg-gh-bg px-2 py-1 text-left text-sm text-gh-text-primary hover:bg-gh-bg-hover"
                        onClick={() => onNavigateHeading?.(node.id)}
                        title={`定位到 ${node.text}`}
                    >
                        <span className="mr-2 text-[10px] text-gh-text-secondary">H{node.level}</span>
                        <span>{node.text}</span>
                    </button>
                    {node.children.length > 0 && (
                        <div className="mt-1 border-l border-gh-border/70">
                            <MindmapTree nodes={node.children} onNavigateHeading={onNavigateHeading} />
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
}

export function DocumentMindmapPanel({ headings, onNavigateHeading }: DocumentMindmapPanelProps) {
    const trees = useMemo(() => buildMindmapTree(headings), [headings]);

    if (trees.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-gh-text-secondary">
                当前文档暂无可解析标题
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="mb-2 text-xs text-gh-text-secondary">
                当前文档思维导图（基于标题解析）
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <MindmapTree nodes={trees} onNavigateHeading={onNavigateHeading} />
            </div>
        </div>
    );
}
