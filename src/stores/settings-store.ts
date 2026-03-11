import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  settingsGetAll,
  settingsSet,
  aiFetchClaudeModels,
  aiFetchOpenaiModels,
} from "@/tauri";

export type AIProvider = "claude" | "openai";

export interface AIModel {
  id: string;
  label: string;
  provider: AIProvider;
}

interface SettingsState {
  claudeApiKey: string;
  openaiApiKey: string;
  aiProvider: AIProvider;
  aiModel: string;
  loaded: boolean;
  claudeModels: AIModel[];
  openaiModels: AIModel[];
  modelsLoading: boolean;

  load: () => Promise<void>;
  setClaudeApiKey: (key: string) => Promise<void>;
  setOpenaiApiKey: (key: string) => Promise<void>;
  setAIProvider: (provider: AIProvider) => Promise<void>;
  setAIModel: (model: string) => Promise<void>;
  fetchModels: (provider: AIProvider) => Promise<void>;
}

export function getModelsForProvider(
  provider: AIProvider,
  state: SettingsState,
): AIModel[] {
  return provider === "claude" ? state.claudeModels : state.openaiModels;
}

export const useSettingsStore = create<SettingsState>()(
  immer((set, get) => ({
    claudeApiKey: "",
    openaiApiKey: "",
    aiProvider: "claude",
    aiModel: "claude-sonnet-4-6",
    loaded: false,
    claudeModels: [],
    openaiModels: [],
    modelsLoading: false,

    load: async () => {
      const all = await settingsGetAll();
      const claudeKey = all["claude_api_key"] ?? "";
      const openaiKey = all["openai_api_key"] ?? "";
      const provider = (all["ai_provider"] as AIProvider) ?? "claude";
      set((s) => {
        s.claudeApiKey = claudeKey;
        s.openaiApiKey = openaiKey;
        s.aiProvider = provider;
        s.aiModel = all["ai_model"] ?? "claude-sonnet-4-6";
        s.loaded = true;
      });
      // Auto-fetch models for providers that have keys
      if (claudeKey) void get().fetchModels("claude");
      if (openaiKey) void get().fetchModels("openai");
    },

    setClaudeApiKey: async (key) => {
      await settingsSet("claude_api_key", key);
      set((s) => {
        s.claudeApiKey = key;
      });
    },

    setOpenaiApiKey: async (key) => {
      await settingsSet("openai_api_key", key);
      set((s) => {
        s.openaiApiKey = key;
      });
    },

    setAIProvider: async (provider) => {
      await settingsSet("ai_provider", provider);
      set((s) => {
        s.aiProvider = provider;
      });
    },

    setAIModel: async (model) => {
      await settingsSet("ai_model", model);
      set((s) => {
        s.aiModel = model;
      });
    },

    fetchModels: async (provider) => {
      const state = get();
      const apiKey =
        provider === "claude" ? state.claudeApiKey : state.openaiApiKey;
      if (!apiKey) return;

      set((s) => {
        s.modelsLoading = true;
      });

      try {
        const raw =
          provider === "claude"
            ? await aiFetchClaudeModels(apiKey)
            : await aiFetchOpenaiModels(apiKey);

        const models: AIModel[] = raw.map((m) => ({
          id: m.id,
          label: m.label,
          provider,
        }));

        if (models.length > 0) {
          set((s) => {
            if (provider === "claude") {
              s.claudeModels = models;
            } else {
              s.openaiModels = models;
            }
          });
        }
      } catch (err) {
        console.error(`Failed to fetch ${provider} models:`, err);
      } finally {
        set((s) => {
          s.modelsLoading = false;
        });
      }
    },
  })),
);
