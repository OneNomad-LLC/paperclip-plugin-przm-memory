import { definePlugin, runWorker, type PluginContext, type ToolResult, type ToolRunContext } from "@paperclipai/plugin-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

type Params = Record<string, unknown>;

interface Config {
  command: string;
  args: string[];
  env: Record<string, string>;
  domain: "project-url-key" | "project-name";
  saveFinishedIssues: boolean;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const toolError = (error: string): ToolResult => ({ error, content: error });

function slugify(s: string): string {
  const slug = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "project";
}

async function loadConfig(ctx: PluginContext, companyId?: string): Promise<Config> {
  const raw = (await ctx.config.get(companyId).catch(() => ({}))) as Params;
  const envRaw = raw.env && typeof raw.env === "object" ? (raw.env as Record<string, unknown>) : {};
  return {
    command: str(raw.command) || "przm-memory",
    args: Array.isArray(raw.args) ? (raw.args as unknown[]).map(String) : [],
    env: Object.fromEntries(Object.entries(envRaw).map(([k, v]) => [k, String(v)])),
    domain: raw.domain === "project-name" ? "project-name" : "project-url-key",
    saveFinishedIssues: raw.saveFinishedIssues !== false,
  };
}

// A single long-lived MCP client for the whole worker process. przm Memory is a
// local stdio process; there is no reason to spawn one per tool call, and other
// clients (Claude Code, other plugins) may already be talking to the same store.
let client: Client | null = null;
let connecting: Promise<Client> | null = null;

async function getClient(ctx: PluginContext): Promise<Client> {
  if (client) return client;
  if (connecting) return connecting;
  connecting = (async () => {
    const config = await loadConfig(ctx);
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...getDefaultEnvironment(), ...config.env },
    });
    const c = new Client({ name: "paperclip-przm-memory", version: "0.1.0" });
    await c.connect(transport);
    client = c;
    return c;
  })();
  try {
    return await connecting;
  } catch (e) {
    connecting = null;
    throw e;
  } finally {
    connecting = null;
  }
}

interface CallResult {
  text: string;
  isError: boolean;
}

async function callMemoryTool(ctx: PluginContext, name: string, args: Params): Promise<CallResult> {
  try {
    const c = await getClient(ctx);
    const res = await c.callTool({ name, arguments: args });
    const blocks = Array.isArray(res.content) ? res.content : [];
    const text = blocks
      .map((b) => (b && typeof b === "object" && (b as Params).type === "text" ? String((b as Params).text ?? "") : ""))
      .filter(Boolean)
      .join("\n");
    return { text: text || "(no content)", isError: Boolean(res.isError) };
  } catch (e) {
    // The process may have died or the store may be in a bad state. Drop the
    // client so the next call reconnects instead of reusing a broken pipe.
    client = null;
    const message = e instanceof Error ? e.message : String(e);
    return { text: `przm Memory error: ${message}`, isError: true };
  }
}

async function domainForProject(ctx: PluginContext, companyId: string, projectId: string | null | undefined): Promise<string> {
  if (!projectId) return "paperclip";
  const config = await loadConfig(ctx, companyId);
  const project = await ctx.projects.get(projectId, companyId).catch(() => null);
  if (!project) return "paperclip";
  return config.domain === "project-name" ? slugify(project.name) : project.urlKey || slugify(project.name);
}

async function resolveDomain(ctx: PluginContext, run: ToolRunContext, override?: string): Promise<string> {
  if (override) return override;
  return domainForProject(ctx, run.companyId, run.projectId);
}

// Captured in setup so onHealth (which the host calls with no arguments) can
// still ask for a connection.
let workerCtx: PluginContext | null = null;

