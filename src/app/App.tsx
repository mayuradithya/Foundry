import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type InputHTMLAttributes, type SetStateAction } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus, X, Github, Bot, Server, Layers, User, Cpu, ChevronDown, Check, Wrench, Network } from "lucide-react";
import { loadAppState, saveAppState } from "./backend";
import { Visualizer } from "./components/Visualizer";
import { AgentCard } from "./components/AgentCard";
import { OrchestraTab } from "./components/OrchestraTab";
import type { Agent, McpServer, Model, Orchestration, PersistedAppState } from "./types";

/* MARKER-MAKE-KIT-INVOKED */

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring text-sm"
        {...props}
      />
    </div>
  );
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const val = raw.trim();
    if (val && !values.includes(val)) onChange([...values, val]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="min-h-10 w-full px-2 py-1.5 rounded-md bg-secondary border border-border flex flex-wrap gap-1 focus-within:ring-1 focus-within:ring-ring">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-60 hover:opacity-100">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          placeholder={placeholder ?? "Type and press Enter"}
          className="flex-1 min-w-24 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(e.currentTarget.value); } }}
          onBlur={(e) => add(e.currentTarget.value)}
        />
      </div>
    </div>
  );
}

function SkillsPicker({
  savedSkills,
  values,
  onChange,
}: {
  savedSkills: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (skill: string) =>
    onChange(values.includes(skill) ? values.filter((x) => x !== skill) : [...values, skill]);

  const addCustom = (raw: string) => {
    const val = raw.trim();
    if (val && !values.includes(val)) onChange([...values, val]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground">Skills</label>

      {savedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {savedSkills.map((s) => {
            const active = values.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={cn(
                  "flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {active && <Check size={10} />}
                {s}
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-9 w-full px-2 py-1.5 rounded-md bg-secondary border border-border flex flex-wrap gap-1 focus-within:ring-1 focus-within:ring-ring">
        {values.filter((v) => !savedSkills.includes(v)).map((v) => (
          <span key={v} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-60 hover:opacity-100">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          placeholder={savedSkills.length > 0 ? "Add custom skill…" : "Type skill, press Enter"}
          className="flex-1 min-w-24 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(e.currentTarget.value); } }}
          onBlur={(e) => addCustom(e.currentTarget.value)}
        />
      </div>
    </div>
  );
}

function DashboardTab({ agents }: { agents: Agent[] }) {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;

  useEffect(() => {
    if (activeAgentId && !agents.some((agent) => agent.id === activeAgentId)) {
      setActiveAgentId(null);
    }
  }, [activeAgentId, agents]);

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground">Dashboard</h2>
          <p className="text-muted-foreground text-sm">System activity</p>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-secondary text-foreground hover:bg-accent transition-colors border border-border">
              <Bot size={13} className="text-muted-foreground" />
              {activeAgent ? activeAgent.name : "Agents"}
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-44 rounded-lg border border-border bg-popover p-1 shadow-xl"
            >
              {agents.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No agents configured</div>
              ) : (
                <>
                  <DropdownMenu.Item
                    onSelect={() => setActiveAgentId(null)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer outline-none transition-colors",
                      activeAgentId === null ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    None
                    {activeAgentId === null && <Check size={12} />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  {agents.map((a) => (
                    <DropdownMenu.Item
                      key={a.id}
                      onSelect={() => setActiveAgentId(a.id)}
                      className={cn(
                        "flex items-center justify-between gap-6 px-3 py-2 rounded-md text-sm cursor-pointer outline-none transition-colors",
                        activeAgentId === a.id ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      <span>{a.name}</span>
                      {activeAgentId === a.id && <Check size={12} />}
                    </DropdownMenu.Item>
                  ))}
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {activeAgent && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border w-fit">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">
            Active: <span className="text-foreground">{activeAgent.name}</span>
          </span>
          {activeAgent.model && (
            <span className="text-xs text-muted-foreground">· {activeAgent.model}</span>
          )}
        </div>
      )}

      <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden">
        <Visualizer />
      </div>
    </div>
  );
}

function AddAgentDialog({
  open,
  onOpenChange,
  onAdd,
  savedSkills,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (agent: Agent) => void;
  savedSkills: string[];
}) {
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [mcp, setMcp] = useState<string[]>([]);

  const reset = () => { setName(""); setModel(""); setSkills([]); setMcp([]); };

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ id: Date.now().toString(), name: name.trim(), model, skills, mcp });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-foreground">New Agent</Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Configure a new agent with a name, model, skills, and MCP servers.</Dialog.Description>

          <div className="flex flex-col gap-4">
            <Input label="Agent name" placeholder="my-agent" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Model" placeholder="gpt-4o, claude-sonnet…" value={model} onChange={(e) => setModel(e.target.value)} />
            <SkillsPicker savedSkills={savedSkills} values={skills} onChange={setSkills} />
            <TagInput label="MCP servers" values={mcp} onChange={setMcp} placeholder="Add MCP server, press Enter" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { reset(); onOpenChange(false); }} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Cancel
            </button>
            <button onClick={submit} disabled={!name.trim()} className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
              Create agent
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AgentsTab({
  agents,
  setAgents,
  savedSkills,
}: {
  agents: Agent[];
  setAgents: Dispatch<SetStateAction<Agent[]>>;
  savedSkills: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground">Agents</h2>
          <p className="text-muted-foreground text-sm">{agents.length} agent{agents.length !== 1 ? "s" : ""} configured</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
          <Plus size={14} /> Add new
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
            <Bot size={20} className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No agents yet</p>
          <button onClick={() => setOpen(true)} className="text-sm text-foreground underline-offset-2 hover:underline">
            Create your first agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 content-start overflow-y-auto">
          {agents.map((a) => <AgentCard key={a.id} agent={a} />)}
        </div>
      )}

      <AddAgentDialog open={open} onOpenChange={setOpen} onAdd={(a) => setAgents((p) => [...p, a])} savedSkills={savedSkills} />
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="pb-4 border-b border-border">
      <h3 className="text-foreground">{title}</h3>
      {description && <p className="text-muted-foreground text-sm mt-0.5">{description}</p>}
    </div>
  );
}

function AddModelDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (v: boolean) => void; onAdd: (m: Model) => void }) {
  const [form, setForm] = useState({ name: "", provider: "", url: "", apiKey: "" });
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    if (!form.name.trim()) return;
    onAdd({ id: Date.now().toString(), ...form });
    setForm({ name: "", provider: "", url: "", apiKey: "" });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-foreground">Add Model</Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Add a new LLM model with provider, endpoint URL, and API key.</Dialog.Description>
          <div className="flex flex-col gap-4">
            <Input label="Model name" placeholder="GPT-4o" value={form.name} onChange={set("name")} />
            <Input label="Provider" placeholder="OpenAI, Anthropic…" value={form.provider} onChange={set("provider")} />
            <Input label="URL / endpoint" placeholder="https://api.openai.com/v1" value={form.url} onChange={set("url")} />
            <Input label="API key" type="password" placeholder="sk-…" value={form.apiKey} onChange={set("apiKey")} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Cancel</button>
            <button onClick={submit} disabled={!form.name.trim()} className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">Add model</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddMcpDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (v: boolean) => void; onAdd: (m: McpServer) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ id: Date.now().toString(), name: name.trim(), url: url.trim() });
    setName("");
    setUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-foreground">Add MCP Server</Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Add a new MCP server by name and URL.</Dialog.Description>
          <div className="flex flex-col gap-4">
            <Input label="Server name" placeholder="my-mcp-server" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Server URL" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Cancel</button>
            <button onClick={submit} disabled={!name.trim()} className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">Add server</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingsTab({
  savedSkills,
  setSavedSkills,
  models,
  setModels,
  mcpServers,
  setMcpServers,
  githubConnected,
  setGithubConnected,
  googleConnected,
  setGoogleConnected,
}: {
  savedSkills: string[];
  setSavedSkills: Dispatch<SetStateAction<string[]>>;
  models: Model[];
  setModels: Dispatch<SetStateAction<Model[]>>;
  mcpServers: McpServer[];
  setMcpServers: Dispatch<SetStateAction<McpServer[]>>;
  githubConnected: boolean;
  setGithubConnected: Dispatch<SetStateAction<boolean>>;
  googleConnected: boolean;
  setGoogleConnected: Dispatch<SetStateAction<boolean>>;
}) {
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [addMcpOpen, setAddMcpOpen] = useState(false);
  const skillInputRef = useRef<HTMLInputElement>(null);

  const addSkill = (raw: string) => {
    const val = raw.trim();
    if (val && !savedSkills.includes(val)) setSavedSkills((p) => [...p, val]);
    if (skillInputRef.current) skillInputRef.current.value = "";
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto flex flex-col gap-10 p-6">
        <section className="flex flex-col gap-5">
          <SectionHeader title="Account" description="Sign in to sync your configuration across devices." />
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <User size={14} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-foreground">{googleConnected ? "Connected" : "Not signed in"}</p>
                <p className="text-xs text-muted-foreground">Google account</p>
              </div>
            </div>
            <button
              onClick={() => setGoogleConnected((p) => !p)}
              className={cn("px-3 py-1.5 rounded-md text-sm transition-colors", googleConnected ? "bg-secondary text-muted-foreground hover:text-foreground" : "bg-primary text-primary-foreground hover:opacity-90")}
            >
              {googleConnected ? "Sign out" : "Sign in with Google"}
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h3 className="text-foreground">Models</h3>
              <p className="text-muted-foreground text-sm mt-0.5">Configure LLM providers and endpoints.</p>
            </div>
            <button onClick={() => setAddModelOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-secondary text-foreground hover:bg-accent transition-colors">
              <Plus size={13} /> Add new
            </button>
          </div>
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">No models added yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {models.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Cpu size={14} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.provider}</p>
                    </div>
                  </div>
                  <button onClick={() => setModels((p) => p.filter((x) => x.id !== m.id))} className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h3 className="text-foreground">Skills</h3>
              <p className="text-muted-foreground text-sm mt-0.5">Save reusable skills to attach to agents.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {savedSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {savedSkills.map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-secondary border border-border text-foreground">
                    <Wrench size={10} className="text-muted-foreground" />
                    {s}
                    <button onClick={() => setSavedSkills((p) => p.filter((x) => x !== s))} className="text-muted-foreground hover:text-foreground ml-0.5 transition-colors">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={skillInputRef}
                placeholder="New skill name…"
                className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(e.currentTarget.value); } }}
              />
              <button
                onClick={() => skillInputRef.current && addSkill(skillInputRef.current.value)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-secondary text-foreground hover:bg-accent transition-colors border border-border"
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <SectionHeader title="Integrations" description="Connect external services." />
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <Github size={16} className="text-foreground shrink-0" />
              <div>
                <p className="text-sm text-foreground">GitHub</p>
                <p className="text-xs text-muted-foreground">{githubConnected ? "Connected" : "Access repositories and issues"}</p>
              </div>
            </div>
            <button
              onClick={() => setGithubConnected((p) => !p)}
              className="px-3 py-1.5 rounded-md text-sm bg-secondary text-foreground hover:bg-accent transition-colors"
            >
              {githubConnected ? "Disconnect" : "Connect"}
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h3 className="text-foreground">MCP</h3>
              <p className="text-muted-foreground text-sm mt-0.5">Model context protocol servers.</p>
            </div>
            <button onClick={() => setAddMcpOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-secondary text-foreground hover:bg-accent transition-colors">
              <Plus size={13} /> Add new
            </button>
          </div>
          {mcpServers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No MCP servers configured.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {mcpServers.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Server size={14} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.url || "No URL"}</p>
                    </div>
                  </div>
                  <button onClick={() => setMcpServers((p) => p.filter((x) => x.id !== s.id))} className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AddModelDialog open={addModelOpen} onOpenChange={setAddModelOpen} onAdd={(m) => setModels((p) => [...p, m])} />
      <AddMcpDialog open={addMcpOpen} onOpenChange={setAddMcpOpen} onAdd={(m) => setMcpServers((p) => [...p, m])} />
    </div>
  );
}

const NAV_TABS = [
  { id: "dashboard", label: "Dashboard", icon: Layers },
  { id: "orchestra", label: "Orchestra", icon: Network },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "settings", label: "Settings", icon: Cpu },
] as const;

type TabId = typeof NAV_TABS[number]["id"];

const EMPTY_STATE: PersistedAppState = {
  agents: [],
  models: [],
  mcpServers: [],
  savedSkills: [],
  orchestrations: [],
  githubConnected: false,
  googleConnected: false,
};

export default function App() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [agents, setAgents] = useState<Agent[]>(EMPTY_STATE.agents);
  const [models, setModels] = useState<Model[]>(EMPTY_STATE.models);
  const [mcpServers, setMcpServers] = useState<McpServer[]>(EMPTY_STATE.mcpServers);
  const [savedSkills, setSavedSkills] = useState<string[]>(EMPTY_STATE.savedSkills);
  const [orchestrations, setOrchestrations] = useState<Orchestration[]>(EMPTY_STATE.orchestrations);
  const [githubConnected, setGithubConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadAppState()
      .then((state) => {
        if (cancelled) return;
        setAgents(state.agents);
        setModels(state.models);
        setMcpServers(state.mcpServers);
        setSavedSkills(state.savedSkills);
        setOrchestrations(state.orchestrations);
        setGithubConnected(state.githubConnected);
        setGoogleConnected(state.googleConnected);
        setIsHydrated(true);
      })
      .catch((error) => {
        console.error("Failed to load app state", error);
        if (!cancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const state: PersistedAppState = {
      agents,
      models,
      mcpServers,
      savedSkills,
      orchestrations,
      githubConnected,
      googleConnected,
    };

    saveAppState(state).catch((error) => {
      console.error("Failed to save app state", error);
    });
  }, [agents, models, mcpServers, savedSkills, orchestrations, githubConnected, googleConnected, isHydrated]);

  return (
    <div className="dark size-full bg-background text-foreground flex overflow-hidden select-none">
      <aside className="w-52 shrink-0 flex flex-col border-r border-border bg-card">
        <div className="px-5 py-5 border-b border-border">
          <p className="text-foreground tracking-tight">Foundry</p>
          <p className="text-xs text-muted-foreground">v0.1.0</p>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-0.5 pt-3">
          {NAV_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full text-left transition-colors",
                tab === id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-hidden">
        {tab === "dashboard" && <DashboardTab agents={agents} />}
        {tab === "orchestra" && <OrchestraTab agents={agents} orchs={orchestrations} setOrchs={setOrchestrations} />}
        {tab === "agents" && <AgentsTab agents={agents} setAgents={setAgents} savedSkills={savedSkills} />}
        {tab === "settings" && (
          <SettingsTab
            savedSkills={savedSkills}
            setSavedSkills={setSavedSkills}
            models={models}
            setModels={setModels}
            mcpServers={mcpServers}
            setMcpServers={setMcpServers}
            githubConnected={githubConnected}
            setGithubConnected={setGithubConnected}
            googleConnected={googleConnected}
            setGoogleConnected={setGoogleConnected}
          />
        )}
      </main>
    </div>
  );
}
