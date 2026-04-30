import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MindmapToggle } from "./MindmapToggle";

describe("MindmapToggle", () => {
    it("shows 'Show mindmap' title when closed", () => {
        render(<MindmapToggle isMindmapOpen={false} onToggle={() => { }} />);
        expect(screen.getByTitle("Show mindmap")).toBeInTheDocument();
    });

    it("shows 'Hide mindmap' title when open", () => {
        render(<MindmapToggle isMindmapOpen={true} onToggle={() => { }} />);
        expect(screen.getByTitle("Hide mindmap")).toBeInTheDocument();
    });

    it("has correct aria attributes", () => {
        render(<MindmapToggle isMindmapOpen={true} onToggle={() => { }} />);
        const button = screen.getByRole("button", { name: "Mindmap" });
        expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("calls onToggle when clicked", async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();
        render(<MindmapToggle isMindmapOpen={false} onToggle={onToggle} />);

        await user.click(screen.getByRole("button", { name: "Mindmap" }));
        expect(onToggle).toHaveBeenCalledOnce();
    });
});
