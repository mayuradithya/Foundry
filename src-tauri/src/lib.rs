use std::{fs, path::PathBuf, sync::Mutex};

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

const CREATE_STATE_TABLE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
"#;

#[derive(Default, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PersistedAppState {
  agents: Vec<Agent>,
  models: Vec<Model>,
  mcp_servers: Vec<McpServer>,
  saved_skills: Vec<String>,
  orchestrations: Vec<Orchestration>,
  github_connected: bool,
  google_connected: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Agent {
  id: String,
  name: String,
  model: String,
  skills: Vec<String>,
  mcp: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Model {
  id: String,
  name: String,
  provider: String,
  url: String,
  api_key: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct McpServer {
  id: String,
  name: String,
  url: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WFNode {
  id: String,
  agent_id: String,
  agent_name: String,
  x: f64,
  y: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WFEdge {
  id: String,
  from: String,
  to: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Run {
  id: String,
  started_at: String,
  duration_ms: u64,
  status: String,
  output: String,
  node_outputs: std::collections::BTreeMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Orchestration {
  id: String,
  name: String,
  nodes: Vec<WFNode>,
  edges: Vec<WFEdge>,
  conductor_id: Option<String>,
  text_def: Option<String>,
  runs: Vec<Run>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GeneratedWorkflowRun {
  run: Run,
  node_outputs: std::collections::BTreeMap<String, String>,
}

struct AppDatabase {
  connection: Mutex<Connection>,
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("failed to resolve app data dir: {error}"))?;

  fs::create_dir_all(&app_data_dir)
    .map_err(|error| format!("failed to create app data dir {}: {error}", app_data_dir.display()))?;

  Ok(app_data_dir.join("foundry.sqlite"))
}

fn load_state(connection: &Connection) -> Result<PersistedAppState, String> {
  let mut stmt = connection
    .prepare("SELECT payload FROM app_state WHERE id = 1")
    .map_err(|error| format!("failed to prepare load query: {error}"))?;

  let mut rows = stmt
    .query([])
    .map_err(|error| format!("failed to execute load query: {error}"))?;

  match rows.next().map_err(|error| format!("failed to read state row: {error}"))? {
    Some(row) => {
      let payload: String = row.get(0).map_err(|error| format!("failed to read payload column: {error}"))?;
      serde_json::from_str(&payload).map_err(|error| format!("failed to deserialize stored state: {error}"))
    }
    None => Ok(PersistedAppState::default()),
  }
}

fn save_state(connection: &Connection, state: &PersistedAppState) -> Result<(), String> {
  let payload = serde_json::to_string(state).map_err(|error| format!("failed to serialize app state: {error}"))?;
  let updated_at = Utc::now().to_rfc3339();

  connection
    .execute(
      "INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?1, ?2)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
      params![payload, updated_at],
    )
    .map_err(|error| format!("failed to persist app state: {error}"))?;

  Ok(())
}

#[tauri::command]
fn load_app_state(database: State<'_, AppDatabase>) -> Result<PersistedAppState, String> {
  let connection = database
    .connection
    .lock()
    .map_err(|_| String::from("database lock poisoned"))?;

  load_state(&connection)
}

#[tauri::command]
fn save_app_state(state: PersistedAppState, database: State<'_, AppDatabase>) -> Result<(), String> {
  let connection = database
    .connection
    .lock()
    .map_err(|_| String::from("database lock poisoned"))?;

  save_state(&connection, &state)
}

#[tauri::command]
fn generate_workflow_run(orchestration: Orchestration) -> Result<GeneratedWorkflowRun, String> {
  let node_outputs = orchestration
    .nodes
    .iter()
    .enumerate()
    .map(|(index, node)| {
      let text = match index % 3 {
        0 => format!(
          "Agent \"{}\" completed analysis.\n\nKey findings:\n• Workflow: {}\n• Connected edges: {}\n• Suggested action: Continue to next node.",
          node.agent_name,
          orchestration.name,
          orchestration.edges.len()
        ),
        1 => format!(
          "\"{}\" returned structured output.\n\n{{\n  \"status\": \"ok\",\n  \"node\": \"{}\",\n  \"summary\": \"Processed local context successfully\",\n  \"nextAction\": \"forward\"\n}}",
          node.agent_name, node.id
        ),
        _ => format!(
          "{} execution log:\n[INFO] Loaded local orchestration context\n[INFO] Evaluated {} peer nodes\n[OK] Task complete",
          node.agent_name,
          orchestration.nodes.len().saturating_sub(1)
        ),
      };
      (node.id.clone(), text)
    })
    .collect::<std::collections::BTreeMap<_, _>>();

  let output = orchestration
    .nodes
    .iter()
    .map(|node| {
      format!(
        "## {}\n\n{}",
        node.agent_name,
        node_outputs.get(&node.id).cloned().unwrap_or_else(|| String::from("No output"))
      )
    })
    .collect::<Vec<_>>()
    .join("\n\n---\n\n");

  let run = Run {
    id: Utc::now().timestamp_millis().to_string(),
    started_at: Utc::now().to_rfc3339(),
    duration_ms: (orchestration.nodes.len().max(1) as u64) * 850,
    status: String::from("success"),
    output,
    node_outputs: node_outputs.clone(),
  };

  Ok(GeneratedWorkflowRun { run, node_outputs })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let db_path = database_path(app.handle())?;
      let connection = Connection::open(db_path)
        .map_err(|error| format!("failed to open sqlite database: {error}"))?;
      connection
        .execute(CREATE_STATE_TABLE_SQL, [])
        .map_err(|error| format!("failed to initialize sqlite schema: {error}"))?;

      app.manage(AppDatabase {
        connection: Mutex::new(connection),
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      load_app_state,
      save_app_state,
      generate_workflow_run
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
