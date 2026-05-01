export function markdownToPlainText(markdown: string) {
  if (!markdown) return "";

  let s = String(markdown);

  // Remove fenced code blocks (keep nothing; previews should be concise).
  s = s.replace(/```[\s\S]*?```/g, " ");

  // Inline code
  s = s.replace(/`([^`]+)`/g, "$1");

  // Images: ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // Links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Strip emphasis markers (basic)
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/~~([^~]+)~~/g, "$1");

  // Headings / blockquotes / list prefixes
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

