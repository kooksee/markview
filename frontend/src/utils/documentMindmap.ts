import type { NotebookHeadingLike } from "./notebookOutline";

export interface DocumentMindmapNode {
    id: string;
    text: string;
    level: number;
    children: DocumentMindmapNode[];
}

function clampHeadingLevel(level: number): number {
    return Math.max(1, Math.min(6, Math.floor(level)));
}

export function sanitizeMermaidMindmapText(input: string): string {
    const cleaned = input
        .replace(/[\n\r\t]+/g, " ")
        .replace(/[()\[\]{}]/g, " ")
        .replace(/"/g, "'")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned.length > 0 ? cleaned : "未命名标题";
}

export function buildDocumentMindmapTree(headings: NotebookHeadingLike[]): DocumentMindmapNode[] {
    const roots: DocumentMindmapNode[] = [];
    const stack: DocumentMindmapNode[] = [];

    for (const heading of headings) {
        const level = clampHeadingLevel(heading.level);
        const node: DocumentMindmapNode = {
            id: heading.id,
            text: sanitizeMermaidMindmapText(heading.text),
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

function appendMindmapNodeLines(lines: string[], node: DocumentMindmapNode, indent: number): void {
    lines.push(`${" ".repeat(indent)}${node.text}`);
    for (const child of node.children) {
        appendMindmapNodeLines(lines, child, indent + 2);
    }
}

export function buildDocumentMindmapMermaid(
    headings: NotebookHeadingLike[],
    rootTitle = "当前文档",
): string {
    const root = sanitizeMermaidMindmapText(rootTitle);
    const trees = buildDocumentMindmapTree(headings);
    const lines = ["mindmap", `  root((${root}))`];

    for (const node of trees) {
        appendMindmapNodeLines(lines, node, 4);
    }

    return lines.join("\n");
}
