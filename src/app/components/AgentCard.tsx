import { Bot, Cpu, Plug, Wrench } from "lucide-react";
import type { Agent } from "../types";

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4 hover:border-zinc-600 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
          <Bot size={16} className="text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-foreground truncate">{agent.name}</p>
          <p className="text-muted-foreground text-xs truncate flex items-center gap-1">
            <Cpu size={10} /> {agent.model}
          </p>
        </div>
      </div>

      {(agent.skills.length > 0 || agent.mcp.length > 0) && (
        <div className="flex flex-col gap-2">
          {agent.skills.length > 0 && (
            <div className="flex items-center gap-2">
              <Wrench size={11} className="text-muted-foreground shrink-0" />
              <div className="flex flex-wrap gap-1">
                {agent.skills.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {agent.mcp.length > 0 && (
            <div className="flex items-center gap-2">
              <Plug size={11} className="text-muted-foreground shrink-0" />
              <div className="flex flex-wrap gap-1">
                {agent.mcp.map((m) => (
                  <span
                    key={m}
                    className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
