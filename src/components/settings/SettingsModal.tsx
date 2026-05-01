"use client";

import { useState, useEffect } from "react";
import { X, Key, Bot, Sun, Moon, Monitor, Upload, Download } from "lucide-react";
import { PROVIDER_MODELS, type Provider } from "@/lib/ai";
import type { AppSettings } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export default function SettingsModal({ open, onClose, settings, onSave }: Props) {
  const [local, setLocal] = useState<AppSettings>(settings);
  const [migrateMessage, setMigrateMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocal(settings);
  }, [settings, open]);

  if (!open) return null;

  const provider = local.provider as Provider;
  const models = PROVIDER_MODELS[provider]?.models || [];

  function handleProviderChange(p: string) {
    const firstModel = PROVIDER_MODELS[p as Provider]?.models[0]?.id || "";
    setLocal({ ...local, provider: p, model: firstModel });
  }

  function handleSave() {
    onSave(local);
    onClose();
  }

  async function handleExport() {
    setMigrateMessage(null);
    const res = await fetch("/api/export");
    if (!res.ok) {
      setMigrateMessage("Export failed. Make sure you are signed in.");
      return;
    }
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ard-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMigrateMessage("Export downloaded.");
  }

  async function handleImport(file: File) {
    setMigrateMessage(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/migrate/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMigrateMessage(err.error || "Import failed.");
        return;
      }
      const result = await res.json();
      setMigrateMessage(
        `Imported ${result.importedConversations} conversations (${result.importedMessages} messages, ${result.importedAnnotations} annotations).`
      );
    } catch {
      setMigrateMessage("Invalid JSON file.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md mx-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Bot size={15} />
              Provider
            </label>
            <select
              value={local.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(PROVIDER_MODELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Bot size={15} />
              Model
            </label>
            <select
              value={local.model}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Key size={15} />
              API Key
            </label>
            <input
              type="password"
              value={local.apiKey}
              onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
              placeholder={`Enter your ${PROVIDER_MODELS[provider]?.label || ""} API key`}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your key stays in your browser and is sent directly to the provider.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {([
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setLocal({ ...local, theme: value })}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors ${local.theme === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-muted"
                    }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              Export / Import
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm border border-input hover:bg-muted transition-colors"
              >
                <Download size={14} />
                Export JSON
              </button>
              <label className="flex-1">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImport(f);
                    e.currentTarget.value = "";
                  }}
                />
                <span className="w-full cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm border border-input hover:bg-muted transition-colors">
                  <Upload size={14} />
                  Import JSON
                </span>
              </label>
            </div>
            {migrateMessage && <p className="text-xs text-muted-foreground mt-2">{migrateMessage}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-input hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
