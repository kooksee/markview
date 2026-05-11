import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownViewer } from "./MarkdownViewer";
import { fetchFileContent, openRelativeFile } from "../hooks/useApi";

vi.mock("../hooks/useApi", () => ({
    fetchFileContent: vi.fn(),
    openRelativeFile: vi.fn(),
}));

vi.mock("./TocToggle", () => ({
    TocToggle: () => null,
}));

vi.mock("./RawToggle", () => ({
    RawToggle: () => null,
}));

vi.mock("./CopyButton", () => ({
    CopyButton: () => null,
}));

vi.mock("./PdfExportButton", () => ({
    PdfExportButton: () => null,
}));

vi.mock("./RemoveButton", () => ({
    RemoveButton: () => null,
}));

vi.mock("./BacklinksPanel", () => ({
    BacklinksPanel: () => null,
}));

describe("MarkdownViewer slides mode", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchFileContent).mockResolvedValue({
            content: `# 封面\n\n第一页内容\n\n---\n\n# 第二页\n\n第二页内容`,
            baseDir: "/tmp",
        });
        vi.mocked(openRelativeFile).mockResolvedValue({
            id: "file-2",
            name: "ok.md",
            path: "/tmp/ok.md",
        });
    });

    it("enters slides mode and flips pages by button", async () => {
        const user = userEvent.setup();

        render(
            <MarkdownViewer
                fileId="file-1"
                fileName="README.md"
                revision={0}
                onFileOpened={() => { }}
                onHeadingsChange={() => { }}
                isTocOpen={false}
                onTocToggle={() => { }}
                onRemoveFile={() => { }}
                isWide={false}
            />,
        );

        await screen.findByText("第一页内容");

        await user.click(screen.getByRole("button", { name: "Slides" }));

        await waitFor(() => {
            expect(screen.getByText(/PPT 模式/)).toBeInTheDocument();
            expect(screen.getByText("第一页内容")).toBeInTheDocument();
            expect(screen.queryByText("第二页内容")).not.toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: "下一页" }));

        await waitFor(() => {
            expect(screen.getByText("第二页内容")).toBeInTheDocument();
            expect(screen.queryByText("第一页内容")).not.toBeInTheDocument();
        });
    });

    it("supports keyboard navigation in slides mode", async () => {
        const user = userEvent.setup();

        render(
            <MarkdownViewer
                fileId="file-1"
                fileName="README.md"
                revision={0}
                onFileOpened={() => { }}
                onHeadingsChange={() => { }}
                isTocOpen={false}
                onTocToggle={() => { }}
                onRemoveFile={() => { }}
                isWide={false}
            />,
        );

        await screen.findByText("第一页内容");
        await user.click(screen.getByRole("button", { name: "Slides" }));

        fireEvent.keyDown(window, { key: "ArrowRight" });
        await waitFor(() => {
            expect(screen.getByText("第二页内容")).toBeInTheDocument();
        });

        fireEvent.keyDown(window, { key: "ArrowLeft" });
        await waitFor(() => {
            expect(screen.getByText("第一页内容")).toBeInTheDocument();
        });
    });
});
