"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  localCount: number;
  onClose: () => void;
  onUpload: () => Promise<void>;
  onKeepLocal: () => void;
  onKeepSeparate: () => void;
}

export default function SyncPromptModal({
  open,
  localCount,
  onClose,
  onUpload,
  onKeepLocal,
  onKeepSeparate,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md mx-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Sync your local chats?</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            We found <strong>{localCount}</strong> local conversations in this browser.
          </p>
          <p className="text-xs text-muted-foreground">
            Choose what you want to do now that you’re signed in.
          </p>

          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </div>

        <div className="p-4 border-t border-border grid gap-2">
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setMsg(null);
              try {
                await onUpload();
                setMsg("Uploaded. Reloading…");
                setTimeout(() => window.location.reload(), 600);
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Upload failed");
              } finally {
                setLoading(false);
              }
            }}
            className="w-full px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Upload local chats to sync
          </button>
          <button
            disabled={loading}
            onClick={onKeepSeparate}
            className="w-full px-4 py-2 text-sm rounded-md border border-input hover:bg-muted transition-colors disabled:opacity-50"
          >
            Keep separate (start fresh in cloud)
          </button>
          <button
            disabled={loading}
            onClick={onKeepLocal}
            className="w-full px-4 py-2 text-sm rounded-md border border-input hover:bg-muted transition-colors disabled:opacity-50"
          >
            Keep local only (don’t upload)
          </button>
        </div>
      </div>
    </div>
  );
}

