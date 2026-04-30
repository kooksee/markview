export interface NotebookOutlineItem {
    id: string;
    text: string;
    level: number;
    headingId?: string;
}

export interface NotebookHeadingLike {
    id: string;
    text: string;
    level: number;
}

const MAX_LEVEL = 6;

function clampLevel(level: number): number {
    if (!Number.isFinite(level)) return 0;
    return Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)));
}

function createId(): string {
    return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createNotebookOutlineItem(
    partial: Partial<NotebookOutlineItem> = {},
): NotebookOutlineItem {
    return {
        id: partial.id ?? createId(),
        text: partial.text ?? "",
        level: clampLevel(partial.level ?? 0),
        ...(partial.headingId ? { headingId: partial.headingId } : {}),
    };
}

export function sanitizeNotebookItems(input: unknown): NotebookOutlineItem[] {
    if (!Array.isArray(input)) {
        return [createNotebookOutlineItem()];
    }

    const items = input
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const candidate = item as Partial<NotebookOutlineItem>;
            return createNotebookOutlineItem({
                id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : undefined,
                text: typeof candidate.text === "string" ? candidate.text : "",
                level: typeof candidate.level === "number" ? candidate.level : 0,
                headingId: typeof candidate.headingId === "string" && candidate.headingId.length > 0
                    ? candidate.headingId
                    : undefined,
            });
        })
        .filter((item): item is NotebookOutlineItem => item != null);

    return items.length > 0 ? items : [createNotebookOutlineItem()];
}

export function importHeadingsAsNotebookItems(
    headings: NotebookHeadingLike[],
): NotebookOutlineItem[] {
    return headings.map((heading) =>
        createNotebookOutlineItem({
            text: heading.text,
            level: clampLevel(heading.level - 1),
            headingId: heading.id,
        }),
    );
}

export function updateNotebookItemText(
    items: NotebookOutlineItem[],
    index: number,
    text: string,
): NotebookOutlineItem[] {
    if (index < 0 || index >= items.length) return items;
    const next = [...items];
    next[index] = { ...next[index], text };
    return next;
}

export function insertNotebookItemAfter(
    items: NotebookOutlineItem[],
    index: number,
): { items: NotebookOutlineItem[]; focusIndex: number } {
    if (items.length === 0) {
        return { items: [createNotebookOutlineItem()], focusIndex: 0 };
    }

    const safeIndex = Math.max(-1, Math.min(index, items.length - 1));
    const baseLevel = safeIndex >= 0 ? items[safeIndex].level : 0;
    const nextItem = createNotebookOutlineItem({ level: baseLevel });
    const insertPos = safeIndex + 1;

    return {
        items: [...items.slice(0, insertPos), nextItem, ...items.slice(insertPos)],
        focusIndex: insertPos,
    };
}

export function indentNotebookItem(
    items: NotebookOutlineItem[],
    index: number,
): NotebookOutlineItem[] {
    if (index <= 0 || index >= items.length) return items;
    const next = [...items];
    const target = next[index];
    const limit = Math.min(MAX_LEVEL, next[index - 1].level + 1);
    const level = Math.min(limit, target.level + 1);
    if (level === target.level) return items;
    next[index] = { ...target, level };
    return next;
}

export function outdentNotebookItem(
    items: NotebookOutlineItem[],
    index: number,
): NotebookOutlineItem[] {
    if (index < 0 || index >= items.length) return items;
    const next = [...items];
    const target = next[index];
    const level = Math.max(0, target.level - 1);
    if (level === target.level) return items;
    next[index] = { ...target, level };
    return next;
}

export function removeNotebookItemAt(
    items: NotebookOutlineItem[],
    index: number,
): { items: NotebookOutlineItem[]; focusIndex: number } {
    if (index < 0 || index >= items.length) {
        return { items, focusIndex: Math.max(0, Math.min(items.length - 1, index)) };
    }

    const next = [...items.slice(0, index), ...items.slice(index + 1)];
    if (next.length === 0) {
        return { items: [createNotebookOutlineItem()], focusIndex: 0 };
    }

    return { items: next, focusIndex: Math.max(0, index - 1) };
}
