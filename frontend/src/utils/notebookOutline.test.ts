import { describe, expect, it } from "vitest";
import {
    createNotebookOutlineItem,
    getHiddenNotebookIndices,
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
} from "./notebookOutline";

describe("notebookOutline utils", () => {
    it("imports headings with mapped outline levels", () => {
        const imported = importHeadingsAsNotebookItems([
            { id: "h1", text: "Title", level: 1 },
            { id: "h2", text: "Section", level: 2 },
            { id: "h4", text: "Deep", level: 4 },
        ]);

        expect(imported).toHaveLength(3);
        expect(imported[0].level).toBe(0);
        expect(imported[1].level).toBe(1);
        expect(imported[2].level).toBe(3);
        expect(imported[2].headingId).toBe("h4");
    });

    it("inserts sibling item after current index", () => {
        const base = [
            createNotebookOutlineItem({ id: "a", text: "A", level: 0 }),
            createNotebookOutlineItem({ id: "b", text: "B", level: 1 }),
        ];

        const inserted = insertNotebookItemAfter(base, 1);
        expect(inserted.items).toHaveLength(3);
        expect(inserted.focusIndex).toBe(2);
        expect(inserted.items[2].level).toBe(1);
    });

    it("supports indent and outdent with boundaries", () => {
        const base = [
            createNotebookOutlineItem({ id: "a", text: "A", level: 0 }),
            createNotebookOutlineItem({ id: "b", text: "B", level: 0 }),
        ];

        const indented = indentNotebookItem(base, 1);
        expect(indented[1].level).toBe(1);

        const outdented = outdentNotebookItem(indented, 1);
        expect(outdented[1].level).toBe(0);
    });

    it("removes item and keeps at least one empty item", () => {
        const single = [createNotebookOutlineItem({ id: "only", text: "", level: 0 })];
        const removedSingle = removeNotebookItemAt(single, 0);
        expect(removedSingle.items).toHaveLength(1);
        expect(removedSingle.focusIndex).toBe(0);

        const multi = [
            createNotebookOutlineItem({ id: "a", text: "A", level: 0 }),
            createNotebookOutlineItem({ id: "b", text: "B", level: 1 }),
        ];
        const removedMulti = removeNotebookItemAt(multi, 1);
        expect(removedMulti.items).toHaveLength(1);
        expect(removedMulti.items[0].id).toBe("a");
        expect(removedMulti.focusIndex).toBe(0);
    });

    it("updates item text and sanitizes malformed storage payload", () => {
        const base = [
            createNotebookOutlineItem({ id: "a", text: "A", level: 0 }),
            createNotebookOutlineItem({ id: "b", text: "B", level: 1 }),
        ];
        const updated = updateNotebookItemText(base, 1, "B2");
        expect(updated[1].text).toBe("B2");

        const sanitized = sanitizeNotebookItems([{ id: 1, text: 2, level: -4 }, null, "x"]);
        expect(sanitized).toHaveLength(1);
        expect(sanitized[0].level).toBe(0);
        expect(sanitized[0].text).toBe("");
    });

    it("moves an item with its subtree up and down among siblings", () => {
        const base = [
            createNotebookOutlineItem({ id: "a", text: "A", level: 0 }),
            createNotebookOutlineItem({ id: "a1", text: "A.1", level: 1 }),
            createNotebookOutlineItem({ id: "b", text: "B", level: 0 }),
            createNotebookOutlineItem({ id: "c", text: "C", level: 0 }),
        ];

        const movedUp = moveNotebookItem(base, 2, "up");
        expect(movedUp.focusIndex).toBe(0);
        expect(movedUp.items.map((item) => item.id)).toEqual(["b", "a", "a1", "c"]);

        const movedDown = moveNotebookItem(base, 2, "down");
        expect(movedDown.focusIndex).toBe(3);
        expect(movedDown.items.map((item) => item.id)).toEqual(["a", "a1", "c", "b"]);
    });

    it("computes hidden descendants from collapsed parent items", () => {
        const base = [
            createNotebookOutlineItem({ id: "a", text: "A", level: 0 }),
            createNotebookOutlineItem({ id: "a1", text: "A.1", level: 1 }),
            createNotebookOutlineItem({ id: "a2", text: "A.2", level: 1 }),
            createNotebookOutlineItem({ id: "b", text: "B", level: 0 }),
        ];

        const hidden = getHiddenNotebookIndices(base, new Set(["a"]));
        expect([...hidden]).toEqual([1, 2]);

        const noneHidden = getHiddenNotebookIndices(base, new Set(["a1"]));
        expect([...noneHidden]).toEqual([]);
    });

    it("supports batch indent and outdent by selected ids", () => {
        const base = [
            createNotebookOutlineItem({ id: "a", text: "A", level: 0 }),
            createNotebookOutlineItem({ id: "b", text: "B", level: 0 }),
            createNotebookOutlineItem({ id: "c", text: "C", level: 0 }),
        ];

        const indented = indentNotebookItemsByIds(base, new Set(["b", "c"]));
        expect(indented.map((item) => item.level)).toEqual([0, 1, 1]);

        const outdented = outdentNotebookItemsByIds(indented, ["b", "c"]);
        expect(outdented.map((item) => item.level)).toEqual([0, 0, 0]);
    });

    it("batch remove deletes selected parent subtree and keeps valid focus", () => {
        const base = [
            createNotebookOutlineItem({ id: "a", text: "A", level: 0 }),
            createNotebookOutlineItem({ id: "a1", text: "A.1", level: 1 }),
            createNotebookOutlineItem({ id: "b", text: "B", level: 0 }),
            createNotebookOutlineItem({ id: "c", text: "C", level: 0 }),
        ];

        const removed = removeNotebookItemsByIds(base, new Set(["a", "c"]));
        expect(removed.items.map((item) => item.id)).toEqual(["b"]);
        expect(removed.focusIndex).toBe(0);
    });
});
