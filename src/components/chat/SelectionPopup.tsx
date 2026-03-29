"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Sparkles, MessageSquare, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseDataStream } from "@/lib/stream-parser";

interface Props {
  selectedText: string;
  position: { x: number; y: number };
  existingAnswer?: string;
  existingQuestion?: string;
  onAsk: (question: string) => Promise<ReadableStream<Uint8Array> | null>;
  onClose: () => void;
  onSaveAnnotation: (question: string, answer: string) => void;
  onReplyInChat?: (selectedText: string, question: string) => void;
}

export default function SelectionPopup({
  selectedText,
  position,
  existingAnswer,
  existingQuestion,
  onAsk,
  onClose,
  onSaveAnnotation,
  onReplyInChat,
}: Props) {
  const [question, setQuestion] = useState(existingQuestion || "");
  const [answer, setAnswer] = useState(existingAnswer || "");
  const [loading, setLoading] = useState(false);
  const [hasAsked, setHasAsked] = useState(!!existingAnswer);
  const [mode, setMode] = useState<"choose" | "popup" | "chat">(existingAnswer ? "popup" : "choose");
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "popup" && !existingAnswer) {
      inputRef.current?.focus();
    }
  }, [mode, existingAnswer]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  });

  function handleClose() {
    if (hasAsked && answer && !existingAnswer) {
      onSaveAnnotation(question, answer);
    }
    onClose();
  }

  async function handleSubmit() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer("");
    setHasAsked(true);

    try {
      const stream = await onAsk(question.trim());
      if (!stream) {
        setAnswer("Failed to get response.");
        setLoading(false);
        return;
      }

      const finalText = await parseDataStream(stream, (accumulated) => {
        setAnswer(accumulated);
      });
      setAnswer(finalText);
    } catch {
      setAnswer("An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function handleReplyInChat() {
    if (!question.trim()) return;
    onReplyInChat?.(selectedText, question.trim());
    onClose();
  }

  const popupStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(position.x, window.innerWidth - 400),
    top: Math.min(position.y + 10, window.innerHeight - 380),
    zIndex: 100,
  };

  return (
    <div ref={popupRef} style={popupStyle} className="animate-slide-up">
      <div className="w-[380px] max-h-[370px] bg-popover border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <Sparkles size={13} className="text-annotation flex-shrink-0" />
          <span className="text-xs font-medium truncate flex-1 text-annotation">
            &ldquo;{selectedText.length > 50 ? selectedText.slice(0, 50) + "..." : selectedText}&rdquo;
          </span>
          <button onClick={handleClose} className="p-0.5 rounded hover:bg-muted transition-colors">
            <X size={14} />
          </button>
        </div>

        {mode === "choose" && !existingAnswer && (
          <>
            <div className="flex items-center gap-2 p-2 border-b border-border">
              <input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    setMode("popup");
                    setTimeout(() => handleSubmit(), 0);
                  }
                }}
                placeholder="Ask about this..."
                className="flex-1 px-2.5 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>
            <div className="flex gap-2 p-2">
              <button
                onClick={() => {
                  if (!question.trim()) return;
                  setMode("popup");
                  setTimeout(() => handleSubmit(), 0);
                }}
                disabled={!question.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-input hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <Zap size={13} />
                Ask in popup
              </button>
              <button
                onClick={() => {
                  if (!question.trim()) return;
                  handleReplyInChat();
                }}
                disabled={!question.trim() || !onReplyInChat}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-input hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <MessageSquare size={13} />
                Reply in chat
              </button>
            </div>
          </>
        )}

        {(mode === "popup" || existingAnswer) && hasAsked && (
          <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 min-h-0">
            {question && !existingAnswer && (
              <p className="text-xs text-muted-foreground mb-2 italic">Q: {question}</p>
            )}
            {existingQuestion && existingAnswer && (
              <p className="text-xs text-muted-foreground mb-2 italic">Q: {existingQuestion}</p>
            )}
            <div className="text-sm markdown-body leading-relaxed">
              {answer ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
              ) : loading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-xs">Thinking...</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {mode === "popup" && !existingAnswer && !hasAsked && (
          <div className="flex items-center gap-2 p-2 border-t border-border">
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
              placeholder="Ask about this..."
              disabled={loading}
              className="flex-1 px-2.5 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!question.trim() || loading}
              className="p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
