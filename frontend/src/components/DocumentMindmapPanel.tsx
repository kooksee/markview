import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Graph, idOf, treeToGraphData } from "@antv/g6";
import type { NotebookHeadingLike } from "../utils/notebookOutline";
import {
    buildDocumentMindmapGraphTree,
    type DocumentMindmapGraphNode,
} from "../utils/documentMindmap";

interface DocumentMindmapPanelProps {
    headings: NotebookHeadingLike[];
    fileName?: string;
    onNavigateHeading?: (headingId: string) => void;
}

const DIRECTION_STORAGE_KEY = "markview-document-mindmap-direction";

const BRANCH_PALETTE = [
    { stroke: "#5B8FF9", fillLight: "#EEF4FF", fillDark: "#1B2B4D" },
    { stroke: "#5AD8A6", fillLight: "#ECFFF7", fillDark: "#173B33" },
    { stroke: "#F6BD16", fillLight: "#FFF8E8", fillDark: "#493B14" },
    { stroke: "#945FB9", fillLight: "#F6EEFF", fillDark: "#332043" },
    { stroke: "#E8684A", fillLight: "#FFF1ED", fillDark: "#4B241C" },
    { stroke: "#6DC8EC", fillLight: "#EBFAFF", fillDark: "#193745" },
];

function getNodeWidth(text: string, isRoot: boolean): number {
    const width = text.length * 9 + (isRoot ? 48 : 30);
    return Math.max(isRoot ? 120 : 80, Math.min(width, isRoot ? 340 : 280));
}

function getBranchColor(branchIndex: number) {
    const palette = BRANCH_PALETTE[Math.abs(branchIndex) % BRANCH_PALETTE.length];
    return palette ?? BRANCH_PALETTE[0];
}

