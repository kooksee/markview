import { describe, expect, it } from "vitest";
import {
    buildDocumentMindmapMermaid,
    buildDocumentMindmapTree,
    sanitizeMermaidMindmapText,
} from "./documentMindmap";

describe("documentMindmap utils", () => {
    it("builds hierarchical tree from heading levels", () => {
        const tree = buildDocumentMindmapTree([
            { id: "h1", text: "Overview", level: 1 },
            { id: "h2", text: "Install", level: 2 },
            { id: "h3", text: "CLI", level: 2 },
            { id: "h4", text: "Flags", level: 3 },
        ]);

        expect(tree).toHaveLength(1);
        expect(tree[0].text).toBe("Overview");
        expect(tree[0].children.map((item) => item.text)).toEqual(["Install", "CLI"]);
        expect(tree[0].children[1].children[0].text).toBe("Flags");
    });

    it("converts markdown headings into Mermaid mindmap code", () => {
        const code = buildDocumentMindmapMermaid(
            [
                { id: "h1", text: "Overview", level: 1 },
                { id: "h2", text: "Install", level: 2 },
                { id: "h3", text: "Usage", level: 2 },
            ],
            "README.md",
        );

        expect(code).toContain("mindmap");
        expect(code).toContain("root((README.md))");
        expect(code).toContain("    Overview");
        expect(code).toContain("      Install");
        expect(code).toContain("      Usage");
    });

    it("sanitizes unsupported characters for Mermaid mindmap labels", () => {
        const text = sanitizeMermaidMindmapText('Title (A) [x] {y}\n"quoted"');
        expect(text).toBe("Title A x y 'quoted'");
    });
});
