import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Plus, X, Play, MoreVertical, ArrowLeft, Cpu, Network,
  CheckCircle2, XCircle, Clock, Loader2, ChevronDown, Check, FileText,
  Zap,
} from "lucide-react";
import { generateWorkflowRun } from "../backend";
import type { Agent, NodeStatus, Orchestration, Run, WFEdge, WFNode } from "../types";
import { WorkflowCanvas } from "./WorkflowCanvas";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getBFSLevels(nodes: WFNode[], edges: WFEdge[]): string[][] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }
  const levels: string[][] = [];
  let current = nodes.filter((n) => inDeg.get(n.id) === 0).map((n) => n.id);
  const visited = new Set<string>();
  while (current.length > 0) {
    levels.push(current);
    current.forEach((id) => visited.add(id));
    const next: string[] = [];
    for (const id of current) {
      for (const nid of adj.get(id) ?? []) {
        const d = (inDeg.get(nid) ?? 1) - 1;
        inDeg.set(nid, d);
        if (d === 0) {
          next.push(nid);
        }
      }
    }
    current = next;
  }
  const missed = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
  if (missed.length) {
    levels.push(missed);
  }
  return levels;
}

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

function OrchestrationCard({
  orch,
  agents,
  onClick,
  onEdit,
  onDelete,
}: {
  orch: Orchestration;
  agents: Agent[];
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const conductor = agents.find((a) => a.id === orch.conductorId);
  const lastRun = orch.runs[0] ?? null;

  return (
    <div
      className="rounded-lg border border-border bg-card hover:border-zinc-600 transition-colors cursor-pointer relative group"
      onClick={onClick}
    >
      <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100">
              <MoreVertical size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-32 rounded-lg border border-border bg-popover p-1 shadow-xl">
              <DropdownMenu.Item
                onSelect={onEdit}
                className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer outline-none transition-colors"
              >
                Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={onDelete}
                className="px-3 py-2 rounded-md text-sm text-red-400 hover:text-red-300 hover:bg-secondary cursor-pointer outline-none transition-colors"
              >
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <Network size={15} className="text-muted-foreground" />
          </div>
          <div className="min-w-0 pr-6">
            <p className="text-foreground text-sm truncate">{orch.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orch.nodes.length} node{orch.nodes.length !== 1 ? "s" : ""}
              {orch.edges.length > 0 && ` · ${orch.edges.length} connection${orch.edges.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {conductor && (
          <div className="flex items-center gap-1.5">
            <Cpu size={10} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Conductor: <span className="text-foreground">{conductor.name}</span>
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-xs text-zinc-600">{orch.runs.length} run{orch.runs.length !== 1 ? "s" : ""}</span>
          {lastRun ? (
            <span className={cn("flex items-center gap-1 text-xs", lastRun.status === "success" ? "text-green-500" : "text-red-400")}>
              {lastRun.status === "success" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
              {fmtTime(lastRun.startedAt)}
            </span>
          ) : (
            <span className="text-xs text-zinc-700">Never run</span>
          )}
        </div>
      </div>
    </div>
  );
}

function OrchestrationModal({
  open,
  onOpenChange,
  onSave,
  agents,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (o: Orchestration) => void;
  agents: Agent[];
  initial?: Orchestration;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nodes, setNodes] = useState<WFNode[]>(initial?.nodes ?? []);
  const [edges, setEdges] = useState<WFEdge[]>(initial?.edges ?? []);
  const [conductorId, setConductorId] = useState<string | undefined>(initial?.conductorId);
  const [textDef, setTextDef] = useState(initial?.textDef ?? "");
  const [defTab, setDefTab] = useState<"visual" | "text">("visual");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setNodes(initial?.nodes ?? []);
      setEdges(initial?.edges ?? []);
      setConductorId(initial?.conductorId);
      setTextDef(initial?.textDef ?? "");
      setDefTab("visual");
    }
  }, [open, initial]);

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? `${Date.now()}`,
      name: name.trim(),
      nodes,
      edges,
      conductorId,
      textDef: textDef.trim() || undefined,
      runs: initial?.runs ?? [],
    });
    onOpenChange(false);
  };

  const conductor = agents.find((a) => a.id === conductorId);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-4xl h-[80vh] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          <Dialog.Description className="sr-only">Create or edit a multi-agent workflow orchestration.</Dialog.Description>

          <div className="flex items-center gap-4 px-5 py-4 border-b border-border shrink-0">
            <div className="flex-1">
              <Dialog.Title className="sr-only">{initial ? "Edit orchestration" : "New orchestration"}</Dialog.Title>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Orchestration name…"
                className="w-full bg-transparent text-foreground placeholder:text-zinc-600 outline-none text-base"
              />
            </div>
            <Dialog.Close className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="flex gap-0 border-b border-border shrink-0">
            {(["visual", "text"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDefTab(t)}
                className={cn(
                  "px-4 py-2.5 text-xs capitalize transition-colors border-b-2 -mb-px",
                  defTab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "visual" ? "Visual" : "Text definition"}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {defTab === "visual" ? (
              <WorkflowCanvas agents={agents} nodes={nodes} edges={edges} onChange={(n, e) => { setNodes(n); setEdges(e); }} />
            ) : (
              <textarea
                value={textDef}
                onChange={(e) => setTextDef(e.target.value)}
                placeholder={"Describe the workflow in natural language or YAML.\n\nExample:\n- Agent 'researcher' searches for information\n- Agent 'writer' drafts content based on research\n- Agent 'reviewer' checks and revises the draft"}
                className="w-full h-full px-5 py-4 bg-transparent text-sm text-foreground placeholder:text-zinc-700 outline-none resize-none font-mono"
              />
            )}
          </div>

          <div className="flex items-center gap-4 px-5 py-3 border-t border-border shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <Zap size={13} className="text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground shrink-0">Conductor:</span>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground hover:bg-accent transition-colors">
                    {conductor ? conductor.name : <span className="text-muted-foreground">None</span>}
                    <ChevronDown size={11} className="text-muted-foreground" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="start" sideOffset={4} className="z-[60] min-w-44 rounded-lg border border-border bg-popover p-1 shadow-xl max-h-48 overflow-y-auto">
                    <DropdownMenu.Item
                      onSelect={() => setConductorId(undefined)}
                      className="flex items-center justify-between px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer outline-none"
                    >
                      None {!conductorId && <Check size={11} />}
                    </DropdownMenu.Item>
                    {agents.length > 0 && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
                    {agents.map((a) => (
                      <DropdownMenu.Item
                        key={a.id}
                        onSelect={() => setConductorId(a.id)}
                        className="flex items-center justify-between gap-4 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer outline-none"
                      >
                        {a.name} {conductorId === a.id && <Check size={11} />}
                      </DropdownMenu.Item>
                    ))}
                    {agents.length === 0 && (
                      <div className="px-3 py-2 text-xs text-zinc-600">No agents configured</div>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!name.trim()}
              className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {initial ? "Save changes" : "Create"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NodeOutputDialog({
  nodeId,
  nodes,
  nodeOutputs,
  onClose,
}: {
  nodeId: string | null;
  nodes: WFNode[];
  nodeOutputs: Record<string, string>;
  onClose: () => void;
}) {
  const node = nodeId ? nodes.find((n) => n.id === nodeId) : null;
  const output = nodeId ? nodeOutputs[nodeId] : null;

  return (
    <Dialog.Root open={!!nodeId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Dialog.Title className="text-foreground text-sm">{node?.agentName ?? "Node"}</Dialog.Title>
              <p className="text-xs text-muted-foreground mt-0.5">Node output</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={15} />
            </button>
          </div>
          <Dialog.Description className="sr-only">Output produced by this workflow node.</Dialog.Description>
          <div className="rounded-lg bg-secondary border border-border p-4 font-mono text-xs text-foreground whitespace-pre-wrap min-h-24 max-h-64 overflow-y-auto leading-relaxed">
            {output ?? <span className="text-zinc-600">No output yet. Run the workflow first.</span>}
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm bg-secondary text-foreground hover:bg-accent transition-colors">
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExecutionView({
  orchestration,
  agents,
  onBack,
  onUpdate,
}: {
  orchestration: Orchestration;
  agents: Agent[];
  onBack: () => void;
  onUpdate: (o: Orchestration) => void;
}) {
  const [exTab, setExTab] = useState<"live" | "runs" | "output">("live");
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const runningRef = useRef(false);

  const conductor = agents.find((a) => a.id === orchestration.conductorId);

  const runWorkflow = async () => {
    if (isRunning || orchestration.nodes.length === 0) return;
    setIsRunning(true);
    runningRef.current = true;
    setExTab("live");

    const statuses: Record<string, NodeStatus> = {};
    for (const n of orchestration.nodes) {
      statuses[n.id] = "pending";
    }
    setNodeStatuses({ ...statuses });
    setNodeOutputs({});

    try {
      const generated = await generateWorkflowRun(orchestration);
      const levels = getBFSLevels(orchestration.nodes, orchestration.edges);

      for (let li = 0; li < levels.length; li++) {
        if (!runningRef.current) break;
        const level = levels[li];
        for (const id of level) {
          statuses[id] = "running";
        }
        setNodeStatuses({ ...statuses });

        await sleep(700 + Math.random() * 400);

        for (const id of level) {
          statuses[id] = "done";
        }
        setNodeStatuses({ ...statuses });
        setNodeOutputs((prev) => {
          const next = { ...prev };
          for (const id of level) {
            next[id] = generated.nodeOutputs[id] ?? prev[id] ?? "No output";
          }
          return next;
        });
      }

      runningRef.current = false;
      setIsRunning(false);
      const updated = { ...orchestration, runs: [generated.run, ...orchestration.runs] };
      onUpdate(updated);
      setSelectedRun(generated.run);
      setExTab("output");
    } catch (error) {
      runningRef.current = false;
      setIsRunning(false);
      const errored = Object.fromEntries(orchestration.nodes.map((node) => [node.id, "error" as NodeStatus]));
      setNodeStatuses(errored);
      setNodeOutputs({});
      console.error("Failed to execute orchestration", error);
    }
  };

  useEffect(() => () => {
    runningRef.current = false;
  }, []);

  const activeRun = selectedRun ?? orchestration.runs[0] ?? null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="w-px h-4 bg-border" />
        <Network size={14} className="text-muted-foreground" />
        <span className="text-foreground text-sm">{orchestration.name}</span>
        {conductor && (
          <>
            <div className="w-px h-4 bg-border" />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap size={11} /> {conductor.name}
            </span>
          </>
        )}
        <div className="flex-1" />
        <button
          onClick={runWorkflow}
          disabled={isRunning || orchestration.nodes.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {isRunning ? "Running…" : "Run"}
        </button>
      </div>

      <div className="flex border-b border-border shrink-0">
        {(["live", "runs", "output"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setExTab(t)}
            className={cn(
              "px-4 py-2.5 text-xs capitalize transition-colors border-b-2 -mb-px",
              exTab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "live" ? "Live" : t === "runs" ? `Runs (${orchestration.runs.length})` : "Output"}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {exTab === "live" && (
          <WorkflowCanvas
            agents={agents}
            nodes={orchestration.nodes}
            edges={orchestration.edges}
            readOnly
            nodeStatuses={nodeStatuses}
            onNodeClick={(id) => setSelectedNodeId(id)}
          />
        )}

        {exTab === "runs" && (
          <div className="h-full overflow-y-auto p-5">
            {orchestration.runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Clock size={20} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No runs yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-4 gap-3 px-3 pb-2 border-b border-border">
                  {["#", "Started", "Duration", "Status"].map((h) => (
                    <span key={h} className="text-xs text-muted-foreground">{h}</span>
                  ))}
                </div>
                {orchestration.runs.map((run, i) => (
                  <button
                    key={run.id}
                    onClick={() => { setSelectedRun(run); setExTab("output"); }}
                    className={cn(
                      "grid grid-cols-4 gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left",
                      selectedRun?.id === run.id ? "border-zinc-600 bg-secondary" : "border-border hover:border-zinc-700 hover:bg-secondary/50"
                    )}
                  >
                    <span className="text-xs text-muted-foreground">{orchestration.runs.length - i}</span>
                    <span className="text-xs text-foreground">{fmtTime(run.startedAt)}</span>
                    <span className="text-xs text-muted-foreground">{fmtDuration(run.durationMs)}</span>
                    <span className={cn("flex items-center gap-1 text-xs", run.status === "success" ? "text-green-500" : "text-red-400")}>
                      {run.status === "success" ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      {run.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {exTab === "output" && (
          <div className="h-full overflow-y-auto p-5">
            {!activeRun ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <FileText size={20} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Run the workflow to see output</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className={cn("flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border", activeRun.status === "success" ? "text-green-500 border-green-500/30 bg-green-500/10" : "text-red-400 border-red-400/30 bg-red-400/10")}>
                    {activeRun.status === "success" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                    {activeRun.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtTime(activeRun.startedAt)} · {fmtDuration(activeRun.durationMs)}</span>
                </div>
                <div className="rounded-lg bg-secondary border border-border p-4 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                  {activeRun.output}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <NodeOutputDialog
        nodeId={selectedNodeId}
        nodes={orchestration.nodes}
        nodeOutputs={activeRun?.nodeOutputs ?? nodeOutputs}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}

export function OrchestraTab({
  agents,
  orchs,
  setOrchs,
}: {
  agents: Agent[];
  orchs: Orchestration[];
  setOrchs: Dispatch<SetStateAction<Orchestration[]>>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrch, setEditingOrch] = useState<Orchestration | undefined>(undefined);

  const selected = orchs.find((o) => o.id === selectedId) ?? null;

  const save = (o: Orchestration) => {
    setOrchs((prev) => {
      const idx = prev.findIndex((x) => x.id === o.id);
      return idx >= 0 ? prev.map((x) => x.id === o.id ? o : x) : [...prev, o];
    });
  };

  const del = (id: string) => {
    setOrchs((prev) => prev.filter((o) => o.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  if (selected) {
    return (
      <ExecutionView
        orchestration={selected}
        agents={agents}
        onBack={() => setSelectedId(null)}
        onUpdate={(updated) => {
          setOrchs((prev) => prev.map((o) => o.id === updated.id ? updated : o));
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground">Orchestra</h2>
          <p className="text-muted-foreground text-sm">{orchs.length} orchestration{orchs.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setEditingOrch(undefined); setCreateOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Add new
        </button>
      </div>

      {orchs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
            <Network size={20} className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No orchestrations yet</p>
          <button onClick={() => setCreateOpen(true)} className="text-sm text-foreground underline-offset-2 hover:underline">
            Create your first orchestration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 content-start overflow-y-auto">
          {orchs.map((orch) => (
            <OrchestrationCard
              key={orch.id}
              orch={orch}
              agents={agents}
              onClick={() => setSelectedId(orch.id)}
              onEdit={() => { setEditingOrch(orch); setCreateOpen(true); }}
              onDelete={() => del(orch.id)}
            />
          ))}
        </div>
      )}

      <OrchestrationModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={save}
        agents={agents}
        initial={editingOrch}
      />
    </div>
  );
}
