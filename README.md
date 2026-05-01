# QuotePin — AI Chatbot with Inline Context Popups

QuotePin is a chat interface that lets you highlight any word or phrase in an AI response and ask about it in a small popup — without cluttering the main conversation. The popup answer is saved as an embedded annotation you can revisit later. A conversation graph view (inspired by Obsidian) visualizes the relationship between messages and annotations.

## Why QuotePin?

Standard AI chatbots force you to reply inline when you don't understand something, which buries clarifications in the main thread. QuotePin solves this with:

- **Inline popups** — select text in any AI response, ask a follow-up, and get the answer in a floating popup that stays attached to the original context.
- **Annotations** — every popup Q&A is persisted and displayed as a badge on the original message, so you can find it later without scrolling.
- **Reply-in-chat option** — if a question deserves a full response, you can choose "Reply in chat" instead, which sends it as a regular message with the selected text as context.
- **Conversation graph** — a node-based visualization showing the chat as a tree: messages are the trunk, annotations are branches.

## Supported Providers

| Provider | Models |
|----------|--------|
| OpenAI | GPT-4o, GPT-4o Mini, GPT-4 Turbo, o3-mini |
| Anthropic | Claude Sonnet 4, Claude 3.5 Sonnet, Claude 3.5 Haiku |
| Google | Gemini 2.0 Flash, Gemini 2.0 Flash Lite, Gemini 1.5 Pro |
| Groq | Llama 3.3 70B, Llama 3.1 8B, Gemma 2 9B, Mixtral 8x7B |
| Qwen | qwen-turbo, qwen-plus, qwen-max |

Bring your own API key — keys are stored in browser `localStorage` and never sent to any server other than the provider's API.

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **AI**: Vercel AI SDK v4 with streaming responses
- **Database**: SQLite via Prisma ORM
- **UI**: Tailwind CSS v4, Lucide icons
- **Graph**: ReactFlow + Dagre for auto-layout
- **Markdown**: react-markdown + remark-gfm

## Getting Started

### Prerequisites

- Node.js 18+
- An API key from any supported provider

### Install

```bash
git clone https://github.com/aayuxh-vim/QuotePin.git
cd QuotePin
npm install
```

### Set up the database

```bash
npx prisma generate
npx prisma db push
```

This creates a local SQLite file at `prisma/dev.db`.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click the gear icon to configure your API provider and key.

## Deploy (Vercel)

See `DEPLOYMENT.md`.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts          # Main chat streaming endpoint
│   │   │   └── popup/route.ts    # Annotation popup endpoint
│   │   └── conversations/
│   │       ├── route.ts          # List/create conversations
│   │       └── [id]/route.ts     # Get/delete a conversation
│   ├── graph/[id]/page.tsx       # Conversation graph view
│   ├── layout.tsx
│   ├── page.tsx                  # Main app shell
│   └── globals.css
├── components/
│   ├── chat/
│   │   ├── ChatArea.tsx          # Chat interface with message list and input
│   │   ├── MessageBubble.tsx     # Individual message with text selection
│   │   ├── SelectionPopup.tsx    # Floating popup for inline Q&A
│   │   └── AnnotationBadge.tsx   # Badge showing saved annotations
│   ├── graph/
│   │   └── ConversationGraph.tsx # ReactFlow graph with custom nodes
│   ├── settings/
│   │   └── SettingsModal.tsx     # Provider/model/theme configuration
│   └── sidebar/
│       └── Sidebar.tsx           # Conversation list
├── lib/
│   ├── ai.ts                    # Provider factory and model registry
│   ├── db.ts                    # Prisma client singleton
│   ├── types.ts                 # TypeScript interfaces
│   ├── stream-parser.ts         # AI SDK stream parsing utility
│   └── utils.ts                 # Tailwind class merging
prisma/
└── schema.prisma                # Database schema (Conversation, Message, Annotation)
```

## Database Schema

Three models with cascading deletes:

- **Conversation** — holds title, provider, model, timestamps
- **Message** — belongs to a conversation, stores role and content
- **Annotation** — belongs to a message, stores selected text, question, answer, and character offsets for positioning

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## Licensing

This project is **dual-licensed**:

- **AGPL-3.0** (open source): free for individuals and open-source use. If you modify and run it as a network service, you must provide the corresponding source to users under the AGPL.
- **Commercial license**: for companies and organizations that want to use/host/modify this software without AGPL obligations. See `COMMERCIAL_LICENSE.md` or contact `aayushpatilsch@gmail.com`.
