export interface Agent {
  id: string;
  name: string;
  model: string;
  skills: string[];
  mcp: string[];
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  url: string;
  apiKey: string;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
}

export interface WFNode {
  id: string;
  agentId: string;
  agentName: string;
  x: number;
  y: number;
}

export interface WFEdge {
  id: string;
  from: string;
  to: string;
}

export type NodeStatus = "idle" | "pending" | "running" | "done" | "error";

export interface Run {
  id: string;
  startedAt: string;
  durationMs: number;
  status: "success" | "error";
  output: string;
  nodeOutputs: Record<string, string>;
}

export interface Orchestration {
  id: string;
  name: string;
  nodes: WFNode[];
  edges: WFEdge[];
  conductorId?: string;
  textDef?: string;
  runs: Run[];
}

export interface PersistedAppState {
  agents: Agent[];
  models: Model[];
  mcpServers: McpServer[];
  savedSkills: string[];
  orchestrations: Orchestration[];
  githubConnected: boolean;
  googleConnected: boolean;
}

export interface GeneratedWorkflowRun {
  run: Run;
  nodeOutputs: Record<string, string>;
}
