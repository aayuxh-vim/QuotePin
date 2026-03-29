import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";

export type Provider = "anthropic" | "openai" | "google" | "groq";

export interface ModelConfig {
  provider: Provider;
  model: string;
  apiKey: string;
}

export const PROVIDER_MODELS: Record<Provider, { label: string; models: { id: string; name: string }[] }> = {
  groq: {
    label: "Groq",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
    ],
  },
  google: {
    label: "Google",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "o3-mini", name: "o3-mini" },
    ],
  },
  anthropic: {
    label: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    ],
  },
};

export function getModel(config: ModelConfig): LanguageModelV1 {
  switch (config.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: config.apiKey });
      return anthropic(config.model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: config.apiKey });
      return openai(config.model);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
      return google(config.model);
    }
    case "groq": {
      const groq = createOpenAI({
        apiKey: config.apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      return groq(config.model);
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
