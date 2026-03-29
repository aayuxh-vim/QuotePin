"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot } from "lucide-react";
import type { Annotation } from "@/lib/types";
import AnnotationBadge from "./AnnotationBadge";

interface Props {
  role: "user" | "assistant";
  content: string;
  annotations: Annotation[];
  onAnnotationClick: (annotation: Annotation, rect: DOMRect) => void;
  onTextSelect: (text: string, rect: DOMRect, messageContent: string) => void;
  messageId?: string;
}

function renderContentWithAnnotations(
  content: string,
  annotations: Annotation[],
  onAnnotationClick: (annotation: Annotation, rect: DOMRect) => void
): React.ReactNode {
  if (!annotations.length) return null;

  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset);
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const ann of sorted) {
    if (ann.startOffset > lastEnd) {
      parts.push(
        <MarkdownSegment key={`text-${lastEnd}`} content={content.slice(lastEnd, ann.startOffset)} />
      );
    }
    parts.push(
      <AnnotationBadge key={ann.id} annotation={ann} onClick={onAnnotationClick} />
    );
    lastEnd = ann.endOffset;
  }

  if (lastEnd < content.length) {
    parts.push(
      <MarkdownSegment key={`text-${lastEnd}`} content={content.slice(lastEnd)} />
    );
  }

  return <div className="markdown-body">{parts}</div>;
}

function MarkdownSegment({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <span>{children} </span> }}>
      {content}
    </ReactMarkdown>
  );
}

export default function MessageBubble({
  role,
  content,
  annotations,
  onAnnotationClick,
  onTextSelect,
  messageId,
}: Props) {
  const isUser = role === "user";

  const annotatedContent = useMemo(
    () => renderContentWithAnnotations(content, annotations, onAnnotationClick),
    [content, annotations, onAnnotationClick]
  );

  function handleMouseUp() {
    if (isUser) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 1 && sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      sel.removeAllRanges();
      onTextSelect(text, rect, content);
    }
  }

  return (
    <div className={`flex gap-3 py-4 px-4 animate-fade-in ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-annotation/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={15} className="text-annotation" />
        </div>
      )}
      <div
        className={`max-w-[75%] ${
          isUser
            ? "bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-md"
            : "flex-1 max-w-3xl"
        }`}
        onMouseUp={handleMouseUp}
        data-message-id={messageId}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : annotations.length > 0 ? (
          annotatedContent
        ) : (
          <div className="markdown-body text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
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
