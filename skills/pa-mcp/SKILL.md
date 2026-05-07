---
name: pa-mcp
version: 1.0.0
description: "PA MCP 服务器管理：列出、查看详情、创建、删除 MCP Server。当用户需要查看 MCP 服务器列表、获取 MCP 服务器详细信息、创建新的 MCP 服务器（从 JSON 配置文件）、删除 MCP 服务器时触发。"
metadata:
requires:
bins: ["pa"]
cliHelp: "pa mcp --help"
---

# PA MCP 服务器管理

**CRITICAL — 开始前 MUST 先读取 [`../pa-shared/SKILL.md`](../pa-shared/SKILL.md)，其中包含配置、认证规则。**

## 核心概念

- **MCP Server（MCP 服务器）**：提供工具（Tools）和资源（Resources）给智能体使用的外部服务，遵循 Model Context Protocol。
- **Connection Type（连接类型）**：`http`（远程 HTTP/SSE 连接）或 `managed_local`（本地进程管理）。
- **Credential Mode（凭证模式）**：`none`（无需认证）、`platform_secret`（平台密钥）、`oauth`（OAuth 认证）。
- **Built-in Server（内置服务器）**：平台预置的 MCP 服务器，不可删除、不可修改连接配置。
- **Space 归属**：MCP 服务器可归属于特定空间。不指定 `--space` 创建时，默认归属默认空间。

## 命令参考

### 列出 MCP 服务器

```bash
# 列出所有 MCP 服务器
pa mcp list

# 按分类过滤（platform, data, ai, utility）
pa mcp list --category <category>

# 按关键词搜索
pa mcp list --search <keyword>

# 按空间过滤
pa mcp list --space <space-id>

# JSON 格式输出
pa mcp list --output json
```

输出列：ID、Name、Display Name、Category、Type、Auth、Active、Updated

### 查看 MCP 服务器详情

```bash
pa mcp get <server-id>
```

输出包含：
- 名称和显示名称
- 服务器 ID
- 分类（Category）
- 连接类型和传输方式（Connection / Transport）
- 认证模式（Auth / Credential Mode）
- URL 或 Command（取决于连接类型）
- 是否激活（Active）
- 是否内置（Built-in）
- 所属空间（Space，如有）
- 描述（Description，如有）
- 工具和资源数量（Tools / Resources）
- 创建和更新时间

### 创建 MCP 服务器

从 JSON 配置文件创建 MCP 服务器。

```bash
# 基本创建
pa mcp create ./my-server.json

# 创建到指定空间
pa mcp create ./my-server.json --space <space-id>
```

`--space <id>` 可选，不指定时 MCP 服务器归属默认空间。

**JSON 配置文件格式（HTTP/SSE 远程服务器）：**

```json
{
  "name": "my-tool-server",
  "displayName": "My Tool Server",
  "description": "A custom MCP server",
  "category": "utility",
  "connectionType": "http",
  "transport": "sse",
  "credentialMode": "none",
  "url": "https://my-server.example.com/mcp"
}
```

**JSON 配置文件格式（本地进程服务器）：**

```json
{
  "name": "local-tool",
  "displayName": "Local Tool",
  "description": "A local MCP server",
  "category": "utility",
  "connectionType": "managed_local",
  "credentialMode": "none",
  "command": "npx my-mcp-server"
}
```

**带平台密钥认证的配置：**

```json
{
  "name": "api-server",
  "displayName": "API Server",
  "connectionType": "http",
  "credentialMode": "platform_secret",
  "authMode": "bearer",
  "url": "https://api.example.com/mcp"
}
```

创建成功后会输出服务器 ID 和显示名称。

### 删除 MCP 服务器

```bash
# 需确认
pa mcp delete <server-id>

# 跳过确认
pa mcp delete <server-id> -f
```

**注意**：内置服务器（Built-in）不可删除。删除前请确认该服务器未被智能体引用。

## 常见场景

### 查看平台有哪些可用的 MCP 服务器

```bash
pa mcp list
```

### 搜索特定功能的 MCP 服务器

```bash
pa mcp list --search "database"
```

### 查看某个 MCP 服务器提供了哪些工具

```bash
pa mcp get <server-id>
```

查看输出中的 `Tools` 和 `Resources` 数量。

### 创建自定义 MCP 服务器

```bash
# 1. 准备 JSON 配置文件
# 2. 创建服务器
pa mcp create ./my-server.json

# 3. 验证创建结果
pa mcp get <returned-id>
```

### 删除不再使用的 MCP 服务器

```bash
pa mcp delete <server-id> -f
```
