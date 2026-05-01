import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function findNthIndex(haystack: string, needle: string, n: number) {
  if (!needle) return -1;
  let idx = -1;
  let from = 0;
  for (let i = 0; i <= n; i++) {
    idx = haystack.indexOf(needle, from);
    if (idx === -1) return -1;
    from = idx + needle.length;
  }
  return idx;
}
