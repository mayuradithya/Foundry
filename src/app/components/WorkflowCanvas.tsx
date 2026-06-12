import { useRef, useState, useEffect } from "react";
import { Bot, X } from "lucide-react";
import type { Agent, NodeStatus, WFEdge, WFNode } from "../types";

export const NODE_W = 172;
export const NODE_H = 60;

const STATUS_COLOR: Record<NodeStatus, string> = {
  idle: "#3f3f46",
  pending: "#71717a",
  running: "#3b82f6",
  done: "#22c55e",
  error: "#ef4444",
};

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = (x1 + x2) / 2;
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
}

export function WorkflowCanvas({
  agents,
  nodes,
  edges,
  onChange,
  readOnly = false,
  nodeStatuses = {},
  onNodeClick,
}: {
  agents: Agent[];
  nodes: WFNode[];
  edges: WFEdge[];
  onChange?: (nodes: WFNode[], edges: WFEdge[]) => void;
  readOnly?: boolean;
  nodeStatuses?: Record<string, NodeStatus>;
  onNodeClick?: (nodeId: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const toCanvas = (e: React.MouseEvent) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const addNode = (agent: Agent) => {
    if (!onChange) return;
    const col = nodes.length % 4;
    const row = Math.floor(nodes.length / 4);
    onChange(
      [...nodes, { id: `${Date.now()}`, agentId: agent.id, agentName: agent.name, x: 48 + col * 196, y: 48 + row * 90 }],
      edges
    );
  };

  const delNode = (id: string) => {
    if (!onChange) return;
    onChange(nodes.filter(n => n.id !== id), edges.filter(e => e.from !== id && e.to !== id));
  };

  const delEdge = (id: string) => {
    if (!onChange) return;
    onChange(nodes, edges.filter(e => e.id !== id));
  };

  const startDrag = (e: React.MouseEvent, id: string) => {
    if (readOnly || connecting) return;
    e.stopPropagation();
    const p = toCanvas(e);
    const n = nodes.find(n => n.id === id)!;
    dragRef.current = { id, sx: p.x, sy: p.y, ox: n.x, oy: n.y };
  };

  const onMove = (e: React.MouseEvent) => {
    const p = toCanvas(e);
    setMouse(p);
    if (!dragRef.current || !onChange) return;
    const d = dragRef.current;
    onChange(
      nodes.map(n => n.id === d.id ? { ...n, x: Math.max(0, d.ox + p.x - d.sx), y: Math.max(0, d.oy + p.y - d.sy) } : n),
      edges
    );
  };

  const onOutputPort = (e: React.MouseEvent, id: string) => {
    if (readOnly) return;
    e.stopPropagation();
    setConnecting(id);
  };

  const onInputPort = (e: React.MouseEvent, id: string) => {
    if (readOnly) return;
    e.stopPropagation();
    if (!connecting || connecting === id || !onChange) { setConnecting(null); return; }
    if (!edges.some(e => e.from === connecting && e.to === id)) {
      onChange(nodes, [...edges, { id: `${Date.now()}`, from: connecting, to: id }]);
    }
    setConnecting(null);
  };

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setConnecting(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const outPt = (n: WFNode) => ({ x: n.x + NODE_W, y: n.y + NODE_H / 2 });
  const inPt = (n: WFNode) => ({ x: n.x, y: n.y + NODE_H / 2 });
  const srcNode = connecting ? nodes.find(n => n.id === connecting) : null;

  return (
    <div className="flex h-full overflow-hidden">
      {!readOnly && (
        <div className="w-40 shrink-0 border-r border-border p-2.5 flex flex-col gap-1.5 overflow-y-auto">
          <p className="text-xs text-muted-foreground px-1 mb-0.5">Agents</p>
          {agents.length === 0 && <p className="text-xs text-zinc-600 italic px-1">No agents yet</p>}
          {agents.map(a => (
            <button key={a.id} onClick={() => addNode(a)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-secondary border border-border text-xs text-foreground hover:bg-accent transition-colors text-left w-full truncate">
              <Bot size={11} className="text-muted-foreground shrink-0" />
              <span className="truncate">{a.name}</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        style={{ background: "#09090c", backgroundImage: "radial-gradient(circle, #27272a 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        onMouseMove={onMove}
        onMouseUp={() => { dragRef.current = null; }}
        onClick={() => setConnecting(null)}
      >
        {nodes.length === 0 && !readOnly && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-zinc-700">← Click an agent to add it to the canvas</p>
          </div>
        )}

        {/* Edge SVG layer */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1, pointerEvents: "none" }}>
          <defs>
            <marker id="arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill="#52525b" />
            </marker>
          </defs>
          {edges.map(edge => {
            const fn = nodes.find(n => n.id === edge.from);
            const tn = nodes.find(n => n.id === edge.to);
            if (!fn || !tn) return null;
            const o = outPt(fn), i = inPt(tn);
            return (
              <g key={edge.id}>
                <path d={bezier(o.x, o.y, i.x, i.y)} stroke="#3f3f46" strokeWidth={1.5} fill="none" markerEnd="url(#arr)" />
                {!readOnly && (
                  <path d={bezier(o.x, o.y, i.x, i.y)} stroke="transparent" strokeWidth={14} fill="none"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); delEdge(edge.id); }} />
                )}
              </g>
            );
          })}
          {srcNode && (
            <path d={bezier(outPt(srcNode).x, outPt(srcNode).y, mouse.x, mouse.y)}
              stroke="#60a5fa" strokeWidth={1.5} fill="none" strokeDasharray="5 3" />
          )}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const status = nodeStatuses[node.id] ?? "idle";
          const color = STATUS_COLOR[status];
          const isSrc = connecting === node.id;
          return (
            <div key={node.id}
              style={{ position: "absolute", left: node.x, top: node.y, width: NODE_W, height: NODE_H, zIndex: 2 }}
              className={`rounded-lg border bg-card flex items-center px-3 gap-2.5 select-none transition-colors
                ${isSrc ? "border-blue-500/60" : "border-border hover:border-zinc-600"}
                ${readOnly && onNodeClick ? "cursor-pointer" : "cursor-move"}`}
              onMouseDown={e => startDrag(e, node.id)}
              onClick={e => { e.stopPropagation(); onNodeClick?.(node.id); }}
            >
              {/* Input port */}
              <div
                style={{ position: "absolute", left: -6, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, borderRadius: "50%", background: "#18181b", border: `2px solid ${connecting ? "#60a5fa" : "#52525b"}`, zIndex: 4, cursor: connecting ? "crosshair" : "default" }}
                onClick={e => onInputPort(e, node.id)}
              />

              <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, transition: "background 0.4s" }}
                className={status === "running" ? "animate-pulse" : ""} />

              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate leading-tight">{node.agentName}</p>
                {status !== "idle" && (
                  <p className="text-xs leading-tight mt-0.5" style={{ color }}>
                    {status === "running" ? "Running…" : status === "pending" ? "Queued" : status === "done" ? "Done" : "Error"}
                  </p>
                )}
              </div>

              {!readOnly && (
                <button onClick={e => { e.stopPropagation(); delNode(node.id); }}
                  className="text-zinc-700 hover:text-zinc-400 transition-colors shrink-0">
                  <X size={11} />
                </button>
              )}

              {/* Output port */}
              <div
                style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, borderRadius: "50%", background: "#18181b", border: `2px solid ${isSrc ? "#60a5fa" : "#52525b"}`, zIndex: 4, cursor: "crosshair" }}
                onClick={e => onOutputPort(e, node.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
