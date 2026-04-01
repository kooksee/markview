import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PlantUmlBlock } from "./MarkdownViewer";

describe("PlantUmlBlock", () => {
    const createObjectURL = vi.fn(() => "blob:plantuml-diagram");
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(URL, "createObjectURL", {
            value: createObjectURL,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            value: revokeObjectURL,
            writable: true,
            configurable: true,
        });
    });

    it("renders svg when PlantUML conversion succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue('<svg viewBox="0 0 100 60"><text>ok</text></svg>'),
            }),
        );

        render(
            <PlantUmlBlock
                code={[
                    "@startuml",
                    "Alice -> Bob: Hello",
                    "@enduml",
                ].join("\n")}
            />,
        );

        await waitFor(() => {
            const img = screen.getByRole("img", { name: "PlantUML diagram" }) as HTMLImageElement;
            expect(img).toBeTruthy();
            expect(img.src).toContain("blob:plantuml-diagram");
            expect(createObjectURL).toHaveBeenCalledTimes(1);
            expect(screen.getByTitle("Copy code")).toBeInTheDocument();
        });
    });

    it("falls back to preformatted code when PlantUML conversion fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: vi.fn().mockResolvedValue("render error"),
            }),
        );

        render(<PlantUmlBlock code="@startuml\nA -> B\n@enduml" />);

        await waitFor(() => {
            expect(screen.getByText(/@startuml/)).toBeInTheDocument();
            expect(screen.getByText(/@enduml/)).toBeInTheDocument();
            expect(screen.queryByRole("img", { name: "PlantUML diagram" })).not.toBeInTheDocument();
            expect(screen.getByTitle("Copy code")).toBeInTheDocument();
        });
    });

    it("calls requestFullscreen on fullscreen button click", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue('<svg viewBox="0 0 100 60"><text>ok</text></svg>'),
            }),
        );

        const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
        const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
            value: requestFullscreenMock,
            configurable: true,
            writable: true,
        });

        render(<PlantUmlBlock code="@startuml\nA -> B\n@enduml" />);

        await waitFor(() => {
            expect(screen.getByRole("img", { name: "PlantUML diagram" })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle("Fullscreen"));

        await waitFor(() => {
            expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
        });

        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
            value: originalRequestFullscreen,
            configurable: true,
            writable: true,
        });
    });
});
