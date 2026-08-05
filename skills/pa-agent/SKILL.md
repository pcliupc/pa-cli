---
name: pa-agent
version: 1.0.0
description: "PA 智能体管理：列出逻辑 Agent、查看当前发布版本配置、上传新 Agent 或新版本、查看/发布版本、下载、删除，以及为单个 Agent 生成业务洞察和设计洞察。当用户需要管理 Agent 与版本，或用 local/persist 模式查看覆盖率、验证洞察价值、覆盖当前正式洞察时触发。"
metadata:
requires:
bins: ["pa"]
cliHelp: "pa agent --help"
---

# PA 智能体管理

**CRITICAL — 开始前 MUST 先读取 [`../pa-shared/SKILL.md`](../pa-shared/SKILL.md)，其中包含配置、认证规则。**

## 核心概念

- **逻辑智能体（Logical Agent）**：稳定的 Agent 标识，下面可以包含多个不可变版本。
- **智能体版本（Agent Version）**：某次上传生成的不可变运行快照，例如 `v1`、`v2`、`v3`。
- **当前发布版本（Current Published Version）**：逻辑 Agent 当前默认给新 session 使用的版本。
- **config.yaml**：智能体的配置文件，定义阶段、人设、MCP 服务器等。
- **Private Skill**：智能体私有的技能，存储在智能体目录的 `skills/` 子目录中。
- **Agent 洞察**：基于已有 Session Insight 生成的 business 和 design 两类聚合结果；始终使用平台已有模型、密钥和默认 prompt。
- **覆盖率（Coverage）**：生成前显示 `total`、`usable`、`included`，说明窗口内总 Session、已有可用 Session Insight 和实际纳入生成的数量。
- **local / persist**：`local` 是默认模式，只保留任务结果和本地评估文件；`persist` 必须显式指定，成功后覆盖对应正式 snapshot component。

版本语义规则：

- 上传一个全新的 Agent，会创建一个新的逻辑 Agent，并生成首个版本 `v1`。
- 向一个已存在的逻辑 Agent 再次上传，不会覆盖旧版本，而是创建新版本。
- Session 总是绑定到创建时选中的具体版本，不会随着后续上传或重新发布而漂移。
- 未显式指定版本时，平台默认使用该逻辑 Agent 的当前发布版本。

## 命令参考

### 列出智能体

```bash
# 列出所有激活的智能体
pa agent list

# 包括未激活的
pa agent list --all

# 按分类过滤
pa agent list --category <category-id>

# 按空间过滤
pa agent list --space <space-id>

# JSON 格式输出
pa agent list --output json
```

输出列：ID、Name、Description、Active、Current Version、Versions、Stages、Updated

JSON 输出重点关注：

- `current_version_number`
- `version_count`

### 获取当前发布版本配置

获取逻辑 Agent 当前发布版本的 `config.yaml` 原始内容（不包含私有技能和子智能体，仅配置文件本身）。

```bash
# 查看当前发布版本配置
pa agent get demo

# JSON 格式输出
pa agent get demo --output json
```

如需查看某个具体版本的快照，请优先使用 `pa agent version get`。如需获取完整的智能体包（含技能和子智能体），请使用 `pa agent download` 命令。

### 上传智能体

支持三种输入格式：`.yaml`/`.yml` 文件、`.zip` 压缩包、目录。

```bash
# 上传目录
pa agent upload ./my-agent/

# 上传 yaml 文件
pa agent upload ./agent-config.yaml

# 上传 zip
pa agent upload ./agent.zip

# 给已有逻辑 Agent 创建新版本
pa agent upload ./my-agent-v2/ --agent demo

# 上传到指定空间
pa agent upload ./my-agent/ --space <space-id>
```

上传规则：

- `pa agent upload <path>`：如果目标 Agent 不存在，创建新的逻辑 Agent 和 `v1`。
- `pa agent upload <path> --agent <id>`：给已有逻辑 Agent 创建新版本。
- `--space <id>`：可选，将 Agent 上传到指定空间。不指定时上传到默认空间。
- 不再使用 `--overwrite` 作为 Agent 更新语义；旧版本保持不可变。

