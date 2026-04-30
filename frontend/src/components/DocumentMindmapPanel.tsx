import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import type { NotebookHeadingLike } from "../utils/notebookOutline";
import { buildDocumentMindmapMermaid } from "../utils/documentMindmap";
import { ZoomPanView } from "./ZoomPanView";

interface DocumentMindmapPanelProps {
    headings: NotebookHeadingLike[];
    fileName?: string;
    onNavigateHeading?: (headingId: string) => void;
}

function getMermaidTheme(): "dark" | "default" {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default";
}

export function DocumentMindmapPanel({
    headings,
    fileName,
    onNavigateHeading,
}: DocumentMindmapPanelProps) {
    const [svg, setSvg] = useState("");
    const [isRendering, setIsRendering] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [themeVersion, setThemeVersion] = useState(0);
    const svgContainerRef = useRef<HTMLDivElement>(null);
    const mermaidCode = useMemo(
        () => buildDocumentMindmapMermaid(headings, fileName || "当前文档"),
        [headings, fileName],
    );

    useEffect(() => {
        const observer = new MutationObserver(() => setThemeVersion((value) => value + 1));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (headings.length === 0) {
            setSvg("");
            setRenderError(null);
            setIsRendering(false);
            return;
        }

        let cancelled = false;
        setIsRendering(true);
        setRenderError(null);

        const hiddenContainer = document.createElement("div");
        hiddenContainer.style.position = "absolute";
        hiddenContainer.style.left = "-9999px";
        hiddenContainer.style.top = "-9999px";
        hiddenContainer.style.width = "1200px";
        document.body.appendChild(hiddenContainer);

        mermaid.initialize({ startOnLoad: false, theme: getMermaidTheme() });
        const id = `document-mindmap-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        mermaid
            .render(id, mermaidCode, hiddenContainer)
            .then(({ svg: rendered }) => {
                if (!cancelled) {
                    setSvg(rendered);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setSvg("");
                    setRenderError(err instanceof Error ? err.message : "思维导图渲染失败");
                }
            })
            .finally(() => {
                hiddenContainer.remove();
                if (!cancelled) {
                    setIsRendering(false);
                }
            });

        return () => {
            cancelled = true;
            hiddenContainer.remove();
        };
    }, [headings, mermaidCode, themeVersion]);

    useEffect(() => {
        if (!svgContainerRef.current) return;
        svgContainerRef.current.innerHTML = svg;
    }, [svg]);

    if (headings.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-gh-text-secondary">
                当前文档暂无可解析标题
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="mb-2 text-xs text-gh-text-secondary">
                Markdown 标题已自动转换为思维导图（滚轮缩放、拖拽平移）
            </div>
            {renderError && (
                <div className="mb-2 rounded-md border border-gh-border bg-gh-bg px-2 py-1 text-xs text-gh-text-secondary">
                    思维导图渲染失败：{renderError}
                </div>
            )}
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-gh-border bg-gh-bg">
                {svg.length > 0 ? (
                    <ZoomPanView className="h-full w-full" defaultZoom={1}>
                        <div
                            ref={svgContainerRef}
                            className="inline-block p-4 [&_svg]:h-auto [&_svg]:max-w-none"
                        />
                    </ZoomPanView>
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gh-text-secondary">
                        {isRendering ? "正在生成思维导图..." : "暂无可渲染的思维导图"}
                    </div>
                )}
            </div>
            <div className="mt-2 shrink-0">
                <div className="mb-1 text-xs text-gh-text-secondary">标题导航</div>
                <div className="max-h-28 overflow-y-auto pr-1">
                    <div className="flex flex-wrap gap-1">
                        {headings.map((heading) => (
                            <button
                                key={heading.id}
                                type="button"
                                className="rounded-md border border-gh-border bg-gh-bg px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                                onClick={() => onNavigateHeading?.(heading.id)}
                                title={`定位到 ${heading.text}`}
                            >
                                H{heading.level} {heading.text}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
