export const CSS = `
.pmem { color: var(--foreground); font-size: 13px; line-height: 1.5; }
.pmem * { box-sizing: border-box; }
.pmem button { font: inherit; color: inherit; }
.pmem .muted { color: var(--muted-foreground); }
.pmem section { padding: 14px 16px; border-bottom: 1px solid var(--border); }
.pmem section:last-child { border-bottom: none; }
.pmem h4 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: var(--muted-foreground); margin: 0 0 10px; }
.pmem .row { display: flex; align-items: center; gap: 8px; }
.pmem .kv { display: grid; grid-template-columns: 100px 1fr; gap: 6px 10px; font-size: 13px; }
.pmem .kv dt { color: var(--muted-foreground); }
.pmem .kv dd { margin: 0; overflow-wrap: anywhere; }
.pmem .search { display: flex; gap: 8px; margin-bottom: 10px; }
.pmem .search input { flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--background); color: inherit; font: inherit; }
.pmem .search button, .pmem .btn { height: 32px; padding: 0 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--background); cursor: pointer; }
.pmem .search button:hover, .pmem .btn:hover { background: var(--accent); }
.pmem .btn:disabled { opacity: .5; cursor: default; }
.pmem .btn.primary { background: var(--primary); color: var(--primary-foreground); border-color: transparent; }
.pmem textarea { width: 100%; min-height: 64px; resize: vertical; font: inherit; color: inherit; background: var(--background); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; }
.pmem .memories { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow: auto; }
.pmem .memories li { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.pmem .memories p { margin: 0 0 6px; font-size: 13px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.pmem .memories .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; color: var(--muted-foreground); font-size: 12px; }
.pmem .memories .tag { border: 1px solid var(--border); border-radius: 999px; padding: 0 6px; }
.pmem .results { white-space: pre-wrap; font-size: 12.5px; background: var(--accent); border-radius: 8px; padding: 10px 12px; max-height: 360px; overflow: auto; }
.pmem .error { color: var(--destructive, #c0392b); font-size: 12.5px; }
.pmem .empty { color: var(--muted-foreground); font-size: 12.5px; }
.pmem .footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
`;
