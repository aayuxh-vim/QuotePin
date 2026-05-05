import { X, Copy, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "local" | "cloud";
  shareEnabled: boolean;
  shareBusy: boolean;
  shareUrl: string | null;
  shareStatus: "idle" | "copied" | "error";
  onEnsureShareEnabled: () => void;
  onCopyShareLink: () => void;
  onDisableShare: () => void;
}

export default function ShareModal({
  open,
  onClose,
  mode,
  shareEnabled,
  shareBusy,
  shareUrl,
  shareStatus,
  onEnsureShareEnabled,
  onCopyShareLink,
  onDisableShare,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md mx-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Share chat</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="Close share modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {mode !== "cloud" ? (
            <div className="text-sm text-muted-foreground">
              Sharing is available for synced chats.{" "}
              <a className="text-annotation hover:underline" href="/auth">
                Sign in
              </a>{" "}
              to enable sharing.
            </div>
          ) : (
            <>
              {!shareEnabled ? (
                <button
                  disabled={shareBusy}
                  onClick={onEnsureShareEnabled}
                  className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {shareBusy ? "Please wait..." : "Create share link"}
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl || ""}
                      className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                      aria-label="Share URL"
                    />
                    <button
                      disabled={!shareUrl || shareBusy}
                      onClick={onCopyShareLink}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border border-input hover:bg-muted transition-colors disabled:opacity-50"
                      title="Copy link"
                      aria-label="Copy share link"
                    >
                      {shareStatus === "copied" ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      {shareStatus === "copied" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <a
                      className="text-xs text-annotation hover:underline"
                      href={shareUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open link
                    </a>
                    <button
                      disabled={shareBusy}
                      onClick={onDisableShare}
                      className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                      title="Disable sharing"
                      aria-label="Disable sharing"
                    >
                      Disable link
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {shareStatus === "error" && (
            <p className="text-xs text-destructive">
              Something went wrong creating the share link.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
