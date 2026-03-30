"use client";

import type { Annotation } from "@/lib/types";

interface Props {
  annotation: Annotation;
  displayText?: string;
  onClick: (annotation: Annotation, rect: DOMRect) => void;
}

export default function AnnotationBadge({ annotation, displayText, onClick }: Props) {
  function handleClick(e: React.MouseEvent<HTMLSpanElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    onClick(annotation, rect);
  }

  return (
    <span
      onClick={handleClick}
      className="relative cursor-pointer border-b-2 border-annotation/50 bg-annotation-bg rounded-sm px-0.5 hover:bg-annotation/20 transition-colors"
      title={`Q: ${annotation.question}`}
    >
      {displayText ?? annotation.selectedText}
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-annotation rounded-full" />
    </span>
  );
}
