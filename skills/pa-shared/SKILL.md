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
# 快速开始：直接设置（会自动创建 "local" profile）
pa config set serverUrl http://localhost:3000
pa config set apiKey pa_dev_test_key
```

### 多环境 Profile 管理

PA CLI 支持多环境配置（Profile），每个 Profile 独立存储 serverUrl 和 apiKey：

```bash
# 添加环境 Profile
pa config profile add local --server-url http://localhost:3000 --api-key pa_dev_key
pa config profile add staging --server-url https://staging.pa.io --api-key pa_staging_key
pa config profile add prod --server-url https://pa.io --api-key pa_prod_key

# 切换当前环境
pa config use staging

# 查看所有 Profile
pa config profile list

# 查看当前配置
pa config

# 删除 Profile
pa config profile remove staging
```

**Profile 命名规则：** 只允许字母、数字、连字符、下划线，最长 32 字符，不允许 `default`。

切换 Profile 后，所有后续命令自动使用该环境的 serverUrl 和 apiKey。

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
