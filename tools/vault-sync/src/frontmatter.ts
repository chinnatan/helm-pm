// Hand-rolled frontmatter reader + surgical line editor.
// Never re-serializes: only the lines of requested keys are touched, every other byte (CRLF, comments, Thai text) is kept.

const KEY_RE = /^([A-Za-z_][\w-]*):(.*)$/;

export type Frontmatter = { fields: Record<string, string>; lists: Record<string, string[]> };

/** split keeping each line's own terminator */
function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}
const body = (l: string) => l.replace(/\r?\n$/, "");

/** index of the closing `---` line, or -1 when the file has no frontmatter */
function fmEnd(lines: string[]): number {
  if (!lines.length || body(lines[0]!.replace(/^﻿/, "")) !== "---") return -1;
  for (let i = 1; i < lines.length; i++) if (body(lines[i]!) === "---") return i;
  return -1;
}

function unquote(raw: string): string {
  let v = raw.trim();
  if (v.startsWith('"')) {
    const m = v.match(/^"((?:[^"\\]|\\.)*)"/);
    return m ? m[1]!.replace(/\\(.)/g, "$1") : v;
  }
  if (v.startsWith("'")) {
    const m = v.match(/^'([^']*)'/);
    return m ? m[1]! : v;
  }
  return v.replace(/\s+#.*$/, "").trim();
}

export function parseFrontmatter(text: string): Frontmatter | null {
  const lines = splitLines(text);
  const end = fmEnd(lines);
  if (end < 0) return null;
  const fields: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  let cur: string | null = null;
  for (let i = 1; i < end; i++) {
    const l = body(lines[i]!);
    const m = KEY_RE.exec(l);
    if (m) {
      cur = m[1]!;
      fields[cur] = unquote(m[2]!);
      lists[cur] = [m[2]!];
    } else if (cur && /^\s+\S/.test(l)) lists[cur]!.push(l); // block-list continuation
  }
  return { fields, lists };
}

/** keys referenced by depends_on: `[[T-XX-00 name]]` -> T-XX-00, or bare ids */
export function parseDependsOn(fm: Frontmatter): string[] {
  const raw = (fm.lists["depends_on"] ?? []).join("\n");
  const out = [...raw.matchAll(/\[\[\s*([^\s\]|#]+)/g)].map((m) => m[1]!);
  if (!out.length) {
    for (const s of raw.replace(/#.*$/gm, "").replace(/[\[\]"'\-]/g, " ").split(/[\s,]+/)) if (s) out.push(s);
  }
  return [...new Set(out)];
}

/**
 * Set top-level scalar keys. `values` are final scalar text (already quoted if needed).
 * Existing line: only the value is replaced (quote style and trailing `# comment` kept).
 * Missing key: inserted just before the closing `---`. Returns text unchanged when no frontmatter.
 */
export function setFrontmatterValues(text: string, values: Record<string, string>): string {
  const lines = splitLines(text);
  const end = fmEnd(lines);
  if (end < 0) return text;
  const eol = /\r\n$/.test(lines[0]!) ? "\r\n" : "\n";
  const pending = { ...values };
  for (let i = 1; i < end; i++) {
    const nl = lines[i]!.slice(body(lines[i]!).length);
    const m = /^([A-Za-z_][\w-]*):/.exec(body(lines[i]!));
    if (!m || !(m[1]! in pending)) continue;
    const key = m[1]!;
    const mm = /^([^:]+:[ \t]*)("(?:[^"\\]|\\.)*"|'[^']*'|.*?)([ \t]+#.*)?$/.exec(body(lines[i]!))!;
    let v = pending[key]!;
    if (mm[2]!.startsWith('"') && !v.startsWith('"')) v = JSON.stringify(v);
    lines[i] = `${mm[1]}${v}${mm[3] ?? ""}${nl}`;
    delete pending[key];
  }
  const add = Object.entries(pending).map(([k, v]) => `${k}: ${v}${eol}`);
  lines.splice(end, 0, ...add);
  return lines.join("");
}
