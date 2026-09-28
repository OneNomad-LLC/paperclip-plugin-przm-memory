import { useEffect, useState } from "react";
import { usePluginData, usePluginAction, Spinner, StatusBadge } from "@paperclipai/plugin-sdk/ui";
import type { PluginDetailTabProps } from "@paperclipai/plugin-sdk/ui";
import { CSS } from "./styles";

interface IssueContext { identifier: string; title: string; domain: string }
interface ProjectContext { name: string; domain: string }
interface SearchResult { text: string; isError: boolean }
interface ConnectionStatus { ok: boolean; message: string | null; toolCount: number; serverVersion: string | null }

function useStyles() {
  useEffect(() => {
    if (document.getElementById("pmem-styles")) return;
    const el = document.createElement("style");
    el.id = "pmem-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

function SearchBox({ domain, initialQuery }: { domain: string; initialQuery: string }) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const result = usePluginData<SearchResult>("search", query ? { query, domain } : undefined);

  return (
    <div>
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search memory…" />
        <button type="submit">Search</button>
      </form>
      {result.loading && <Spinner size="sm" label="Searching" />}
      {result.error && <div className="error">{result.error.message}</div>}
      {result.data?.isError && <div className="error">{result.data.text}</div>}
      {result.data && !result.data.isError && <div className="results">{result.data.text}</div>}
      {!query && !result.loading && <div className="empty">Nothing searched yet.</div>}
    </div>
  );
}

function SaveNoteForm({ domain, tags }: { domain: string; tags: string[] }) {
  const saveNote = usePluginAction("saveNote");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setStatus("saving");
    setError(null);
    try {
      await saveNote({ content: trimmed, domain, tags });
      setContent("");
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (status !== "idle") setStatus("idle");
        }}
        placeholder="Save a note to memory…"
      />
      <div className="footer">
        {status === "saved" && <span className="muted">Saved.</span>}
        {status === "error" && error && <span className="error">{error}</span>}
        <button className="btn primary" disabled={status === "saving" || !content.trim()} onClick={submit}>
          {status === "saving" ? "Saving…" : "Save to memory"}
        </button>
      </div>
    </div>
  );
}

export function IssueMemoryTab({ context }: PluginDetailTabProps) {
  useStyles();
  const companyId = context.companyId;
  const issueId = context.entityId;
  const { data: issue, loading, error } = usePluginData<IssueContext>(
    "issueContext",
    companyId && issueId ? { companyId, issueId } : undefined,
  );

  return (
    <div className="pmem">
      <section>
        <h4>Related memories</h4>
        {loading && <Spinner size="sm" label="Loading" />}
        {error && <div className="error">{error.message}</div>}
        {issue && <SearchBox domain={issue.domain} initialQuery={`${issue.identifier} ${issue.title}`.trim()} />}
        {!loading && !error && !issue && <div className="empty">No project context for this issue.</div>}
      </section>
      <section>
        <h4>Save a note</h4>
        {issue ? (
          <SaveNoteForm domain={issue.domain} tags={[issue.identifier].filter(Boolean)} />
        ) : (
          <div className="empty">Waiting on issue context.</div>
        )}
      </section>
    </div>
  );
}

export function ProjectMemoryTab({ context }: PluginDetailTabProps) {
  useStyles();
  const companyId = context.companyId;
  const projectId = context.entityId;
  const status = usePluginData<ConnectionStatus>("connectionStatus", {});
  const { data: project, loading, error } = usePluginData<ProjectContext>(
    "projectContext",
    companyId && projectId ? { companyId, projectId } : undefined,
  );

  return (
    <div className="pmem">
      <section>
        <h4>Connection</h4>
        {status.loading && <Spinner size="sm" label="Checking" />}
        {status.error && <div className="error">{status.error.message}</div>}
        {status.data && (
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <StatusBadge label={status.data.ok ? "Connected" : "Error"} status={status.data.ok ? "ok" : "error"} />
            </dd>
            {status.data.message && (
              <>
                <dt>Detail</dt>
                <dd>{status.data.message}</dd>
              </>
            )}
            <dt>Tools</dt>
            <dd>{status.data.toolCount}</dd>
            {status.data.serverVersion && (
              <>
                <dt>Version</dt>
                <dd>{status.data.serverVersion}</dd>
              </>
            )}
          </dl>
        )}
      </section>
      <section>
        <h4>Domain</h4>
        {loading && <Spinner size="sm" label="Loading" />}
        {error && <div className="error">{error.message}</div>}
        {project && (
          <dl className="kv">
            <dt>This project</dt>
            <dd>
              <code>{project.domain}</code>
            </dd>
          </dl>
        )}
      </section>
      <section>
        <h4>Search memory</h4>
        {project ? <SearchBox domain={project.domain} initialQuery="" /> : <div className="empty">Waiting on project context.</div>}
      </section>
    </div>
  );
}
