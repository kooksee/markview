import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { Outline } from "../hooks/useApi";
import { fetchOutline } from "../hooks/useApi";
import { buildFileUrl } from "../utils/groups";

const FILE_COLORS = [
  { color: "#0550ae", bg: "#ffffff" },
  { color: "#116329", bg: "#ffffff" },
  { color: "#9a3b00", bg: "#ffffff" },
  { color: "#6639ba", bg: "#ffffff" },
  { color: "#a0111f", bg: "#ffffff" },
];

interface GravityH2 {
  id: string;
  text: string;
  linkedFileIds: string[];
}

interface GravityFile {
  id: string;
  name: string;
  group: string;
  color: string;
  bg: string;
  h1: { text: string };
  h2s: GravityH2[];
}

interface GravityNode {
  id: string;
  fileId: string;
  isFile: boolean;
  file: GravityFile;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  h2?: GravityH2;
  /** 文件圆环半径（仅 isFile 时有效），由 spacing 动态计算 */
  circleRadius?: number;
}

interface GravityLink {
  source: GravityNode;
  target: GravityNode;
  distance: number;
}

/** 获取某文件引用的其他文件 ID 集合 */
function getReferencedFileIds(f: GravityFile): Set<string> {
  const ids = new Set<string>();
  for (const h2 of f.h2s) {
    for (const id of h2.linkedFileIds) ids.add(id);
  }
  return ids;
}

/**
 * 重排文件顺序：让被引用文档环绕引用它们的文档（星形分布）。
 * 选择「引用数最多」的 hub，将其引用的文档均匀插到圆环上。
 */
function orderFilesForSurroundLayout(files: GravityFile[]): GravityFile[] {
  if (files.length <= 2) return files;

  const fileById = new Map(files.map((f) => [f.id, f]));

  let bestHub: GravityFile | null = null;
  let bestRefCount = 0;
  for (const f of files) {
    const refs = getReferencedFileIds(f);
    const count = [...refs].filter((id) => fileById.has(id) && id !== f.id).length;
    if (count > bestRefCount) {
      bestRefCount = count;
      bestHub = f;
    }
  }

  if (!bestHub || bestRefCount === 0) return files;

  const hubRefs = [...getReferencedFileIds(bestHub)].filter(
    (id) => fileById.has(id) && id !== bestHub!.id,
  );
  const others = files.filter(
    (f) => f.id !== bestHub!.id && !hubRefs.includes(f.id),
  );

  const n = files.length;
  const step = Math.max(1, Math.ceil((n - 1) / hubRefs.length));
  const result: GravityFile[] = [bestHub];

  let refIdx = 0;
  let otherIdx = 0;
  for (let pos = 1; pos < n; pos++) {
    const isRefSlot = (pos - 1) % step === 0 && refIdx < hubRefs.length;
    if (isRefSlot) {
      const fid = hubRefs[refIdx++];
      const f = fileById.get(fid);
      if (f) result.push(f);
    } else if (otherIdx < others.length) {
      result.push(others[otherIdx++]);
    }
  }
  while (refIdx < hubRefs.length) {
    const fid = hubRefs[refIdx++];
    const f = fileById.get(fid);
    if (f && !result.includes(f)) result.push(f);
  }
  while (otherIdx < others.length) result.push(others[otherIdx++]);

  return result;
}