const plugin = definePlugin({
  async setup(ctx) {
    workerCtx = ctx;

    // ---------- agent tools ----------

    ctx.tools.register(
      "memory_search",
      {
        displayName: "Search memory",
        description: "Search przm Memory for facts, preferences, decisions, and context relevant to a query. Domain defaults to this project.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            maxResults: { type: "number" },
            domain: { type: "string" },
          },
          required: ["query"],
        },
      },
      async (params, run) => {
        const p = (params ?? {}) as Params;
        const query = str(p.query);
        if (!query) return toolError("query is required.");
        const domain = await resolveDomain(ctx, run, str(p.domain) || undefined);
        // Deliberately not using memory-search's format=true here: when a
        // domain-scoped query has zero semantic matches, the formatted output
        // falls back to dumping every procedural rule across every domain,
        // not just this one (verified against a live server). The plain JSON
        // result respects the domain filter correctly in the same case.
        const args: Params = { query, domain };
        if (typeof p.maxResults === "number") args.maxResults = p.maxResults;
        const { text, isError } = await callMemoryTool(ctx, "memory-search", args);
        return isError ? toolError(text) : { content: text };
      },
    );

    ctx.tools.register(
      "memory_save",
      {
        displayName: "Save memory",
        description: "Save a fact, preference, decision, or piece of context to przm Memory. Domain defaults to this project.",
        parametersSchema: {
          type: "object",
          properties: {
            content: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            domain: { type: "string" },
          },
          required: ["content"],
        },
      },
      async (params, run) => {
        const p = (params ?? {}) as Params;
        const content = str(p.content);
        if (!content) return toolError("content is required.");
        const domain = await resolveDomain(ctx, run, str(p.domain) || undefined);
        const args: Params = { content, domain };
        if (Array.isArray(p.tags)) args.tags = (p.tags as unknown[]).map(String);
        const { text, isError } = await callMemoryTool(ctx, "memory-ingest", args);
        return isError ? toolError(text) : { content: text };
      },
    );

    ctx.tools.register(
      "memory_handoff_write",
      {
        displayName: "Write memory handoff",
        description: "Write a structured handoff snapshot to przm Memory: what's done, what's next, open questions. Use before ending a long-running task so a later run can pick it up.",
        parametersSchema: {
          type: "object",
          properties: {
            currentTask: { type: "string" },
            name: { type: "string" },
            completed: { type: "array", items: { type: "string" } },
            nextSteps: { type: "array", items: { type: "string" } },
            openQuestions: { type: "array", items: { type: "string" } },
            fileRefs: { type: "array", items: { type: "string" } },
            decisions: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
          },
          required: ["currentTask"],
        },
      },
      async (params) => {
        const p = (params ?? {}) as Params;
        const currentTask = str(p.currentTask);
        if (!currentTask) return toolError("currentTask is required.");
        const args: Params = { currentTask, reason: "manual" };
        if (typeof p.name === "string" && p.name) args.name = p.name;
        if (typeof p.notes === "string" && p.notes) args.notes = p.notes;
        for (const key of ["completed", "nextSteps", "openQuestions", "fileRefs", "decisions"] as const) {
          if (Array.isArray(p[key])) args[key] = (p[key] as unknown[]).map(String);
        }
        const { text, isError } = await callMemoryTool(ctx, "memory-handoff-write", args);
        return isError ? toolError(text) : { content: text };
      },
    );

    ctx.tools.register(
      "memory_handoff_read",
      {
        displayName: "Read memory handoff",
        description: "Read the latest przm Memory handoff, or one by name, to pick up context from a previous run.",
        parametersSchema: {
          type: "object",
          properties: { name: { type: "string" } },
        },
      },
      async (params) => {
        const p = (params ?? {}) as Params;
        const args: Params = {};
        if (typeof p.name === "string" && p.name) args.name = p.name;
        const { text, isError } = await callMemoryTool(ctx, "memory-handoff-read", args);
        return isError ? toolError(text) : { content: text };
      },
    );

    // ---------- issue done -> memory ----------

    ctx.events.on("issue.updated", async (event) => {
      const issueId = event.entityId;
      const companyId = event.companyId;
      if (!issueId || !companyId || (event.entityType && event.entityType !== "issue")) return;
      const config = await loadConfig(ctx, companyId);
      if (!config.saveFinishedIssues) return;

      const issue = await ctx.issues.get(issueId, companyId).catch(() => null);
      if (!issue || issue.status !== "done") return;

      const flagKey = { scopeKind: "issue" as const, scopeId: issueId, stateKey: "outcome-saved" };
      const alreadySaved = await ctx.state.get(flagKey).catch(() => null);
      if (alreadySaved) return;
      // Set the flag before the write completes so a burst of issue.updated
      // events for the same transition can't race into two saves.
      await ctx.state.set(flagKey, true).catch((e) => ctx.logger.warn(`przm-memory: failed to set outcome flag: ${e}`));

      const comments = await ctx.issues.listComments(issueId, companyId).catch(() => []);
      const lastAgentComment = [...comments].reverse().find((c) => c.authorType === "agent" && !c.deletedAt);
      const outcome = (lastAgentComment?.body ?? "").trim().replace(/\s+/g, " ").slice(0, 800);

      const identifier = issue.identifier || issue.id;
      const domain = await domainForProject(ctx, companyId, issue.projectId);
      const content = `${identifier}: ${issue.title}${outcome ? ` — ${outcome}` : ""}`;

      const { isError, text } = await callMemoryTool(ctx, "memory-ingest", {
        content,
        domain,
        type: "context",
        tags: [identifier].filter(Boolean),
        source: `paperclip:${issue.id}`,
      });
      if (isError) {
        ctx.logger.warn(`przm-memory: failed to save outcome for ${identifier}: ${text}`);
        await ctx.state.delete(flagKey).catch(() => {});
      }
    });

    // ---------- data for plugin UI ----------

    ctx.data.register("connectionStatus", async () => {
      try {
        const c = await getClient(ctx);
        const tools = await c.listTools();
        const server = c.getServerVersion();
        return { ok: true, message: null, toolCount: tools.tools.length, serverVersion: server?.version ?? null };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, message, toolCount: 0, serverVersion: null };
      }
    });

    ctx.data.register("projectContext", async (params) => {
      const p = (params ?? {}) as Params;
      const companyId = str(p.companyId);
      const projectId = str(p.projectId);
      if (!companyId || !projectId) return null;
      const project = await ctx.projects.get(projectId, companyId).catch(() => null);
      if (!project) return null;
      const domain = await domainForProject(ctx, companyId, projectId);
      return { name: project.name, domain };
    });

    ctx.data.register("issueContext", async (params) => {
      const p = (params ?? {}) as Params;
      const companyId = str(p.companyId);
      const issueId = str(p.issueId);
      if (!companyId || !issueId) return null;
      const issue = await ctx.issues.get(issueId, companyId).catch(() => null);
      if (!issue) return null;
      const domain = await domainForProject(ctx, companyId, issue.projectId);
      return { identifier: issue.identifier || issue.id, title: issue.title, domain };
    });

    ctx.data.register("search", async (params) => {
      const p = (params ?? {}) as Params;
      const query = str(p.query);
      const domain = str(p.domain);
      if (!query) return null;
      // See the memory_search tool above: format=true is avoided on purpose.
      const args: Params = { query, maxResults: 10 };
      if (domain) args.domain = domain;
      const { text, isError } = await callMemoryTool(ctx, "memory-search", args);
      return { text, isError };
    });

    // ---------- actions for plugin UI ----------

    ctx.actions.register("saveNote", async (params) => {
      const p = (params ?? {}) as Params;
      const content = str(p.content);
      if (!content) throw new Error("content is required.");
      const args: Params = { content };
      if (typeof p.domain === "string" && p.domain) args.domain = p.domain;
      if (Array.isArray(p.tags)) args.tags = (p.tags as unknown[]).map(String);
      const { text, isError } = await callMemoryTool(ctx, "memory-ingest", args);
      if (isError) throw new Error(text);
      return { text };
    });
  },

  async onHealth() {
    if (!workerCtx) return { status: "degraded", message: "Worker not set up yet." };
    try {
      const c = await getClient(workerCtx);
      await c.listTools();
      return { status: "ok" };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { status: "error", message };
    }
  },

  async onShutdown() {
    if (client) {
      await client.close().catch(() => {});
      client = null;
    }
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
