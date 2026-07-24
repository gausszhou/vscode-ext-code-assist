# AGENTS.md

## Important

使用中文思维完成接下来的所有任务

## Package Manager

**pnpm** is required. Do not use npm or yarn.

## Build Order (Critical)

Build commands have dependencies — run in this order:

```bash
pnpm install
pnpm run build:prepare   # builds webview (must run before compile)
pnpm run compile          # compiles the main extension
```

## Package Structure

```
packages/
├── main/       # VS Code extension host + ACP Agent (webpack bundling)
└── webview/    # Vue 3 frontend + ACP Client (Vite)
```

- Communication between `main` and `webview` uses **ACP (Agent Client Protocol)** via `@agentclientprotocol/sdk`
- ACP transport is built on top of VS Code's `postMessage` mechanism
- The extension host acts as an **ACP Agent** — sessions persist even when webview closes
- The webview acts as an **ACP Client** — can disconnect/reconnect without losing state

## Developer Commands

| Command | Purpose |
|---------|---------|
| `pnpm run build:webview` | Build only the webview |
| `pnpm run build:prepare` | Build webview (fast, no bundling) |
| `pnpm run compile` | Full build: prepare + webpack bundle |
| `pnpm run watch` | Watch mode (webview + webpack watch) |
| `pnpm run package` | Production bundle |
| `pnpm run lint` | ESLint on all packages |
| `pnpm run lint:fix` | ESLint with auto-fix |
| `pnpm run test` | Run tests (requires `pretest` first) |
| `pnpm run vsce` | Package as .vsix |

Test flow: `pnpm run pretest` runs `compile-tests + compile + lint` before tests.

## Extension Architecture

- **Entry point**: `packages/main/src/extension.ts` — initializes `AgentServer` with `globalState`
- **ACP Agent**: `packages/main/src/acp/AgentServer.ts` — handles `session/new`, `session/prompt`, `session/load`, etc.
- **Session store**: `packages/main/src/acp/SessionStore.ts` — persists messages to filesystem (globalStorageUri/data/sessions/)
- **Session**: `packages/main/src/acp/ACPSession.ts` — per-conversation state (messages, model config, abort controller)
- **Transport**: `packages/main/src/acp/transport.ts` — wraps `webview.postMessage` as ACP `Stream`
- **Webview provider**: `packages/main/src/views/ChatWebViewProvider.ts` — creates webview + connects Agent
- **Commands**: All `codeAssist.*` commands registered in `extension.ts`
- **Webview entry**: `packages/webview/src/main.ts` + `App.vue`
- **ACP Client**: `packages/webview/src/acp/acp-client.ts` — sends prompts, receives streaming updates
- **Streaming**: Agent sends `session/update` notifications during prompt processing; Client receives via `onUpdate` callback
- **Background processing**: If webview closes mid-stream, Agent continues reading from OpenAI and stores result in SessionStore. Reopening webview and calling `session/load` replays history.

## VS Code Debug

Use the "Run Extension" launch config in `.vscode/launch.json` — it automatically runs the `watch` task as a pre-launch step.

## Release Process

Release is done by pushing a new git tag:

```bash
# Update version in package.json
# Build and commit
pnpm run compile
git add -A && git commit -m "release: v1.0.0-beta.X"

# Create and push tag
git tag v1.0.0-beta.X && git push origin v1.0.0-beta.X
```

GitHub Actions will automatically build and attach the .vsix file to the release.

## Release Operations

Follow these steps for releasing:

1. Switch to master and sync with remote
2. Push the v-prefixed tag to remote
3. Switch back to develop