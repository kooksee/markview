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

export type NotebookMoveDirection = "up" | "down";
export type NotebookSelectionInput = Set<string> | string[];

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

function getSubtreeEnd(items: NotebookOutlineItem[], index: number): number {
    if (index < 0 || index >= items.length) return index;
    const baseLevel = items[index].level;
    let end = index + 1;
    while (end < items.length && items[end].level > baseLevel) {
        end += 1;
    }
    return end;
}

export function hasNotebookChildren(items: NotebookOutlineItem[], index: number): boolean {
    if (index < 0 || index >= items.length - 1) return false;
    const baseLevel = items[index].level;
    for (let i = index + 1; i < items.length; i += 1) {
        if (items[i].level <= baseLevel) return false;
        return true;
    }
    return false;
}

export function getHiddenNotebookIndices(
    items: NotebookOutlineItem[],
    collapsedIds: Set<string>,
): Set<number> {
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

        if (collapsedIds.has(current.id) && hasNotebookChildren(items, i)) {
            collapseLevels.push(current.level);
        }
    }

    return hidden;
}

export function moveNotebookItem(
    items: NotebookOutlineItem[],
    index: number,
    direction: NotebookMoveDirection,
): { items: NotebookOutlineItem[]; focusIndex: number } {
    if (index < 0 || index >= items.length) {
        return { items, focusIndex: Math.max(0, Math.min(items.length - 1, index)) };
    }

    const currentLevel = items[index].level;
    const currentEnd = getSubtreeEnd(items, index);
    const currentBlock = items.slice(index, currentEnd);

    if (direction === "up") {
        let prevStart = -1;
        for (let i = index - 1; i >= 0; i -= 1) {
            if (items[i].level < currentLevel) break;
            if (items[i].level === currentLevel) {
                prevStart = i;
                break;
            }
        }

        if (prevStart === -1) return { items, focusIndex: index };

        const prevEnd = getSubtreeEnd(items, prevStart);
        const prevBlock = items.slice(prevStart, prevEnd);
        const between = items.slice(prevEnd, index);

        return {
            items: [
                ...items.slice(0, prevStart),
                ...currentBlock,
                ...between,
                ...prevBlock,
                ...items.slice(currentEnd),
            ],
            focusIndex: prevStart,
        };
    }

    let nextStart = -1;
    for (let i = currentEnd; i < items.length; i += 1) {
        if (items[i].level < currentLevel) break;
        if (items[i].level === currentLevel) {
            nextStart = i;
            break;
        }
    }

    if (nextStart === -1) return { items, focusIndex: index };

    const nextEnd = getSubtreeEnd(items, nextStart);
    const nextBlock = items.slice(nextStart, nextEnd);
    const middle = items.slice(currentEnd, nextStart);

    const nextItems = [
        ...items.slice(0, index),
        ...middle,
        ...nextBlock,
        ...currentBlock,
        ...items.slice(nextEnd),
    ];

    return {
        items: nextItems,
        focusIndex: nextEnd - currentBlock.length,
    };
}

function normalizeSelectionIds(selected: NotebookSelectionInput): Set<string> {
    if (selected instanceof Set) return new Set(selected);
    return new Set(selected.filter((id) => typeof id === "string" && id.length > 0));
}

export function indentNotebookItemsByIds(
    items: NotebookOutlineItem[],
    selected: NotebookSelectionInput,
): NotebookOutlineItem[] {
    const selectedIds = normalizeSelectionIds(selected);
    if (selectedIds.size === 0) return items;

    let next = items;
    for (let i = 0; i < next.length; i += 1) {
        if (selectedIds.has(next[i].id)) {
            next = indentNotebookItem(next, i);
        }
    }
    return next;
}

export function outdentNotebookItemsByIds(
    items: NotebookOutlineItem[],
    selected: NotebookSelectionInput,
): NotebookOutlineItem[] {
    const selectedIds = normalizeSelectionIds(selected);
    if (selectedIds.size === 0) return items;

    let next = items;
    for (let i = 0; i < next.length; i += 1) {
        if (selectedIds.has(next[i].id)) {
            next = outdentNotebookItem(next, i);
        }
    }
    return next;
}

export function removeNotebookItemsByIds(
    items: NotebookOutlineItem[],
    selected: NotebookSelectionInput,
): { items: NotebookOutlineItem[]; focusIndex: number } {
    const selectedIds = normalizeSelectionIds(selected);
    if (selectedIds.size === 0) {
        return {
            items,
            focusIndex: Math.max(0, Math.min(items.length - 1, 0)),
        };
    }

    const toRemove = new Set<string>();
    let firstRemovedIndex = -1;

    for (let i = 0; i < items.length; i += 1) {
        const current = items[i];
        if (!selectedIds.has(current.id)) continue;

        if (firstRemovedIndex === -1) {
            firstRemovedIndex = i;
        }

        const end = getSubtreeEnd(items, i);
        for (let j = i; j < end; j += 1) {
            toRemove.add(items[j].id);
        }
        i = end - 1;
    }

    if (toRemove.size === 0) {
        return {
            items,
            focusIndex: Math.max(0, Math.min(items.length - 1, 0)),
        };
    }

    const nextItems = items.filter((item) => !toRemove.has(item.id));
    if (nextItems.length === 0) {
        return { items: [createNotebookOutlineItem()], focusIndex: 0 };
    }

    const focusIndex = Math.max(0, Math.min(nextItems.length - 1, firstRemovedIndex - 1));
    return { items: nextItems, focusIndex };
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
