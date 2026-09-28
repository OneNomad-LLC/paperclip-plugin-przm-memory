import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "onenomad-przm-memory",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "przm Memory",
  description: "Give Paperclip agents long-term memory with przm Memory: search and save memories as agent tools, see related memories on issues, and save outcomes of finished issues automatically.",
  author: "OneNomad",
  categories: ["connector", "automation"],
  capabilities: [
    "projects.read",
    "issues.read",
    "issue.comments.read",
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "agent.tools.register",
    "ui.detailTab.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        default: "przm-memory",
        description: "Command that starts the przm Memory MCP server on this machine.",
      },
      args: {
        type: "array",
        items: { type: "string" },
        default: [],
        description: "Extra arguments passed to the command.",
        "x-paperclip-advanced": true,
      },
      env: {
        type: "object",
        additionalProperties: { type: "string" },
        default: {},
        description: "Extra environment variables for the przm Memory process (e.g. ENGRAM_DATA_DIR).",
        "x-paperclip-advanced": true,
      },
      domain: {
        type: "string",
        enum: ["project-url-key", "project-name"],
        default: "project-url-key",
        description: "How to name the memory domain for a project: its Paperclip URL key, or a slug of its name.",
        "x-paperclip-advanced": true,
      },
      saveFinishedIssues: {
        type: "boolean",
        default: true,
        description: "When an issue moves to done, save a short memory of the identifier, title, and outcome.",
      },
    },
  },
  tools: [
    {
      name: "memory_search",
      displayName: "Search memory",
      description: "Search przm Memory for facts, preferences, decisions, and context relevant to a query. Domain defaults to this project.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language search query." },
          maxResults: { type: "number", description: "Max results to return (default 10)." },
          domain: { type: "string", description: "Memory domain to search. Defaults to this project's domain." },
        },
        required: ["query"],
      },
    },
    {
      name: "memory_save",
      displayName: "Save memory",
      description: "Save a fact, preference, decision, or piece of context to przm Memory. Domain defaults to this project.",
      parametersSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "The memory to store." },
          tags: { type: "array", items: { type: "string" }, description: "Tags for the memory." },
          domain: { type: "string", description: "Memory domain to save under. Defaults to this project's domain." },
        },
        required: ["content"],
      },
    },
    {
      name: "memory_handoff_write",
      displayName: "Write memory handoff",
      description: "Write a structured handoff snapshot to przm Memory: what's done, what's next, open questions. Use before ending a long-running task so a later run can pick it up.",
      parametersSchema: {
        type: "object",
        properties: {
          currentTask: { type: "string", description: "One-sentence description of what is being worked on." },
          name: { type: "string", description: "Optional checkpoint name for later lookup." },
          completed: { type: "array", items: { type: "string" }, description: "What has been completed so far." },
          nextSteps: { type: "array", items: { type: "string" }, description: "Concrete next actions." },
          openQuestions: { type: "array", items: { type: "string" }, description: "Unresolved questions or blockers." },
          fileRefs: { type: "array", items: { type: "string" }, description: "File paths the next run needs." },
          decisions: { type: "array", items: { type: "string" }, description: "Key decisions made." },
          notes: { type: "string", description: "Free-form additional context." },
        },
        required: ["currentTask"],
      },
    },
    {
      name: "memory_handoff_read",
      displayName: "Read memory handoff",
      description: "Read the latest przm Memory handoff, or one by name, to pick up context from a previous run.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Named checkpoint to load. Omit for the most recent one." },
        },
      },
    },
  ],
  ui: {
    slots: [
      { type: "detailTab", id: "przm-memory-issue-tab", displayName: "Memory", exportName: "IssueMemoryTab", entityTypes: ["issue"] },
      { type: "detailTab", id: "przm-memory-project-tab", displayName: "Memory", exportName: "ProjectMemoryTab", entityTypes: ["project"] },
    ],
  },
};

export default manifest;
