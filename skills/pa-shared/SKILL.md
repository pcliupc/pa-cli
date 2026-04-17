---
name: pa-shared
version: 1.0.0
description: "PA CLI 共享基础：配置管理（server URL、API Key）、认证机制、错误处理规则。所有 pa-* skill 的前置依赖。当用户首次使用 PA CLI、配置连接、遇到认证错误时触发。"
metadata:
requires:
bins: ["pa"]
cliHelp: "pa --help"
---

# PA CLI 共享规则

本技能指导你如何通过 `pa` CLI 操作流程智能体平台。

## 配置初始化

首次使用需配置服务器地址和 API Key：

```bash
# 配置服务器地址（PA Web 服务地址）
pa config set serverUrl http://localhost:3000

# 配置 API Key（与 Web 端 .env 中的 PA_CLI_API_KEY 一致）
pa config set apiKey pa_dev_test_key
```

查看当前配置：

```bash
pa config
```

## 认证

PA CLI 使用 Bearer Token（API Key）认证。API Key 在 Web 端的 `.env` 文件中通过 `PA_CLI_API_KEY` 环境变量配置。

### 认证失败处理

遇到认证错误时：

```
Error: Authentication failed. Run "pa config set apiKey <key>" to configure.
```

解决方案：确认 CLI 的 apiKey 与 Web 端的 `PA_CLI_API_KEY` 一致。

## 全局选项

所有命令支持以下全局选项：

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--output <format>` | 输出格式：table 或 json | table |
| `--server <url>` | 临时覆盖服务器地址 | 配置文件中的值 |
| `--version` | 显示版本 | - |
| `--help` | 显示帮助 | - |

## 输出格式

- **table**（默认）：人类友好的表格输出，适合终端查看
- **json**：原始 JSON 输出，适合脚本处理和管道操作

```bash
pa agent list --output json
pa session list --output json --page 1 --limit 10
```

## 命令结构

```
pa <resource> <action> [options] [arguments]

resource: agent | skill | session | config
action:   list | get | upload | download | delete | import | logs | feedback
```

## 安全规则

- **禁止输出 API Key 明文**到终端
- **写入/删除操作前必须确认用户意图**
- 删除操作默认需要确认，`-f/--force` 可跳过（仅在用户明确要求时使用）