function parseOutlineToGravity(outline: Outline): GravityFile[] {
  const fileIds = new Set(outline.files.map((f) => f.id));
  return outline.files.map((file, idx) => {
    const colors = FILE_COLORS[idx % FILE_COLORS.length];
    let h1Text = file.name;
    const h2s: GravityH2[] = [];
    let currentH1: string | null = null;
    for (let i = 0; i < file.headings.length; i++) {
      const h = file.headings[i];
      if (h.level === 1) {
        currentH1 = h.text;
        if (h2s.length === 0) h1Text = h.text;
      } else if (h.level === 2 && currentH1 != null) {
        const linked = (h.linkedFileIds ?? []).filter((id) => fileIds.has(id));
        h2s.push({
          id: `n_${file.id}_${i}`.replace(/-/g, "_"),
          text: h.text,
          linkedFileIds: linked,
        });
      }
    }
    return {
      id: file.id,
      name: file.name,
      group: file.group,
      color: colors.color,
      bg: colors.bg,
      h1: { text: h1Text },
      h2s,
    };
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");
}

/** 根据圆半径截断文本，超长显示省略号；完整内容在 title 中 */
function truncateForCircle(text: string, radius: number): string {
  const maxChars = Math.max(4, Math.floor((radius * 3.5) / 5));
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + "…";
}

interface OutlineGravityViewProps {
  onClose: () => void;
}

export function OutlineGravityView({ onClose }: OutlineGravityViewProps) {
  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [size, setSize] = useState({ w: 700, h: 450 });
  const [zoom, setZoom] = useState(1);
  const collapsedRef = useRef(collapsedFiles);
  collapsedRef.current = collapsedFiles;
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const containerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<{ stop: () => void } | null>(null);
  const linkForceRef = useRef<ReturnType<typeof d3.forceLink<GravityNode, GravityLink>> | null>(null);
  const resetZoomRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOutline()
      .then((data) => {
        if (!cancelled) {
          setOutline(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load outline");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCollapse = useCallback((fileId: string) => {
    setCollapsedFiles((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  }, []);

  useEffect(() => {
    const el = graphContainerRef.current;
    if (!el || !outline) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 700, height: 450 };
      if (width > 0 && height > 0) {
        setSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSize({ w: rect.width, h: rect.height });
    }
    return () => ro.disconnect();
  }, [outline]);

  useEffect(() => {
    const sim = simulationRef.current as d3.Simulation<GravityNode, d3.SimulationLinkDatum<GravityNode>> | null;
    const linkForce = linkForceRef.current;
    if (!sim || !linkForce) return;
    linkForce.distance((d: GravityLink) => (d.distance ?? 80) * zoomRef.current);
    sim.force("link", linkForce);
    sim.alpha(0.3).restart();
  }, [zoom]);

  useEffect(() => {
    if (!outline || outline.files.length === 0 || !svgRef.current)
      return;

    const files = orderFilesForSurroundLayout(parseOutlineToGravity(outline));
    const { w, h } = size;

    const nodes: GravityNode[] = [];
    const links: GravityLink[] = [];
    const nodeMap: Record<string, GravityNode> = {};

    const spacing = Math.min(w, h) * 0.15;
    const h2NodeRadius = spacing * 0.15;
    const fileRingRadius = spacing * 1.8;

    // 第一遍：创建所有文件节点，确保跨文件链接时 target 已在 nodeMap 中
    const fileNodes = new Map<string, GravityNode>();
    files.forEach((f, i) => {
      const h2PlaceRadius =
        spacing * (0.35 + f.h2s.length * 0.06);
      const fileCircleRadius =
        h2PlaceRadius + h2NodeRadius + spacing * 0.06;
      const angle = (i / files.length) * Math.PI * 2 - Math.PI / 2;
      const n: GravityNode = {
        id: `fl_${f.id.replace(/-/g, "_")}`,
        fileId: f.id,
        isFile: true,
        file: f,
        circleRadius: fileCircleRadius,
        x: w / 2 + fileRingRadius * Math.cos(angle),
        y: h / 2 + fileRingRadius * Math.sin(angle),
      };
      nodes.push(n);
      nodeMap[n.id] = n;
      fileNodes.set(f.id, n);
    });

    // 第二遍：创建 h2 节点和所有链接（含跨文件引用）
    files.forEach((f) => {
      const n = fileNodes.get(f.id)!;
      const h2PlaceRadius =
        spacing * (0.35 + f.h2s.length * 0.06);
      f.h2s.forEach((h2, j) => {
        const angleOffset = (j / Math.max(1, f.h2s.length)) * Math.PI * 2 - Math.PI / 2;
        const hn: GravityNode = {
          id: h2.id,
          fileId: f.id,
          isFile: false,
          file: f,
          h2,
          x: n.x + h2PlaceRadius * Math.cos(angleOffset),
          y: n.y + h2PlaceRadius * Math.sin(angleOffset),
        };
        nodes.push(hn);
        nodeMap[hn.id] = hn;
        links.push({ source: n, target: hn, distance: h2PlaceRadius });
        for (const tid of h2.linkedFileIds) {
          const targetId = `fl_${tid.replace(/-/g, "_")}`;
          const targetNode = nodeMap[targetId];
          if (targetNode) {
            links.push({ source: hn, target: targetNode, distance: spacing * 2.2 });
          }
        }
      });
    });

    let justDragged = false;

    const linkForce = d3
      .forceLink<GravityNode, GravityLink>(links)
      .id((d: GravityNode) => d.id)
      .distance((d: GravityLink) => (d.distance ?? 80) * zoomRef.current);
    linkForceRef.current = linkForce;

    function constrainH2InsideCircle() {
      for (const node of nodes) {
        if (node.isFile) continue;
        const fileNode = nodes.find(
          (n) => n.isFile && n.fileId === node.fileId,
        ) as GravityNode | undefined;
        if (!fileNode || fileNode.circleRadius == null) continue;
        const maxDist =
          fileNode.circleRadius - h2NodeRadius - spacing * 0.06;
        const dx = node.x - fileNode.x;
        const dy = node.y - fileNode.y;
        const dist = Math.hypot(dx, dy);
        if (dist > maxDist && dist > 1e-6) {
          node.x = fileNode.x + (dx / dist) * maxDist;
          node.y = fileNode.y + (dy / dist) * maxDist;
        }
      }
    }

    const simulation = d3
      .forceSimulation<GravityNode>(nodes)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(w / 2, h / 2).strength(0.03))
      .force("y", d3.forceY(h / 2).strength(0.02))
      .force(
        "collision",
        d3.forceCollide<GravityNode>().radius((d: GravityNode) =>
          d.isFile
            ? (d.circleRadius ??
                spacing * (0.41 + d.file.h2s.length * 0.06) + h2NodeRadius)
            : h2NodeRadius,
        ),
      );

    simulationRef.current = simulation;

    const svg = d3.select(svgRef.current).attr("viewBox", `0 0 ${w} ${h}`);
    svg.selectAll("*").remove();

    const zoomRoot = svg.append("g").attr("class", "zoom-root");

    const linkSolid = zoomRoot
      .append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, GravityLink>("line")
      .data(links.filter((l: GravityLink) => !l.target.isFile))
      .join("line")
      .attr("stroke", (d: GravityLink) => (d.source.file ? d.source.file.color : "#999"))
      .attr("stroke-opacity", 0.7);

    const linkDashed = zoomRoot
      .append("g")
      .attr("class", "links-dashed")
      .selectAll<SVGPathElement, GravityLink>("path")
      .data(links.filter((l: GravityLink) => l.target.isFile))
      .join("path")
      .attr("stroke", "#cf222e")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4")
      .attr("fill", "none");

    const node = zoomRoot
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, GravityNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, GravityNode>()
          .on("start", (event: d3.D3DragEvent<SVGGElement, GravityNode, GravityNode>, d: GravityNode) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event: d3.D3DragEvent<SVGGElement, GravityNode, GravityNode>, d: GravityNode) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event: d3.D3DragEvent<SVGGElement, GravityNode, GravityNode>, d: GravityNode) => {
            if (!event.active) simulation.alphaTarget(0);
            justDragged = Math.abs(event.dx) > 2 || Math.abs(event.dy) > 2;
            d.fx = null;
            d.fy = null;
            setTimeout(() => {
              justDragged = false;
            }, 0);
          }),
      );

    node
      .filter((d: GravityNode) => d.isFile)
      .each(function (this: SVGGElement, d: GravityNode) {
        const g = d3.select(this);
        const r =
          d.circleRadius ??
          spacing * (0.41 + d.file.h2s.length * 0.06) + h2NodeRadius;
        g.append("circle")
          .attr("r", r)
          .attr("fill", "none")
          .attr("stroke", d.file.color)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", 4)
          .attr("class", "file-ring");
        g.append("text")
          .attr("class", "file-name")
          .attr("y", -r + 14)
          .attr("text-anchor", "middle")
          .attr("font-size", 11)
          .attr("fill", "var(--color-gh-text-secondary)")
          .text(d.file.name);
        g.append("circle")
          .attr("r", Math.max(12, spacing * 0.1))
          .attr("fill", d.file.color)
          .attr("stroke", "var(--color-gh-bg)")
          .attr("stroke-width", 2)
          .attr("class", "h1-center")
          .attr("title", "点击折叠/展开");
        g.append("text")
          .attr("class", "h1-label")
          .attr("y", 5)
          .attr("text-anchor", "middle")
          .attr("font-size", 9)
          .attr("fill", "#fff")
          .text(d.file.h1.text);
      });

    node
      .filter((d: GravityNode) => !d.isFile)
      .each(function (this: SVGGElement, d: GravityNode) {
        const g = d3.select(this);
        g.append("circle")
          .attr("r", h2NodeRadius)
          .attr("fill", "var(--color-gh-bg)")
          .attr("stroke", d.file.color)
          .attr("stroke-width", 1.5);
        g.append("text")
          .attr("y", 5)
          .attr("text-anchor", "middle")
          .attr("font-size", 9)
          .attr("fill", "var(--color-gh-text)")
          .attr("stroke", "none")
          .text(truncateForCircle(d.h2!.text, h2NodeRadius));
      })
      .attr(
        "title",
        (d: GravityNode) => `点击打开: ${d.file.name}#${d.h2!.text}`,
      );

    zoomRoot
      .selectAll(".h1-center, .h1-label")
      .on("mousedown", (e: MouseEvent) => e.stopPropagation())
      .on("click", (e: MouseEvent) => {
        e.stopPropagation();
        const g = (e.target as SVGElement).closest("g");
        if (!g) return;
        const d = (d3.select(g).datum() as unknown) as GravityNode;
        if (d?.isFile) {
          toggleCollapse(d.fileId);
          d3.select(g).raise();
          simulation.alpha(0.3).restart();
        }
      });

    node.filter((d: GravityNode) => !d.isFile).on("click", (e: MouseEvent, d: GravityNode) => {
      if (e.defaultPrevented || justDragged) {
        justDragged = false;
        return;
      }
      justDragged = false;
      const slug = slugify(d.h2!.text);
      const path = buildFileUrl(d.file.group, d.fileId);
      const hash = slug ? `#${slug}` : "";
      window.open(`${window.location.origin}${path}${hash}`, "_blank", "noopener,noreferrer");
    });

    function ticked() {
      constrainH2InsideCircle();
      for (const node of nodes) {
        node.x = Math.max(20, Math.min(w - 20, node.x));
        node.y = Math.max(20, Math.min(h - 20, node.y));
      }
      const collapsed = collapsedRef.current;
      linkSolid
        .attr("x1", (d: GravityLink) => d.source.x)
        .attr("y1", (d: GravityLink) => d.source.y)
        .attr("x2", (d: GravityLink) => d.target.x)
        .attr("y2", (d: GravityLink) => d.target.y)
        .attr("visibility", (d: GravityLink) =>
          !d.target.isFile && collapsed[d.target.fileId] ? "hidden" : "visible",
        );
      linkDashed.attr("d", (d: GravityLink) => {
        let sx = d.source.x;
        let sy = d.source.y;
        if (!d.source.isFile && collapsed[d.source.fileId]) {
          const fc = nodes.find((n) => n.id === `fl_${d.source.fileId.replace(/-/g, "_")}`);
          if (fc) {
            sx = fc.x;
            sy = fc.y;
          }
        }
        let tx = d.target.x;
        let ty = d.target.y;
        if (!d.target.isFile && collapsed[d.target.fileId]) {
          const fc2 = nodes.find((n) => n.id === `fl_${d.target.fileId.replace(/-/g, "_")}`);
          if (fc2) {
            tx = fc2.x;
            ty = fc2.y;
          }
        }
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        return `M${sx},${sy} Q${mx - (ty - sy) * 0.2},${my + (tx - sx) * 0.2} ${tx},${ty}`;
      });
      node.attr("transform", (d: GravityNode) => `translate(${d.x},${d.y})`);
      node
        .filter((d: GravityNode) => d.isFile)
        .selectAll(".file-ring, .file-name")
        .attr("visibility", function () {
          const g = (this as Element).closest("g");
          const d = g ? (d3.select(g).datum() as unknown) as GravityNode : null;
          return d && collapsed[d.fileId] ? "hidden" : "visible";
        });
      node
        .filter((d: GravityNode) => !d.isFile)
        .attr("visibility", (d: GravityNode) => (collapsed[d.fileId] ? "hidden" : "visible"))
        .attr("pointer-events", (d: GravityNode) => (collapsed[d.fileId] ? "none" : "auto"));
      node.filter((d: GravityNode) => d.isFile && collapsed[d.fileId]).raise();
    }

    simulation.on("tick", ticked);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .filter((event: WheelEvent | MouseEvent) => !(event.target as Element)?.closest?.(".nodes"))
      .on("zoom", (event) => {
        zoomRoot.attr("transform", event.transform.toString());
        setZoom(event.transform.k);
      });
    const resetZoom = () => {
      svg
        .transition()
        .duration(250)
        .call(
          zoomBehavior.transform,
          d3.zoomIdentity.translate(w / 2, h / 2).scale(1).translate(-w / 2, -h / 2),
        );
      setZoom(1);
    };
    resetZoomRef.current = resetZoom;
    svg.call(zoomBehavior);
    resetZoom();

    return () => {
      resetZoomRef.current = null;
      simulation.stop();
      simulationRef.current = null;
    };
  }, [outline, size, toggleCollapse]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 shrink-0 pb-2">
          <button
            type="button"
            className="rounded-md border border-gh-border bg-transparent px-2 py-1.5 text-sm text-gh-text-secondary hover:bg-gh-bg-hover"
            onClick={onClose}
          >
            返回文档
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-gh-text-secondary">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 shrink-0 pb-2">
          <button
            type="button"
            className="rounded-md border border-gh-border bg-transparent px-2 py-1.5 text-sm text-gh-text-secondary hover:bg-gh-bg-hover"
            onClick={onClose}
          >
            返回文档
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-red-500">{error}</div>
      </div>
    );
  }

  if (!outline || outline.files.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 shrink-0 pb-2">
          <button
            type="button"
            className="rounded-md border border-gh-border bg-transparent px-2 py-1.5 text-sm text-gh-text-secondary hover:bg-gh-bg-hover"
            onClick={onClose}
          >
            返回文档
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-gh-text-secondary">
          暂无文档或标题
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="flex shrink-0 flex-wrap items-center gap-2 pb-2">
        <button
          type="button"
          className="rounded-md border border-gh-border bg-transparent px-2 py-1.5 text-sm text-gh-text-secondary hover:bg-gh-bg-hover"
          onClick={onClose}
        >
          返回文档
        </button>
        <span className="text-sm text-gh-text-secondary">
          重力视图：拖拽节点、滚轮缩放、画布平移；点击圆心折叠/展开；点击 h2 在新标签打开
        </span>
      </div>
      <div ref={graphContainerRef} className="relative min-h-0 flex-1 overflow-hidden">
        <button
          type="button"
          className="absolute right-2 top-2 z-10 rounded border border-gh-border bg-gh-bg px-2 py-1 text-xs text-gh-text-secondary hover:bg-gh-bg-hover"
          onClick={() => resetZoomRef.current?.()}
          title="重置缩放与位置"
        >
          重置
        </button>
        <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
      </div>
    </div>
  );
}
