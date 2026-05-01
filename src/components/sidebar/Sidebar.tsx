"use client";

import { MessageSquarePlus, Settings, Trash2, MessageSquare, LogIn, LogOut } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  collapsed: boolean;
  authAction?: { label: string; title?: string; href?: string; onClick?: () => void; kind: "signin" | "signout" };
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  collapsed,
  authAction,
}: Props) {
  if (collapsed) return null;

  return (
    <aside className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0">
      <div className="h-12 px-3 flex items-center border-b border-sidebar-border">
        <button
          onClick={onNew}
          className="w-full h-9 flex items-center gap-2 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
        >
          <MessageSquarePlus size={16} />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            No conversations yet. Start a new chat!
          </p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
              activeId === c.id
                ? "bg-muted font-medium"
                : "hover:bg-muted/50"
            )}
            onClick={() => onSelect(c.id)}
          >
            <MessageSquare size={14} className="flex-shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{c.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
        {authAction && (
          authAction.href ? (
            <a
              href={authAction.href}
              className="w-full h-9 flex items-center gap-2 px-3 rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground"
              title={authAction.title}
            >
              {authAction.kind === "signin" ? <LogIn size={16} /> : <LogOut size={16} />}
              <span>{authAction.label}</span>
            </a>
          ) : (
            <button
              onClick={authAction.onClick}
              className="w-full h-9 flex items-center gap-2 px-3 rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground"
              title={authAction.title}
            >
              {authAction.kind === "signin" ? <LogIn size={16} /> : <LogOut size={16} />}
              <span>{authAction.label}</span>
            </button>
          )
        )}
        <button
          onClick={onOpenSettings}
          className="w-full h-9 flex items-center gap-2 px-3 rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground"
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </aside>
  );
}
