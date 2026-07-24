# code-assist-main

VS Code 扩展主程序，提供 AI 代码助手的核心功能。

## 功能特性

- **AI 聊天**: 与 AI 进行代码相关的对话
- **代码优化**: 优化选中代码的性能和可读性
- **代码解释**: 解释选中代码的功能
- **添加注释**: 为代码添加注释
- **代码升级**: 将代码升级为 Class/Vue/React 语法
- **数据分析**: 分析选中数据
- **文本翻译**: 翻译选中文本
- **文学鉴赏**: 对选中内容进行文学鉴赏

## 架构

```
src/
├── extension.ts              — 扩展入口
├── views/
│   └── chat-webview.provider.ts
├── acp/
│   └── acp.transport.ts      — Webview Stream 适配 + connectServer
├── agent/
│   ├── agent.service.ts      — AcpAgent（implements Agent）
│   ├── agent.loop.ts         — AgentLoop（流式执行循环）
│   └── agent.title.ts        — 自动标题生成
├── session/
│   ├── session.entity.ts
│   ├── session-store.service.ts
│   └── session-manager.service.ts
├── extension/
│   ├── extension.router.ts
│   ├── model.service.ts
│   ├── provider.service.ts
│   ├── session.service.ts
│   └── settings.service.ts
├── logger/
│   └── logger.service.ts
└── openai/
    └── openai.service.ts
```

依赖方向：`acp/` → `agent/` → `session/ | extension/ | logger/ | openai/`

## 安装

```bash
pnpm install
pnpm run compile
```

## 快捷键

- `Ctrl+U` / `Cmd+U`: 打开 Code Assist

## 命令

| 命令 | 描述 |
|------|------|
| `codeAssist.open` | 打开 Code Assist |
| `codeAssist.chat` | 开始聊天 |
| `codeAssist.optimization` | 代码优化 |
| `codeAssist.explanation` | 代码解释 |
| `codeAssist.comment` | 添加注释 |
| `codeAssist.analysis` | 数据分析 |
| `codeAssist.translation` | 文本翻译 |
| `codeAssist.appreciation` | 文学鉴赏 |
| `codeAssist.add-to-chat` | 添加到聊天 |

## 许可证

MIT
