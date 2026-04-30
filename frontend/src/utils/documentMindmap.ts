import type { NotebookHeadingLike } from "./notebookOutline";

export interface DocumentMindmapNode {
    id: string;
    text: string;
    level: number;
    children: DocumentMindmapNode[];
}

export interface DocumentMindmapGraphNode {
    id: string;
    data: {
        value: string;
        level: number;
        branchIndex: number;
        headingId?: string;
        isRoot?: boolean;
    };
    children?: DocumentMindmapGraphNode[];
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

function mapGraphChildren(
    nodes: DocumentMindmapNode[],
    branchIndex: number,
): DocumentMindmapGraphNode[] {
    return nodes.map((node) => ({
        id: node.id,
        data: {
            value: node.text,
            level: node.level,
            branchIndex,
            headingId: node.id,
        },
        ...(node.children.length > 0
            ? { children: mapGraphChildren(node.children, branchIndex) }
            : {}),
    }));
}

export function buildDocumentMindmapGraphTree(
    headings: NotebookHeadingLike[],
    rootTitle = "当前文档",
): DocumentMindmapGraphNode {
    const trees = buildDocumentMindmapTree(headings);

    let rootLabel = sanitizeMermaidMindmapText(rootTitle);
    let topLevel = trees;

    // If the document has a single H1 wrapping all sections,
    // use that H1 as root and promote its children as main branches.
    if (trees.length === 1 && trees[0].level === 1 && trees[0].children.length > 0) {
        rootLabel = trees[0].text;
        topLevel = trees[0].children;
    }

    const children = topLevel.flatMap((node, index) => mapGraphChildren([node], index));

    return {
        id: "document-root",
        data: {
            value: rootLabel,
            level: 0,
            branchIndex: -1,
            isRoot: true,
        },
        ...(children.length > 0 ? { children } : {}),
    };
}
