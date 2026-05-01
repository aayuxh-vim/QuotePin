"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, Zap, MessageSquare, Send, Loader2 } from "lucide-react";
import { parseDataStream } from "@/lib/stream-parser";

type Token = { text: string; start: number; end: number };

function tokenizeForTap(content: string): Token[] {
  // Split into small tappable chunks (words + punctuation) while preserving offsets.
  const tokens: Token[] = [];
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    const isSpace = /\s/.test(ch);
    if (isSpace) {
      let j = i + 1;
      while (j < content.length && /\s/.test(content[j])) j++;
      tokens.push({ text: content.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    // group word-ish
    if (/[A-Za-z0-9]/.test(ch)) {
      let j = i + 1;
      while (j < content.length && /[A-Za-z0-9'’-]/.test(content[j])) j++;
      tokens.push({ text: content.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    // punctuation/symbol as single token
    tokens.push({ text: ch, start: i, end: i + 1 });
    i += 1;
  }
  return tokens;
}

function countOccurrencesBefore(content: string, needle: string, beforeIndex: number) {
  if (!needle) return 0;
  let idx = 0;
  let count = 0;
  while (true) {
    const found = content.indexOf(needle, idx);
    if (found === -1 || found >= beforeIndex) break;
    count += 1;
    idx = found + needle.length;
  }
  return count;
}

interface Props {
  open: boolean;
  messageId: string;
  messageContent: string;
  onClose: () => void;
  onAsk: (payload: {
    selectedText: string;
    startOffset: number;
    endOffset: number;
    occurrence: number;
    prefix: string;
    suffix: string;
    question: string;
  }) => Promise<ReadableStream<Uint8Array> | null>;
  onSaveAnnotation: (payload: {
    messageId: string;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    occurrence: number;
    prefix: string;
    suffix: string;
    question: string;
    answer: string;
  }) => void;
  onReplyInChat?: (selectedText: string, question: string) => void;
}

export default function MobileAnnotateSheet({
  open,
  messageId,
  messageContent,
  onClose,
  onAsk,
  onSaveAnnotation,
  onReplyInChat,
}: Props) {
  const tokens = useMemo(() => tokenizeForTap(messageContent), [messageContent]);
  const [selected, setSelected] = useState<{ text: string; start: number; end: number; occurrence: number } | null>(
    null
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"choose" | "popup" | "chat">("choose");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setQuestion("");
    setAnswer("");
    setLoading(false);
    setMode("choose");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, messageId]);

  if (!open) return null;

  const selectedText = selected?.text?.trim() || "";

  async function askInPopup() {
    if (!selected || !question.trim() || loading) return;
    setLoading(true);
    setAnswer("");
    setMode("popup");

    const prefix = messageContent.slice(Math.max(0, selected.start - 32), selected.start);
    const suffix = messageContent.slice(selected.end, Math.min(messageContent.length, selected.end + 32));

    try {
      const stream = await onAsk({
        selectedText: selected.text,
        startOffset: selected.start,
        endOffset: selected.end,
        occurrence: selected.occurrence,
        prefix,
        suffix,
        question: question.trim(),
      });
      if (!stream) {
        setAnswer("Failed to get response.");
        setLoading(false);
        return;
      }
      const finalText = await parseDataStream(stream, (acc) => setAnswer(acc));
      setAnswer(finalText);
      onSaveAnnotation({
        messageId,
        selectedText: selected.text,
        startOffset: selected.start,
        endOffset: selected.end,
        occurrence: selected.occurrence,
        prefix,
        suffix,
        question: question.trim(),
        answer: finalText,
      });
    } catch {
      setAnswer("An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function replyInChat() {
    if (!selected || !question.trim()) return;
    onReplyInChat?.(selected.text, question.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-[1px] flex items-end md:hidden" onMouseDown={onClose}>
      <div
        className="w-full bg-card border border-border rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
          <Sparkles size={16} className="text-annotation" />
          <p className="text-sm font-semibold flex-1">Annotate</p>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2">Tap a word/phrase from the AI response</p>
          <div className="max-h-[28vh] overflow-y-auto scrollbar-thin rounded-lg border border-border bg-background p-3 text-sm leading-relaxed">
            {tokens.map((t, idx) => {
              const isSelected = selected?.start === t.start && selected?.end === t.end;
              const tappable = t.text.trim().length > 0;
              return (
                <span
                  key={`${t.start}-${idx}`}
                  className={
                    tappable
                      ? `inline-block px-0.5 rounded ${isSelected ? "bg-annotation/20 text-annotation" : "hover:bg-muted"}`
                      : ""
                  }
                  onClick={() => {
                    if (!tappable) return;
                    const occ = countOccurrencesBefore(messageContent, t.text, t.start);
                    setSelected({ text: t.text, start: t.start, end: t.end, occurrence: occ });
                  }}
                >
                  {t.text}
                </span>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={selectedText ? `Ask about “${selectedText.length > 20 ? selectedText.slice(0, 20) + "…" : selectedText}”` : "Pick text above, then ask..."}
              className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={askInPopup}
              disabled={!selectedText || !question.trim() || loading}
              className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity"
              title="Ask in popup"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={askInPopup}
              disabled={!selectedText || !question.trim() || loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-input hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <Zap size={14} />
              Ask in popup
            </button>
            <button
              onClick={replyInChat}
              disabled={!selectedText || !question.trim() || !onReplyInChat}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-input hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <MessageSquare size={14} />
              Reply in chat
            </button>
          </div>

          {mode === "popup" && (answer || loading) && (
            <div className="mt-1 rounded-lg border border-border bg-background p-3 max-h-[26vh] overflow-y-auto scrollbar-thin">
              {loading && !answer ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-xs">Thinking...</span>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

