import type { Annotation } from "@/lib/types";

type TextNodeSlice = {
  node: Text;
  start: number;
  end: number;
};

function normalizeForMatching(s: string) {
  // Keep it conservative: match on raw text node content, but normalize NBSP.
  return s.replace(/\u00a0/g, " ");
}

function findAllIndices(haystack: string, needle: string) {
  const res: number[] = [];
  if (!needle) return res;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    res.push(idx);
    from = idx + Math.max(1, needle.length);
  }
  return res;
}

function commonSuffixLen(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

function commonPrefixLen(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

function resolveInRenderedText(args: {
  renderedText: string;
  selectedText: string;
  occurrence?: number;
  prefix?: string;
  suffix?: string;
}): { start: number; end: number; resolved: boolean } {
  const renderedText = args.renderedText;
  const selectedText = args.selectedText;

  const indices = findAllIndices(renderedText, selectedText);
  if (indices.length === 0) return { start: 0, end: 0, resolved: false };

  const occ = typeof args.occurrence === "number" ? args.occurrence : undefined;
  if (occ !== undefined && occ >= 0 && occ < indices.length) {
    const s = indices[occ];
    return { start: s, end: s + selectedText.length, resolved: true };
  }

  const wantPrefix = args.prefix ?? "";
  const wantSuffix = args.suffix ?? "";

  let bestIdx = indices[0];
  let bestScore = -1;

  for (const idx of indices) {
    const before = renderedText.slice(Math.max(0, idx - wantPrefix.length), idx);
    const after = renderedText.slice(
      idx + selectedText.length,
      Math.min(renderedText.length, idx + selectedText.length + wantSuffix.length)
    );
    const score = commonSuffixLen(wantPrefix, before) + commonPrefixLen(wantSuffix, after);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return { start: bestIdx, end: bestIdx + selectedText.length, resolved: true };
}

export function clearInlineAnnotations(root: HTMLElement) {
  const existing = root.querySelectorAll("[data-inline-annotation-id]");
  existing.forEach((el) => {
    const text = el.textContent ?? "";
    el.replaceWith(document.createTextNode(text));
  });
}

export function applyInlineAnnotations(args: {
  root: HTMLElement;
  annotations: Annotation[];
  onClick: (annotation: Annotation, rect: DOMRect) => void;
}) {
  const { root, annotations, onClick } = args;
  if (!root) return;

  clearInlineAnnotations(root);
  if (!annotations?.length) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      // Skip text inside code blocks; inline annotations here are confusing.
      const parent = node.parentElement;
      if (parent?.closest("pre, code")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const slices: TextNodeSlice[] = [];
  let full = "";

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const value = normalizeForMatching(node.nodeValue || "");
    const start = full.length;
    full += value;
    slices.push({ node, start, end: start + value.length });
  }

  if (!full) return;

  const ranges = annotations
    .map((a) => {
      const selected = normalizeForMatching(a.selectedText || "");
      if (!selected || selected.length < 2) return null;
      const resolved = resolveInRenderedText({
        renderedText: full,
        selectedText: selected,
        occurrence: a.occurrence,
        prefix: normalizeForMatching(a.prefix || ""),
        suffix: normalizeForMatching(a.suffix || ""),
      });
      if (!resolved.resolved || resolved.end <= resolved.start) return null;
      return { ann: a, start: resolved.start, end: resolved.end };
    })
    .filter(Boolean) as Array<{ ann: Annotation; start: number; end: number }>;

  if (!ranges.length) return;

  // Apply from end to start so earlier indices stay valid.
  ranges.sort((a, b) => b.start - a.start);

  const covered: Array<{ start: number; end: number }> = [];
  function overlaps(s: number, e: number) {
    return covered.some((c) => !(e <= c.start || s >= c.end));
  }

  for (const r of ranges) {
    if (overlaps(r.start, r.end)) continue;

    const startSliceIdx = slices.findIndex((s) => r.start >= s.start && r.start <= s.end);
    const endSliceIdx = slices.findIndex((s) => r.end >= s.start && r.end <= s.end);
    if (startSliceIdx === -1 || endSliceIdx === -1) continue;

    const startSlice = slices[startSliceIdx];
    const endSlice = slices[endSliceIdx];

    const range = document.createRange();
    range.setStart(startSlice.node, Math.max(0, r.start - startSlice.start));
    range.setEnd(endSlice.node, Math.max(0, r.end - endSlice.start));

    const span = document.createElement("span");
    span.dataset.inlineAnnotationId = r.ann.id;
    span.className =
      "inline-annotation rounded-sm bg-annotation/10 text-annotation underline decoration-annotation/40 underline-offset-2 cursor-pointer";
    span.title = "Click to view annotation";
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(r.ann, span.getBoundingClientRect());
    });

    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);

    covered.push({ start: r.start, end: r.end });
  }
}

