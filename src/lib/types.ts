export interface Annotation {
  id: string;
  messageId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  question: string;
  answer: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  annotations: Annotation[];
}

export interface Conversation {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface AppSettings {
  provider: string;
  model: string;
  apiKey: string;
  theme: "light" | "dark" | "system";
}
