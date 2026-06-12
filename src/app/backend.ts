import { invoke } from "@tauri-apps/api/core";
import type { GeneratedWorkflowRun, Orchestration, PersistedAppState } from "./types";

const STORAGE_KEY = "foundry-app-state";

const EMPTY_STATE: PersistedAppState = {
  agents: [],
  models: [],
  mcpServers: [],
  savedSkills: [],
  orchestrations: [],
  githubConnected: false,
  googleConnected: false,
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function normalizeState(value: Partial<PersistedAppState> | null | undefined): PersistedAppState {
  return {
    agents: value?.agents ?? [],
    models: value?.models ?? [],
    mcpServers: value?.mcpServers ?? [],
    savedSkills: value?.savedSkills ?? [],
    orchestrations: value?.orchestrations ?? [],
    githubConnected: value?.githubConnected ?? false,
    googleConnected: value?.googleConnected ?? false,
  };
}

export async function loadAppState(): Promise<PersistedAppState> {
  if (isTauriRuntime()) {
    const state = await invoke<PersistedAppState>("load_app_state");
    return normalizeState(state);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveAppState(state: PersistedAppState): Promise<void> {
  const normalized = normalizeState(state);

  if (isTauriRuntime()) {
    await invoke("save_app_state", { state: normalized });
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export async function generateWorkflowRun(orchestration: Orchestration): Promise<GeneratedWorkflowRun> {
  if (isTauriRuntime()) {
    return invoke<GeneratedWorkflowRun>("generate_workflow_run", { orchestration });
  }

  const startedAt = new Date().toISOString();
  const nodeOutputs = Object.fromEntries(
    orchestration.nodes.map((node, index) => [
      node.id,
      `Agent "${node.agentName}" completed mock execution.\n\nLocal fallback output #${index + 1}.`,
    ])
  );

  return {
    nodeOutputs,
    run: {
      id: `${Date.now()}`,
      startedAt,
      durationMs: Math.max(700, orchestration.nodes.length * 450),
      status: "success",
      output: Object.entries(nodeOutputs)
        .map(([nodeId, output]) => {
          const node = orchestration.nodes.find((entry) => entry.id === nodeId);
          return `## ${node?.agentName ?? nodeId}\n\n${output}`;
        })
        .join("\n\n---\n\n"),
      nodeOutputs,
    },
  };
}