export function DocumentMindmapPanel({
    headings,
    fileName,
    onNavigateHeading,
}: DocumentMindmapPanelProps) {
    const [depthMode, setDepthMode] = useState<"summary" | "full">("summary");
    const [layoutDirection, setLayoutDirection] = useState<"H" | "V">(() => {
        try {
            const raw = localStorage.getItem(DIRECTION_STORAGE_KEY);
            return raw === "V" ? "V" : "H";
        } catch {
            return "H";
        }
    });
    const [themeVersion, setThemeVersion] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<InstanceType<typeof Graph> | null>(null);
    const graphTree = useMemo(
        () => buildDocumentMindmapGraphTree(headings, fileName || "当前文档"),
        [headings, fileName],
    );
    const visibleTree = useMemo(() => {
        if (depthMode === "full") return graphTree;

        const cloneNode = (node: DocumentMindmapGraphNode): DocumentMindmapGraphNode => {
            const level = node.data.level ?? 0;
            if (!node.children || node.children.length === 0) {
                return { ...node };
            }
            if (level >= 2) {
                return { ...node, children: undefined };
            }
            return {
                ...node,
                children: node.children.map(cloneNode),
            };
        };

        return cloneNode(graphTree);
    }, [depthMode, graphTree]);
    const graphData = useMemo(() => {
        return treeToGraphData(visibleTree, {
            getNodeData: (datum, depth) => {
                const node = datum as DocumentMindmapGraphNode;
                const base = {
                    id: node.id,
                    data: node.data,
                    value: node.data.value,
                    depth,
                };
                return node.children
                    ? { ...base, children: node.children.map((item) => item.id) }
                    : base;
            },
            getChildren: (datum) => (datum as DocumentMindmapGraphNode).children ?? [],
        });
    }, [visibleTree]);

    useEffect(() => {
        const observer = new MutationObserver(() => setThemeVersion((value) => value + 1));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!containerRef.current || headings.length === 0) {
            return;
        }

        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        let graph: InstanceType<typeof Graph> | null = null;

        graph = new Graph({
            container: containerRef.current,
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight,
            data: graphData,
            autoFit: "view",
            layout: {
                type: "mindmap",
                direction: layoutDirection,
                getHeight: () => 42,
                getWidth: (node: { id: string; value?: string; data?: { value?: string } }) =>
                    getNodeWidth((node.value ?? node.data?.value ?? "") as string, node.id === "document-root"),
                getVGap: () => 20,
                getHGap: () => 72,
                animation: false,
            },
            node: {
                style: (datum) => {
                    const nodeId = idOf(datum);
                    const data = datum.data as DocumentMindmapGraphNode["data"] | undefined;
                    const isRoot = Boolean(data?.isRoot) || nodeId === "document-root";
                    const branch = getBranchColor(data?.branchIndex ?? 0);
                    const labelText = data?.value ?? ((datum.value as string) || "");

                    return {
                        size: [getNodeWidth(labelText, isRoot), isRoot ? 44 : 36] as [number, number],
                        radius: isRoot ? 14 : 10,
                        fill: isRoot
                            ? isDark
                                ? "#30363d"
                                : "#EFF0F0"
                            : isDark
                                ? branch.fillDark
                                : branch.fillLight,
                        stroke: isRoot ? (isDark ? "#8b949e" : "#9ca3af") : branch.stroke,
                        lineWidth: isRoot ? 1.5 : 2,
                        shadowBlur: isRoot ? 0 : 8,
                        shadowColor: isDark ? "rgba(0,0,0,0.22)" : "rgba(15,23,42,0.08)",
                        shadowOffsetY: isRoot ? 0 : 1,
                        labelText,
                        labelFill: isDark ? "#e6edf3" : "#1f2328",
                        labelFontSize: isRoot ? 17 : 14,
                        labelFontWeight: isRoot ? 600 : 500,
                        labelPlacement: "center",
                        labelMaxWidth: isRoot ? 300 : 240,
                        labelTextOverflow: "ellipsis",
                        cursor: !isRoot ? "pointer" : "default",
                        ports: [{ placement: "left" }, { placement: "right" }],
                    };
                },
            },
            edge: {
                type: "cubic-horizontal",
                style: (edgeDatum: { target: string }) => {
                    const targetData = graph?.getNodeData(edgeDatum.target);
                    const data = targetData?.data as DocumentMindmapGraphNode["data"] | undefined;
                    const branch = getBranchColor(data?.branchIndex ?? 0);
                    return {
                        stroke: branch.stroke,
                        lineWidth: data?.level != null && data.level <= 2 ? 2.2 : 1.6,
                        opacity: 0.95,
                    };
                },
            },
            behaviors: [
                { type: "scroll-canvas", key: "scroll-canvas" },
                { type: "drag-canvas", key: "drag-canvas" },
                { type: "zoom-canvas", key: "zoom-canvas" },
            ],
        });

        graph.render();

        const handleClick = (evt: unknown) => {
            const e = evt as { target?: { id?: string } };
            const nodeId = e.target?.id;
            if (!nodeId || !graph) return;
            const nodeData = graph.getNodeData(nodeId);
            const data = nodeData?.data as DocumentMindmapGraphNode["data"] | undefined;
            if (data?.headingId) {
                onNavigateHeading?.(data.headingId);
            }
        };
        graph.on("node:click", handleClick as (evt: unknown) => void);
        graphRef.current = graph;

        const resizeObserver = new ResizeObserver(() => {
            if (containerRef.current && graphRef.current && !graphRef.current.destroyed) {
                graphRef.current.setSize(containerRef.current.offsetWidth, containerRef.current.offsetHeight);
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            if (graph && !graph.destroyed) {
                graph.off("node:click", handleClick as (evt: unknown) => void);
                graph.destroy();
            }
            graphRef.current = null;
        };
    }, [graphData, headings.length, layoutDirection, onNavigateHeading, themeVersion]);

    const toggleLayoutDirection = useCallback(() => {
        setLayoutDirection((prev) => {
            const next = prev === "H" ? "V" : "H";
            try {
                localStorage.setItem(DIRECTION_STORAGE_KEY, next);
            } catch {
                /* ignore */
            }
            return next;
        });
    }, []);

    if (headings.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-gh-text-secondary">
                当前文档暂无可解析标题
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs text-gh-text-secondary">
                    标题已直接转为脑图（接近 XMind/幕布交互：缩放、拖拽、点击节点定位）
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                        onClick={() => setDepthMode((prev) => (prev === "summary" ? "full" : "summary"))}
                        title={depthMode === "summary" ? "当前显示到二级标题，点击展开全部层级" : "当前显示全部层级，点击切回二级总览"}
                    >
                        {depthMode === "summary" ? "二级" : "全部"}
                    </button>
                    <button
                        type="button"
                        className="rounded-md border border-gh-border bg-transparent px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
                        onClick={toggleLayoutDirection}
                        title={layoutDirection === "H" ? "左右布局，点击切换为上下" : "上下布局，点击切换为左右"}
                    >
                        {layoutDirection === "H" ? "左右" : "上下"}
                    </button>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-gh-border bg-gh-bg">
                <div ref={containerRef} className="h-full min-h-[320px] w-full" />
            </div>
        </div>
    );
}
