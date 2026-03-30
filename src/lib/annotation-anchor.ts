export type ResolvedAnchor = {
  start: number;
  end: number;
  resolved: boolean;
};

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

export function resolveAnnotationAnchor(args: {
  content: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  occurrence?: number;
  prefix?: string;
  suffix?: string;
}): ResolvedAnchor {
  const { content, selectedText } = args;
  const start = args.startOffset ?? 0;
  const end = args.endOffset ?? 0;

  if (
    start >= 0 &&
    end >= start &&
    end <= content.length &&
    content.slice(start, end) === selectedText
  ) {
    return { start, end, resolved: true };
  }

  const indices = findAllIndices(content, selectedText);
  if (indices.length === 0) {
    const fallback = Math.max(0, Math.min(content.length, start));
    return { start: fallback, end: fallback, resolved: false };
  }

  // Prefer same occurrence if available.
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
    const before = content.slice(Math.max(0, idx - wantPrefix.length), idx);
    const after = content.slice(idx + selectedText.length, Math.min(content.length, idx + selectedText.length + wantSuffix.length));
    const score = commonSuffixLen(wantPrefix, before) + commonPrefixLen(wantSuffix, after);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    } else if (score === bestScore) {
      // Tie-breaker: closest to the stored offset.
      if (Math.abs(idx - start) < Math.abs(bestIdx - start)) {
        bestIdx = idx;
      }
    }
  }

  return { start: bestIdx, end: bestIdx + selectedText.length, resolved: true };
}

