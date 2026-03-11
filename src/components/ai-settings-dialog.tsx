import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw } from "lucide-react";
import {
  useSettingsStore,
  getModelsForProvider,
  type AIProvider,
} from "@/stores/settings-store";

export function AISettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const claudeApiKey = useSettingsStore((s) => s.claudeApiKey);
  const openaiApiKey = useSettingsStore((s) => s.openaiApiKey);
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const aiModel = useSettingsStore((s) => s.aiModel);
  const modelsLoading = useSettingsStore((s) => s.modelsLoading);
  const setClaudeApiKey = useSettingsStore((s) => s.setClaudeApiKey);
  const setOpenaiApiKey = useSettingsStore((s) => s.setOpenaiApiKey);
  const setAIProvider = useSettingsStore((s) => s.setAIProvider);
  const setAIModel = useSettingsStore((s) => s.setAIModel);
  const fetchModels = useSettingsStore((s) => s.fetchModels);

  const [localClaudeKey, setLocalClaudeKey] = useState("");
  const [localOpenaiKey, setLocalOpenaiKey] = useState("");
  const [localProvider, setLocalProvider] = useState<AIProvider>("claude");
  const [localModel, setLocalModel] = useState("");

  const state = useSettingsStore.getState();
  const filteredModels = getModelsForProvider(localProvider, state);

  useEffect(() => {
    if (open) {
      setLocalClaudeKey(claudeApiKey);
      setLocalOpenaiKey(openaiApiKey);
      setLocalProvider(aiProvider);
      const models = getModelsForProvider(aiProvider, useSettingsStore.getState());
      const belongs = models.some((m) => m.id === aiModel);
      setLocalModel(belongs ? aiModel : (models[0]?.id ?? ""));
      const key = aiProvider === "claude" ? claudeApiKey : openaiApiKey;
      const cached = aiProvider === "claude"
        ? useSettingsStore.getState().claudeModels
        : useSettingsStore.getState().openaiModels;
      if (key && cached.length === 0) {
        void fetchModels(aiProvider);
      }
    }
  }, [open, claudeApiKey, openaiApiKey, aiProvider, aiModel, fetchModels]);

  const handleProviderSwitch = (provider: AIProvider) => {
    setLocalProvider(provider);
    const models = getModelsForProvider(provider, useSettingsStore.getState());
    setLocalModel(models[0]?.id ?? "");
    const key = provider === "claude" ? localClaudeKey : localOpenaiKey;
    const cached = provider === "claude"
      ? useSettingsStore.getState().claudeModels
      : useSettingsStore.getState().openaiModels;
    if (key && cached.length === 0) {
      void fetchModels(provider);
    }
  };

  const handleRefreshModels = () => {
    const key = localProvider === "claude" ? localClaudeKey : localOpenaiKey;
    if (!key) return;
    const saveKey = localProvider === "claude" ? setClaudeApiKey : setOpenaiApiKey;
    void saveKey(key).then(() => fetchModels(localProvider));
  };

  const handleSave = async () => {
    await Promise.all([
      setClaudeApiKey(localClaudeKey),
      setOpenaiApiKey(localOpenaiKey),
      setAIProvider(localProvider),
      setAIModel(localModel),
    ]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
          <DialogDescription>Configure API keys and model preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-mono">Provider</Label>
            <div className="flex gap-2">
              <button
                onClick={() => handleProviderSwitch("claude")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                  localProvider === "claude"
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "border-border/50 text-muted-foreground hover:bg-accent/40"
                }`}
              >
                Claude
              </button>
              <button
                onClick={() => handleProviderSwitch("openai")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                  localProvider === "openai"
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "border-border/50 text-muted-foreground hover:bg-accent/40"
                }`}
              >
                OpenAI
              </button>
            </div>
          </div>

          {localProvider === "claude" ? (
            <div className="space-y-2">
              <Label className="text-xs font-mono">Claude API Key</Label>
              <Input
                type="password"
                value={localClaudeKey}
                onChange={(e) => setLocalClaudeKey(e.target.value)}
                placeholder="sk-ant-..."
                className="font-mono text-xs"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs font-mono">OpenAI API Key</Label>
              <Input
                type="password"
                value={localOpenaiKey}
                onChange={(e) => setLocalOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono">Model</Label>
              <button
                onClick={handleRefreshModels}
                disabled={modelsLoading}
                className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Refresh models from API"
              >
                {modelsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Refresh
              </button>
            </div>
            {filteredModels.length > 0 ? (
              <select
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                className="w-full h-9 rounded-lg border border-border/50 bg-input px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {filteredModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted-foreground font-mono py-2">
                Add your API key and click Refresh to load available models
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSave()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
