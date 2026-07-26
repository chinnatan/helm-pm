import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "del",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "hr",
];

const ALLOWED_ATTR = ["href", "target", "rel", "class"];

function basicSanitize(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

export function markdownToUnsafeHtml(md: string | null | undefined): string {
  if (!md?.trim()) return "";
  return marked.parse(md, { async: false }) as string;
}

export async function renderMarkdownToSafeHtml(
  md: string | null | undefined,
): Promise<string> {
  const raw = markdownToUnsafeHtml(md);
  if (!raw) return "";
  if (import.meta.server) return basicSanitize(raw);

  const DOMPurify = (await import("isomorphic-dompurify")).default;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

/** Plain one-line preview for truncate / line-clamp surfaces. */
export function stripMarkdownForPreview(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmptyMarkdown(md: string | null | undefined): boolean {
  if (!md?.trim()) return true;
  return stripMarkdownForPreview(md).length === 0;
}
