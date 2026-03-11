# NexusPM — Architecture

## High-Level Overview

NexusPM is a **Tauri 2** desktop application: a React frontend served inside a Rust-native window, with an optional embedded AI backend. The frontend can also run standalone in the browser, using external AI services (Ollama, LM Studio).

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React + Vite)"]
        UI[Pages & Components]
        Store[Zustand Store]
        Router[React Router]
    end
    
    subgraph Backend["Backend (Tauri / Rust)"]
        Commands[Tauri Commands]
        AI[AI Module]
    end
    
    subgraph External["External (Browser mode)"]
        Ollama[Ollama / LM Studio]
    end
    
    UI --> Store
    UI --> Router
    UI -->|invoke| Commands
    Commands --> AI
    UI -.->|fetch| Ollama
```

---

## Project Structure

```
NexusPM/
├── src/                          # Frontend (React + TypeScript)
│   ├── main.tsx                  # Entry point, theme init
│   ├── App.tsx                   # Router, route definitions
│   ├── app/
│   │   └── AppShell.tsx          # Layout, header, toast, Tauri listeners
│   ├── pages/
│   │   ├── DashboardPage.tsx      # Dashboard
│   │   └── ProjectPage.tsx      # Project tabs (Timeline, Notebook, Insights)
│   ├── components/
│   │   ├── AiDownloadToast.tsx   # Download progress toast (Tauri)
│   │   ├── SettingsDialog.tsx    # Settings, AI config, model download
│   │   ├── gantt/                # Gantt chart components
│   │   ├── insights/             # AI insights panel
│   │   ├── notes/                # Meeting notes, rich text editor
│   │   ├── task/                 # Task details dialog
│   │   ├── bucket/               # Bucket details dialog
│   │   └── ui/                   # Radix-based UI primitives
│   ├── store/
│   │   ├── useAppStore.ts        # Main app state (Zustand + persist)
│   │   ├── useAiStore.ts         # AI status (download, loading)
│   │   └── seed.ts               # Initial seed data
│   ├── lib/
│   │   ├── aiClient.ts           # AI API (Tauri invoke vs fetch)
│   │   ├── insightsContext.ts    # Build project context for AI
│   │   ├── linkifyInsights.tsx   # Clickable links in insights
│   │   └── ...
│   └── domain/
│       ├── types.ts              # Project, Task, Bucket, MeetingNote, etc.
│       └── stats.ts              # Progress, deadlines, blocked tasks
│
└── src-tauri/                    # Backend (Rust + Tauri)
    ├── src/
    │   ├── lib.rs                # Tauri setup, command registration
    │   ├── main.rs               # Entry point
    │   └── ai.rs                # Embedded AI (llama-gguf, download, inference)
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── icons/
```

---

## Data Flow

### State Management

```mermaid
flowchart LR
    subgraph Store["useAppStore (Zustand)"]
        P[Projects]
        B[Buckets]
        T[Tasks]
        N[Notebooks]
        M[MeetingNotes]
    end
    
    subgraph Persistence
        LS[localStorage]
    end
    
    subgraph UI
        Pages[Pages]
        Components[Components]
    end
    
    Store -->|persist| LS
    Pages -->|read/update| Store
    Components -->|read/update| Store
```

- **useAppStore** — Single source of truth for projects, buckets, tasks, notebooks, meeting notes. Persisted to `localStorage` under `nexuspm:data:v1`.
- **useAiStore** — AI-related state: download progress, loading, errors, `tauriDetected`, `downloadCancellable`. Not persisted.

### AI Request Flow

```mermaid
sequenceDiagram
    participant UI as Component
    participant Client as aiClient.ts
    participant Tauri as Tauri (Rust)
    participant Model as llama-gguf
    participant Ext as Ollama/LM Studio
    
    alt Tauri mode
        UI->>Client: chatCompletion(prompt)
        Client->>Tauri: invoke('chat_completion', ...)
        Tauri->>Model: inference
        Model-->>Tauri: stream tokens
        Tauri-->>Client: response
    else Browser mode
        UI->>Client: chatCompletion(prompt)
        Client->>Ext: fetch(API_URL/chat)
        Ext-->>Client: response
    end
    Client-->>UI: result
```

---

## Component Hierarchy

```mermaid
flowchart TB
    App[App]
    App --> Router[React Router]
    Router --> Dashboard[DashboardPage]
    Router --> Project[ProjectPage]
    
    Project --> Tabs[Tabs]
    Tabs --> Gantt[GanttChart]
    Tabs --> Notebook[MeetingNotesPanel]
    Tabs --> Insights[InsightsPanel]
    
    AppShell[AppShell]
    AppShell --> Header[Header]
    AppShell --> Toast[AiDownloadToast]
    AppShell --> Content[Outlet]
    
    App --> AppShell
    AppShell --> Content
    Content --> Dashboard
    Content --> Project
    
    Gantt --> Buckets[Buckets]
    Gantt --> Tasks[Tasks]
    Gantt --> TaskDetails[TaskDetailsDialog]
    Notebook --> RichText[RichTextEditor]
    Insights --> Analyze[Analyze Button]
```

---

## Tauri Integration

### Commands (Rust → Frontend)

| Command | Purpose |
|---------|---------|
| `chat_completion` | Run inference with embedded model |
| `ai_model_status` | Check if model is downloaded/loaded |
| `download_ai_model` | Start model download |
| `start_background_download` | Start download with progress events |
| `request_download_cancel` | Pause or stop download |
| `resume_background_download` | Resume paused download |

### Events (Rust → Frontend)

| Event | Payload | Purpose |
|-------|---------|---------|
| `ai:download-started` | `{ cancellable }` | Download began |
| `ai:download-progress` | `{ bytes, total }` | Progress update |
| `ai:download-completed` | — | Download finished |
| `ai:load-started` | — | Model loading |
| `ai:load-completed` | — | Model ready |

### Frontend Detection

The app detects Tauri via:

1. `window.__TAURI__` / `__TAURI_INTERNALS__` / `__TAURI_METADATA__`
2. Fallback: `invoke('ai_model_status')` on mount — success implies Tauri

---

## Domain Model

```mermaid
erDiagram
    Project ||--o{ Bucket : has
    Project ||--o{ Task : has
    Project ||--o{ Notebook : has
    Bucket ||--o{ Task : contains
    Notebook ||--o{ MeetingNote : contains
    MeetingNote }o--o{ Task : links
    MeetingNote }o--o{ Bucket : links
    Task }o--o{ Task : dependsOn
    
    Project {
        string id
        string name
        string description
    }
    
    Task {
        string id
        string title
        date startDate
        date endDate
        string status
        string[] dependsOn
    }
    
    MeetingNote {
        string id
        string title
        string content
        string[] linkedTaskIds
        string[] linkedBucketIds
    }
```

---

## Build & Runtime

```mermaid
flowchart TB
    subgraph Dev["Development"]
        Vite[Vite Dev Server :5173]
        Tauri[Tauri Dev]
        Vite --> Tauri
    end
    
    subgraph Prod["Production"]
        Build[Vite Build]
        Dist[dist/]
        TauriBuild[Tauri Build]
        Bundle[DMG / EXE / App]
        Build --> Dist
        TauriBuild --> Dist
        TauriBuild --> Bundle
    end
```

- **Development**: `npm run tauri:dev` — Vite serves the frontend; Tauri loads it in a native window.
- **Production**: `npm run tauri:build` — Vite builds to `dist/`; Tauri bundles the app (macOS DMG, Windows EXE, etc.).
