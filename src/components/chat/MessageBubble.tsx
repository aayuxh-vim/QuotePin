"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, Sparkles, Bookmark, BookmarkCheck, Copy, RotateCw } from "lucide-react";
import type { Annotation } from "@/lib/types";
import AnnotationBadge from "./AnnotationBadge";
import { resolveAnnotationAnchor } from "@/lib/annotation-anchor";
import { applyInlineAnnotations, clearInlineAnnotations } from "@/lib/inline-annotations";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface Props {
  role: "user" | "assistant";
  content: string;
  annotations: Annotation[];
  onAnnotationClick: (annotation: Annotation, rect: DOMRect) => void;
  onTextSelect: (
    text: string,
    rect: DOMRect,
    messageContent: string,
    occurrenceHint: number,
    messageId?: string
  ) => void;
  onMobileAnnotate?: (messageId: string, messageContent: string) => void;
  onToggleBookmark?: (messageId: string, role: "user" | "assistant", content: string) => void;
  isBookmarked?: boolean;
  messageId?: string;
  onRetryMessage?: (messageId: string) => void;
}

function resolveForChips(content: string, annotations: Annotation[]) {
  // Resolve anchors only to create stable preview labels; do NOT splice into markdown.
  return annotations
    .map((a) => {
      const anchor = resolveAnnotationAnchor({
        content,
        selectedText: a.selectedText,
        startOffset: a.startOffset,
        endOffset: a.endOffset,
        occurrence: (a as any).occurrence,
        prefix: (a as any).prefix,
        suffix: (a as any).suffix,
      });
      const preview =
        anchor.resolved && anchor.end <= content.length
          ? content.slice(anchor.start, anchor.end)
          : a.selectedText;
      return { annotation: a, preview };
    })
    .slice(0, 20);
}

export default function MessageBubble({
  role,
  content,
  annotations,
  onAnnotationClick,
  onTextSelect,
  onMobileAnnotate,
  onToggleBookmark,
  isBookmarked,
  messageId,
  onRetryMessage,
}: Props) {
  const isUser = role === "user";

  const annotationChips = useMemo(() => resolveForChips(content, annotations), [content, annotations]);
  const [copied, setCopied] = useState(false);
  const markdownRootRef = useRef<HTMLDivElement | null>(null);

  function handleMouseUp() {
    if (isUser) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 1 && sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const root = range.commonAncestorContainer instanceof Element
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;
      const messageRoot = root?.closest?.("[data-message-id]") as HTMLElement | null;

      let occurrenceHint = 0;
      try {
        // Compute which occurrence the user selected by using the DOM Range start position,
        // not indexOf() which always biases to the first match.
        const container = messageRoot || (root as HTMLElement | null);
        if (container) {
          const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
              if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            },
          });

          let full = "";
          let startIndex = 0;
          let foundStart = false;

          const startNode = range.startContainer;
          const startOffsetInNode = range.startOffset;

          while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const value = (node.nodeValue || "").replace(/\u00a0/g, " ");

            if (!foundStart) {
              if (node === startNode) {
                startIndex = full.length + Math.max(0, Math.min(value.length, startOffsetInNode));
                foundStart = true;
              }
            }

            full += value;
          }

          if (full && foundStart) {
            const before = full.slice(0, Math.max(0, startIndex));
            let idx = 0;
            let count = 0;
            while (true) {
              const found = before.indexOf(text, idx);
              if (found === -1) break;
              count += 1;
              idx = found + Math.max(1, text.length);
            }
            // occurrenceHint = how many occurrences appeared BEFORE the selected one
            occurrenceHint = count;
          }
        }
      } catch {}
      sel.removeAllRanges();
      onTextSelect(text, rect, content, occurrenceHint, messageId);
      if (!hintDismissed) dismissHint();
    }
  }

  const [hintDismissed, setHintDismissed] = useState(true);
  const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;

  useEffect(() => {
    if (isUser) return;
    try {
      setHintDismissed(localStorage.getItem("quotepin-hint-dismissed") === "true");
    } catch {}
  }, [isUser]);

  // Inline annotations: decorate rendered markdown without altering message content.
  useEffect(() => {
    if (isUser) return;
    const root = markdownRootRef.current;
    if (!root) return;

    if (!annotations?.length) {
      clearInlineAnnotations(root);
      return;
    }

    applyInlineAnnotations({
      root,
      annotations,
      onClick: onAnnotationClick,
    });

    return () => {
      clearInlineAnnotations(root);
    };
  }, [isUser, content, annotations, onAnnotationClick]);

  function dismissHint() {
    setHintDismissed(true);
    try { localStorage.setItem("quotepin-hint-dismissed", "true"); } catch {}
  }

  return (
    <div className={`flex gap-3 py-4 px-4 animate-fade-in ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-annotation/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={15} className="text-annotation" />
        </div>
      )}
      <div className={`${isUser ? "max-w-[75%]" : "flex-1 max-w-3xl"}`}>
        <div className="relative group">
          {!isUser && messageId && (
            <div className="absolute -top-2 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(content);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 900);
                  } catch {
                    // ignore
                  }
                }}
                className="p-1.5 rounded-md bg-card/70 backdrop-blur border border-border shadow-sm hover:bg-muted"
                title={copied ? "Copied" : "Copy"}
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => onRetryMessage?.(messageId)}
                className="p-1.5 rounded-md bg-card/70 backdrop-blur border border-border shadow-sm hover:bg-muted"
                title="Retry"
              >
                <RotateCw size={14} />
              </button>
              {onToggleBookmark && (
                <button
                  onClick={() => onToggleBookmark(messageId, role, content)}
                  className="p-1.5 rounded-md bg-card/70 backdrop-blur border border-border shadow-sm hover:bg-muted"
                  title={isBookmarked ? "Remove bookmark" : "Bookmark this message"}
                >
                  {isBookmarked ? <BookmarkCheck size={14} className="text-annotation" /> : <Bookmark size={14} />}
                </button>
              )}
            </div>
          )}

          <div
          className={
            isUser
              ? "bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-md"
              : ""
          }
          onMouseUp={handleMouseUp}
          data-message-id={messageId}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div ref={markdownRootRef} className="markdown-body text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        {...props}
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code {...props} className={className}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
          </div>
        </div>
        {!isUser && annotations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {annotationChips.map(({ annotation, preview }) => (
              <AnnotationBadge
                key={annotation.id}
                annotation={annotation}
                displayText={preview}
                onClick={onAnnotationClick}
              />
            ))}
          </div>
        )}
        {!isUser && !hintDismissed && (
          <button
            onClick={dismissHint}
            className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors group"
          >
            <Sparkles size={11} className="text-annotation/50 group-hover:text-annotation transition-colors" />
            <span>Select any text above to ask about it</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">· dismiss</span>
          </button>
        )}

        {!isUser && isTouch && onMobileAnnotate && messageId && (
          <button
            onClick={() => onMobileAnnotate(messageId, content)}
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-input hover:bg-muted transition-colors text-muted-foreground"
            title="Annotate without text selection"
          >
            <Sparkles size={13} className="text-annotation" />
            Annotate
          </button>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={15} />
        </div>
      )}
    </div>
  );
}
