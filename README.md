# NexusPM

Project management app with Gantt timeline, buckets, dependencies, meeting notes, and AI-powered insights.

## Desktop App (Tauri)

Build a standalone desktop app with **embedded AI** (model downloads on first run, ~8.5GB):

```bash
# Requires Rust: https://rustup.rs
npm run tauri:dev    # Development
npm run tauri:build  # Production build
```

The first AI request (Insights or "Clean up with AI" in meeting notes) will download Qwen2.5-Coder-14B-Q4_K_M from Hugging Face and cache it locally. Subsequent runs use the cached model.

## AI Insights

The **Insights** tab uses a local AI model to analyze your project (tasks, dependencies, meeting notes) and surface risks, open points, next steps, and blind spots.

**In Tauri desktop app:** Uses embedded model (download-on-first-run). No setup needed.

**In browser (Ollama / LM Studio):**

1. Install [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai)
2. Load a model (e.g. Qwen2.5-Coder-14B)
3. Open a project → Insights tab → **Analyze**

You can swap models via the settings (gear) button. Works with any OpenAI-compatible API (Ollama, LM Studio, etc.).

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
