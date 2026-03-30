"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { User, Bot, Sparkles, X } from "lucide-react";
import type { Message } from "@/lib/types";

interface Props {
  messages: Message[];
  title: string;
  showAnnotations?: boolean;
}

type MessageNodeData = { label: string; full: string; onOpen: () => void };
type AnnotationNodeData = {
  selectedText: string;
  question: string;
  answer: string;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
};

function UserNode({ data }: { data: MessageNodeData }) {
  return (
    <div
      onClick={data.onOpen}
      className="px-4 py-3 rounded-xl bg-primary text-primary-foreground shadow-lg max-w-[280px] border-2 border-primary cursor-pointer hover:opacity-95 transition-opacity"
      title="Click to view full message"
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
      <div className="flex items-start gap-2">
        <User size={14} className="flex-shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed line-clamp-4">{data.label}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </div>
  );
}

function AssistantNode({ data }: { data: MessageNodeData }) {
  return (
    <div
      onClick={data.onOpen}
      className="px-4 py-3 rounded-xl bg-card text-card-foreground shadow-lg max-w-[280px] border-2 border-border cursor-pointer hover:border-annotation/40 transition-colors"
      title="Click to view full message"
    >
      <Handle type="target" position={Position.Top} className="!bg-annotation !w-2 !h-2" />
      <div className="flex items-start gap-2">
        <Bot size={14} className="text-annotation flex-shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed line-clamp-4">{data.label}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-annotation !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="annotation-source" className="!bg-annotation !w-2 !h-2" />
    </div>
  );
}

function AnnotationNode({ data }: { data: AnnotationNodeData }) {
  return (
    <div
      onClick={data.onOpen}
      className="px-3 py-2 rounded-lg bg-annotation-bg border-2 border-annotation/40 shadow-md max-w-[260px] cursor-pointer hover:border-annotation transition-colors"
      title="Click to view full annotation"
    >
      <Handle type="target" position={Position.Left} className="!bg-annotation !w-2 !h-2" />
      <div className="flex items-start gap-1.5">
        <Sparkles size={12} className="text-annotation flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-annotation truncate">&ldquo;{data.selectedText}&rdquo;</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 italic">Q: {data.question}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onToggle();
            }}
            className="mt-1 text-[10px] text-annotation/80 hover:text-annotation underline underline-offset-2"
          >
            {data.expanded ? "Collapse preview" : "Preview answer"}
          </button>
          {data.expanded && <p className="text-[10px] mt-1 leading-relaxed line-clamp-6">{data.answer}</p>}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  userMessage: UserNode,
  assistantMessage: AssistantNode,
  annotation: AnnotationNode,
};

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80, edgesep: 30 });

  nodes.forEach((node) => {
    const width = node.type === "annotation" ? 240 : 280;
    const height = node.type === "annotation" ? 70 : 80;
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    const width = node.type === "annotation" ? 240 : 280;
    const height = node.type === "annotation" ? 70 : 80;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export default function ConversationGraph({ messages, title, showAnnotations = true }: Props) {
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<
    | null
    | { kind: "message"; role: "user" | "assistant"; content: string }
    | { kind: "annotation"; selectedText: string; question: string; answer: string }
  >(null);

  const toggleAnnotation = useCallback((id: string) => {
    setExpandedAnnotations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const nodeId = `msg-${msg.id}`;

      const contentPreview = msg.content.length > 120
        ? msg.content.slice(0, 120) + "..."
        : msg.content;

      if (msg.role === "user") {
        nodes.push({
          id: nodeId,
          type: "userMessage",
          position: { x: 0, y: 0 },
          data: {
            label: contentPreview,
            full: msg.content,
            onOpen: () => setDetail({ kind: "message", role: "user", content: msg.content }),
          },
        });
      } else {
        nodes.push({
          id: nodeId,
          type: "assistantMessage",
          position: { x: 0, y: 0 },
          data: {
            label: contentPreview,
            full: msg.content,
            onOpen: () => setDetail({ kind: "message", role: "assistant", content: msg.content }),
          },
        });
      }

      if (i > 0) {
        edges.push({
          id: `edge-${messages[i - 1].id}-${msg.id}`,
          source: `msg-${messages[i - 1].id}`,
          target: nodeId,
          type: "smoothstep",
          animated: msg.role === "assistant",
          style: { stroke: msg.role === "assistant" ? "var(--color-annotation)" : "var(--color-border)", strokeWidth: 2 },
        });
      }

      if (showAnnotations && msg.role === "assistant" && msg.annotations?.length) {
        for (const ann of msg.annotations) {
          const annId = `ann-${ann.id}`;
          nodes.push({
            id: annId,
            type: "annotation",
            position: { x: 0, y: 0 },
            data: {
              selectedText: ann.selectedText,
              question: ann.question,
              answer: ann.answer,
              expanded: expandedAnnotations.has(annId),
              onToggle: () => toggleAnnotation(annId),
              onOpen: () =>
                setDetail({
                  kind: "annotation",
                  selectedText: ann.selectedText,
                  question: ann.question,
                  answer: ann.answer,
                }),
            },
          });
          edges.push({
            id: `edge-${msg.id}-${ann.id}`,
            source: nodeId,
            sourceHandle: "annotation-source",
            target: annId,
            type: "smoothstep",
            style: { stroke: "var(--color-annotation)", strokeWidth: 1.5, strokeDasharray: "5 3" },
          });
        }
      }
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [messages, expandedAnnotations, toggleAnnotation, showAnnotations]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [graphEdges, setGraphEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // `useNodesState` / `useEdgesState` only use the initial values once.
  // When the toggle changes, we recompute the graph and must sync state.
  useEffect(() => {
    setNodes(layoutedNodes);
    setGraphEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setGraphEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={graphEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {detail && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          onMouseDown={() => setDetail(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[75vh] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
              {detail.kind === "message" ? (
                detail.role === "user" ? (
                  <User size={14} />
                ) : (
                  <Bot size={14} className="text-annotation" />
                )
              ) : (
                <Sparkles size={14} className="text-annotation" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">
                  {detail.kind === "message"
                    ? detail.role === "user"
                      ? "User message"
                      : "Assistant message"
                    : "Annotation"}
                </p>
                {detail.kind === "annotation" && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    &ldquo;{detail.selectedText}&rdquo;
                  </p>
                )}
              </div>
              <button
                onClick={() => setDetail(null)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(75vh-44px)] scrollbar-thin">
              {detail.kind === "message" ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                  {detail.content}
                </pre>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Question</p>
                    <p className="text-sm whitespace-pre-wrap">{detail.question}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1">Answer</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{detail.answer}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