### 管理智能体版本

```bash
# 列出某个逻辑 Agent 的全部版本
pa agent version list demo

# 查看某个版本的配置快照
pa agent version get demo v2

# 基于已有版本创建新版本
pa agent version create demo --from v2 ./my-agent-v3/

# 发布某个版本为当前默认版本
pa agent version publish demo v3
```

版本命令适用场景：

- 需要明确查看或核对某个历史版本时，用 `version get`
- 需要从某个已知稳定版本继续演进时，用 `version create --from`
- 需要切换新 session 默认版本时，用 `version publish`

### 下载智能体

```bash
# 下载为 <id>.zip
pa agent download demo

# 指定输出路径
pa agent download demo -o ./downloads/demo.zip
```

### 删除智能体

```bash
# 需确认
pa agent delete demo

# 跳过确认
pa agent delete demo -f
```

### 生成 Agent 洞察

```bash
# 默认生成 business + design，结果为 local
pa agent insights <agent-id>

# 只生成业务洞察
pa agent insights <agent-id> --type business

# 生成指定 Agent Version 的设计洞察
pa agent insights <agent-id> --type design --version <agent-version-id>

# 生成成功后直接覆盖对应正式 component
pa agent insights <agent-id> --persist --type all

# 覆盖率不足时，不询问并直接使用已有有效样本
pa agent insights <agent-id> --use-available

# 指定本地评估结果根目录
pa agent insights <agent-id> --output-dir ./insight-evaluations
```

生成前必须先看 CLI 输出的 business / design 覆盖率：

- 覆盖不完整时，交互终端会询问是否继续，只有输入 `y` 或 `yes` 才继续。
- 非交互环境和 `--output json` 不能询问，必须显式传 `--use-available`。
- `--use-available` 只使用当前已有的有效 Session Insight，不会自动补齐缺失摘要或诊断。
- `--persist` 会直接覆盖正式结果；除非用户明确要求，否则保持默认 local。

默认结果写入 `.pa/evaluations/<job-id>/`：

- `manifest.json`：任务状态、覆盖率、输入 basis、模型、prompt hash、generator version 和 component 元数据
- `business/insights.md`：业务洞察（如请求）
- `design/insights.md`：设计洞察（如请求）

如果 CLI 因 `Ctrl-C`、等待超时或轮询网络失败停止等待，平台任务仍以数据库状态为准。使用创建时输出的 job ID 恢复：

```bash
pa insights job <job-id> --wait
pa insights job <job-id> --wait --output-dir ./insight-evaluations
```

只有 `generated` 和 `persisted` 是完整成功。`partial` 会保留成功 component 供检查，但与 `failed`、`expired` 一样返回非零退出码；local 结果过期后接口返回 `410`，需要重新生成。

## 常见场景

### 查看有哪些智能体

```bash
pa agent list
```

### 从本地目录创建新智能体

```bash
pa agent upload ./agents/my-new-agent/
```

### 为已有智能体发布新版本

```bash
pa agent upload ./agents/demo-v2/ --agent demo
pa agent version publish demo v2
```

### 备份智能体

```bash
pa agent download demo -o ./backups/demo-$(date +%Y%m%d).zip
```

### 查看智能体配置

```bash
pa agent get demo
```

### 查看某个历史版本的配置

```bash
pa agent version get demo v1
```

### 先验证洞察价值，再决定是否覆盖正式结果

```bash
# 第一次保持 local，检查覆盖率和本地结果
pa agent insights demo --type all --output-dir ./agent-insight-evaluations

# 用户确认结果可作为正式快照后，再显式 persist
pa agent insights demo --type all --persist
```

如果覆盖率不足，应把 `total / usable / included` 告知用户；只有用户接受基于现有样本生成时才确认继续或增加 `--use-available`。
