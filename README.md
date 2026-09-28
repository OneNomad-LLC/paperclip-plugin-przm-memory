# przm Memory for Paperclip

Connects [Paperclip](https://paperclip.ai) agents to [przm Memory](https://github.com/OneNomad-LLC/przm-memory), a local, long-term memory server. Agents get `memory_search` and `memory_save` tools, issues get a "Memory" tab showing related memories with a form to save notes, and finished issues can save their own outcome automatically.

## What it does

- **Agent tools**: `memory_search`, `memory_save`, `memory_handoff_write`, `memory_handoff_read`. Domain defaults to the running project so agents don't have to think about it.
- **Issue tab "Memory"**: related memories for the issue (searched by its identifier and title), plus a small form to save a note.
- **Project tab "Memory"**: connection status, the memory domain used for the project, and a search box.
- **Automatic outcome saving**: when an issue moves to `done`, saves one memory with the issue's identifier, title, and the last agent comment (trimmed), tagged with the identifier. Guarded so it only happens once per issue.

## Requirement

przm Memory has to be installed and runnable on the machine where Paperclip's plugin worker runs:

```
npm i -g @onenomad/przm-memory
```

By default the plugin runs it as `przm-memory` on `PATH`. Override the command, arguments, or environment in the plugin's instance config if it's installed somewhere else.

The plugin and any other MCP client pointed at the same `przm-memory` data directory (Claude Code, another Paperclip instance, etc.) share the same local store. That's normal — it's the same memory.

## Install

```
paperclipai plugin install @onenomad/paperclip-plugin-przm-memory
```

## Config

| Field | Default | Notes |
|---|---|---|
| `command` | `przm-memory` | Executable to spawn. |
| `args` | `[]` | Extra CLI arguments. |
| `env` | `{}` | Extra environment variables (e.g. `ENGRAM_DATA_DIR`), merged on top of a safe inherited environment. |
| `domain` | `project-url-key` | How to name a project's memory domain: its Paperclip URL key, or a slugified project name (`project-name`). |
| `saveFinishedIssues` | `true` | Save a short outcome memory when an issue moves to `done`. |

## Tool policy for agents

Plugin tools are denied to agents by default. An operator has to add a company tool policy before agents can call `memory_search` / `memory_save` / `memory_handoff_write` / `memory_handoff_read`. The tool names are namespaced by plugin id: `onenomad-przm-memory:memory_search`, etc.

```
POST /api/companies/:companyId/tools/policies
{
  "name": "przm Memory tools",
  "policyType": "allow",
  "selectors": {
    "actorType": "agent",
    "toolNames": [
      "onenomad-przm-memory:memory_search",
      "onenomad-przm-memory:memory_save",
      "onenomad-przm-memory:memory_handoff_write",
      "onenomad-przm-memory:memory_handoff_read"
    ]
  }
}
```

## A note on search formatting

przm Memory's `memory-search` tool has a `format: true` option meant for pretty, prompt-ready output. We don't use it here: when a domain-scoped query has zero semantic matches, the formatted output falls back to dumping every procedural rule across every domain instead of an empty result — verified against a live server, not a guess. The plain JSON result respects the domain filter correctly in the same case, so that's what this plugin uses everywhere (agent tool and UI search alike). If przm Memory fixes that fallback, formatted output would be a nicer read, but the current behavior means it can leak rules that have nothing to do with the project you searched.

## Development

```
pnpm install
pnpm build
pnpm typecheck
```

`src/manifest.ts` declares capabilities, tools, config, and UI slots. `src/worker.ts` holds one long-lived MCP client to `przm-memory`, connected lazily and reconnected on failure. `src/ui/` renders the two detail tabs.

## License

Apache-2.0
