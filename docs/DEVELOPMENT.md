# 开发

## 环境要求

- Node.js >= 18
- pnpm >= 8

## 开发命令

```bash
# 安装依赖
pnpm install

# 构建所有
pnpm run build:prepare

# 编译扩展
pnpm run compile

# 监听模式（开发）
pnpm run watch

# 打包扩展
pnpm run vsce

# 运行 Linter
pnpm run lint
```

## 项目结构

```bash
vscode-ext-code-assist/
├── packages/
│   ├── main/                    # VS Code 扩展主程序 (ACP Agent)
│   └── webview/                 # Vue 3 前端界面 (ACP Client)
```

## 技术栈

- TypeScript, VS Code Extension API, Vue 3, Vite, Webpack, pnpm, OpenAI API

## 测试

> 测试基本功能

```bash
验证功能是否正常，请回复 OK 或者 NO
写一篇科幻小说，要求不少于 2000 字，不超过 3000 字
写一篇玄幻小说，要求不少于 2000 字，不超过 3000 字
```

> 测试代块

```bash
使用十种编程语言输出 HTTP 服务示例代码
使用十种编程语言输出 WebSocket 服务示例代码
```

> 测试 HTML (xss)

```bash
使用 HTML 编写一个调查问卷
```

> 测试 Mermaid

```bash
使用 Mermaid 绘制 WebRTC 的流程图和时序图
```

> 测试 Katex

```bash
使用 Latex 语法编写麦克斯韦方程组
```
