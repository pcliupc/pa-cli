---
name: pa-session
version: 1.0.0
description: "PA 会话管理：列出、查看详情、删除会话，获取运行日志、反馈，以及检查和下载 session workspace 里的生成文件。当用户需要查看会话列表、检查会话状态和阶段执行情况、查看运行日志（工具调用、推理记录）、分析智能体生成产物或下载 workspace 文件时触发。"
metadata:
requires:
bins: ["pa"]
cliHelp: "pa session --help"
---

# PA 会话管理

**CRITICAL — 开始前 MUST 先读取 [`../pa-shared/SKILL.md`](../pa-shared/SKILL.md)，其中包含配置、认证规则。**

## 核心概念

- **会话（Session）**：用户与智能体的一次交互实例，包含多轮对话和阶段执行。
- **阶段（Stage）**：会话中的执行步骤，每个阶段有状态：`active`（进行中）、`completed`（已完成）、`pending`（待执行）。
- **运行日志（Logs）**：会话执行过程中的工具调用、推理记录等结构化日志。
- **反馈（Feedback）**：用户和管理员对会话结果的评价，包含多维度评分。
- **Workspace 文件**：智能体在 session 工作区中生成的文件，可用于排查执行结果或下载做离线分析。不包含用户上传的 `assets/`。

## 命令参考

### 列出会话

```bash
# 列出当前用户的会话（默认前 20 条）
pa session list

# 按智能体过滤
pa session list --agent demo

# 查看所有用户的会话（需管理员）
pa session list --scope all --agent demo

# 分页
pa session list --page 2 --limit 10

# JSON 格式输出
pa session list --output json
```

输出列：ID、Agent、Title、Status、Updated

底部分页信息：`Showing 1-20 of 83 (page 1/5)`

### 查看会话详情

```bash
pa session get <session-id>
```

输出包含：
- 基本信息（标题、状态、智能体、创建/更新时间）
- 阶段执行状态列表（每个阶段的 label、status、关联技能）

JSON 模式输出完整详情（含消息列表）：
```bash
pa session get <session-id> --output json
```

### 删除会话

```bash
# 需确认
pa session delete <session-id>

# 跳过确认
pa session delete <session-id> -f
```

### 查看运行日志

```bash
# 默认最近 50 条
pa session logs <session-id>

# 限制条数
pa session logs <session-id> --limit 20

# JSON 格式（含完整参数和结果）
pa session logs <session-id> --output json
```

每条日志显示：时间、类型（tool_call/reasoning/system_tool）、工具名、状态、内容摘要。

日志类型说明：
- `tool_call`：智能体调用的工具（🔧 图标）
- `reasoning`：推理过程（📋 图标）
- `system_tool`：系统工具调用

### 查看会话反馈

```bash
pa session feedback <session-id>
```

输出包含：
- **用户反馈**：结果质量、流程设计、运行执行三项 1-5 星评分
- **管理员评价**：同维度评分（如有）

```bash
pa session feedback <session-id> --output json
```

### 查看与下载 workspace 文件

```bash
# 列出当前 session 生成的 workspace 文件
pa session workspace list <session-id>

# JSON 输出原始文件列表
pa session workspace list <session-id> --output json

# 下载某个生成文件；默认保存到当前目录
pa session workspace download <session-id> reports/summary.md

# 指定本地保存路径
pa session workspace download <session-id> reports/summary.md -o ./analysis/summary.md

# 仅输出下载元数据（sessionId / workspacePath / outputPath）
pa session workspace download <session-id> reports/summary.md --output json
```

文件列表会返回：`path`、`type`、`size`、`modifiedAt`。
下载命令只允许访问 session workspace 中可公开分析的生成文件，不包含 `assets/` 和隐藏目录。

## 会话状态说明

| 状态 | 说明 |
|------|------|
| `active` | 进行中 |
| `waiting` | 等待用户输入 |
| `completed` | 已完成 |
| `error` | 执行出错 |

## 常见场景

### 查看某个智能体的会话历史

```bash
pa session list --agent demo
```

### 排查会话执行问题

```bash
# 1. 查看会话状态和阶段
pa session get <session-id>

# 2. 查看运行日志
pa session logs <session-id> --limit 20

# 3. 列出并下载生成文件做离线分析
pa session workspace list <session-id>
pa session workspace download <session-id> reports/summary.md
```

### 查看用户对会话的评价

```bash
pa session feedback <session-id>
```

### 清理旧会话

```bash
pa session delete <session-id> -f
```
