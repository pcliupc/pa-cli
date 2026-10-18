# PA CLI

PA Framework 命令行工具，通过命令行管理流程智能体平台的智能体、技能和会话。

## 安装

### 全局安装

```bash
npm install -g @pcliupc/pa-cli
```

安装后 `pa` 命令可直接使用：

```bash
pa --help
```

### 免安装直接运行

```bash
npx @pcliupc/pa-cli --help
```

### 更新到最新版本

```bash
npm install -g @pcliupc/pa-cli@latest
```

## 快速上手

### 1. 添加环境 Profile

PA CLI 支持多环境配置（Profile），每个 Profile 独立存储 serverUrl 和 apiKey。先在 PA Web 平台登录你自己的账号，然后打开 `/pa/profile/api-keys` 创建一个新的 API Key。复制后在本机配置：

```bash
# 添加一个 Profile（第一个会自动激活）
pa config profile add local --server-url http://localhost:3000 --api-key pa_your_api_key_here
```

需要多个环境时继续添加：

```bash
pa config profile add staging --server-url https://staging.pa.io --api-key pa_staging_key
pa config profile add prod --server-url https://pa.io --api-key pa_prod_key
```

> **Profile 命名规则：** 只允许字母、数字、连字符、下划线，最长 32 字符，不允许 `default`。

### 2. 切换环境

```bash
pa config use staging    # 切换到 staging 环境
pa config                # 查看当前配置
```

输出（API Key 自动脱敏）：
```
Profile: staging
serverUrl: https://staging.pa.io
apiKey:    pa_st*********key
```

### 3. 开始使用

```bash
pa agent list
pa skill list
pa session list
pa live-artifact list
pa example list
```

### 多环境 Profile 管理

```bash
pa config profile list              # 查看所有 Profile
pa config use <name>                # 切换环境
pa config set serverUrl <url>       # 修改当前 Profile 的地址
pa config set apiKey <key>          # 修改当前 Profile 的 Key
pa config profile remove <name>     # 删除 Profile
```

切换 Profile 后，所有后续命令自动使用该环境的 serverUrl 和 apiKey。

### AI 配置管理

```bash
pa ai config get                                  # 查看当前 AI 配置（stored/effective）
pa ai config get --output json                    # JSON 输出完整结构

pa ai config template --provider qwen             # 打印 qwen 模板到 stdout
pa ai config template --provider glm -o ai.json   # 生成 glm 模板文件

pa ai config add --file ./ai-config.json          # 严格新增（已有配置时失败）
pa ai config update --file ./ai-config.json       # 严格更新（无配置时失败）
pa ai config delete                               # 删除配置（需确认）
pa ai config delete --force                       # 跳过确认，硬删除并回落 env
```

`add/update` 的 JSON 结构需包含：
- `provider`: `qwen` 或 `glm`
- `baseUrl`
- `fastModel`
- `strongModel`
- `pricingConfig`（结构与 `PA_SESSION_USAGE_PRICING_JSON` 一致）
- `apiKey`：`add` 必填，`update` 可选（传入即轮换）

### 用量统计治理

```bash
pa usage get                                 # 查看平台总览用量
pa usage get --date-from 2026-07-01 --date-to 2026-07-07
                                             # 按日期区间查看平台总览用量（含边界）
pa usage clear                               # 清空平台用量统计并重置游标日期基线（需确认）
pa usage clear --force                       # 跳过确认
```

## 命令列表

### 智能体管理

```bash
pa agent list                              # 列出全部匹配的智能体（自动拉取所有分页）
pa agent list --all                        # 包括未激活的
pa agent list --category <id>              # 按分类过滤
pa agent list --output json                # JSON 格式输出
                                           # 包含 current_version_number/version_count

pa agent upload ./my-agent/                # 上传目录
pa agent upload ./agent.yaml               # 上传 yaml
pa agent upload ./agent.zip                # 上传 zip
pa agent upload ./my-agent-v2/ --agent demo
                                           # 给已有逻辑 Agent 创建新版本

pa agent version list demo                 # 列出 demo 的全部版本
pa agent version get demo v2               # 查看某个版本快照
pa agent version create demo ./my-agent-v3 --from v2
                                           # 基于现有逻辑 Agent 创建新版本
pa agent version publish demo v3           # 切换当前发布版本

pa agent download demo                     # 下载为 demo.zip
pa agent download demo -o ./demo.zip       # 指定输出路径

pa agent insights demo                     # 生成业务 + 设计洞察；默认 local
pa agent insights demo --type business     # 只生成业务洞察
pa agent insights demo --type design --version <version-id>
                                           # 生成指定 Agent Version 的设计洞察
pa agent insights demo --persist           # 成功后覆盖当前正式洞察
pa agent insights demo --use-available     # 覆盖率不足时直接使用现有有效样本

pa agent delete demo                       # 需确认；若已有历史会话则会停用而非彻底删除
pa agent delete demo -f                    # 跳过确认；删除或停用取决于是否已有会话
```

### 技能管理

```bash
pa skill list                              # 列出所有技能
pa skill list --search "关键词"            # 搜索
pa skill list --category utility           # 按分类过滤
pa skill list --output json                # JSON 格式输出

pa skill import ./my-skill/                # 导入目录
pa skill import ./skill.zip                # 导入 zip
pa skill import ./my-skill/ --overwrite --category ai --tags "tag1,tag2"

pa skill download my-skill                 # 下载为 my-skill.zip
pa skill download my-skill -o ./my-skill.zip

pa skill install my-skill                  # 安装到当前项目 .claude/skills/my-skill
pa skill install my-skill --dir /tmp/skills

pa skill delete my-skill                   # 需确认
pa skill delete my-skill -f                # 跳过确认
```

### Knowledge 资料库

```bash
pa knowledge list [--space <space-id>] [--folder <folder-id>] [--search <text>] [--limit <n>] [--offset <n>]
pa knowledge get <document-id> [--content] [-o <file>]
pa knowledge create <path|-> [--type md|csv] [--title <title>] [--summary <summary>] [--folder <folder-id>] [--space <space-id>]
pa knowledge update <document-id> [<path|->]
pa knowledge update <document-id> [--title <title>] [--summary <summary>] [--folder <folder-id>] [--root-folder]
pa knowledge delete <document-id> [--force]

pa knowledge folder list [--parent <folder-id>] [--space <space-id>]
pa knowledge folder create <name> [--parent <folder-id>] [--space <space-id>]
pa knowledge folder delete <folder-id> [--space <space-id>] [--force]
```

Knowledge 文本资料支持 `md` 和 `csv`。`.md`/`.markdown` 文件自动识别为 `md`，`.csv` 文件自动识别为 `csv`；也可以用 `--type md` 或 `--type csv` 显式指定。CLI 的 `md` 类型会映射为 Web API 的 `doc` 类型。使用 stdin（路径为 `-`）时必须显式提供 `--type` 和 `--title`，例如：

```bash
pa knowledge create - --type md --title "临时资料" < ./notes.md
```

不带 `--space` 时，创建资料或目录到当前用户的个人资料库；带 `--space <space-id>` 时，目标是指定 Space。文档的 `get`、`update` 和 `delete` 按文档自身的权限校验，不需要重复传入 `--space`。`--folder` 将资料放入指定目录；`--root-folder` 将资料移回根目录。目录命令的 `--parent` 用于创建或列出指定父目录下的目录。

`pa knowledge get <document-id> --content` 将 Markdown/CSV 正文输出到 stdout；配合 `-o <file>` 可写入文件并自动创建父目录：

```bash
pa knowledge get <document-id> --content -o ./backup.md
```

删除文档和目录时，交互式终端会要求确认；非交互环境没有 `--force` 时会直接拒绝删除。`--force` 只跳过 CLI 确认，不绕过服务端权限、目录非空或 revision 并发校验。

### 会话管理

```bash
pa session list                            # 列出会话（默认前 20 条）
pa session list --agent demo               # 按智能体过滤
pa session list --scope all --agent demo   # 所有用户（需管理员）
pa session list --page 2 --limit 10        # 分页
pa session list --output json              # JSON 格式
                                           # 包含 agent_version_id/agent_version_number

pa session get <id>                        # 查看详情（阶段状态等）
pa session get <id> --output json          # 完整详情（含消息）
                                           # 会显示绑定的 Agent Version

pa session logs <id>                       # 运行日志
pa session logs <id> --limit 20            # 限制条数
pa session logs <id> --output json         # 完整日志

pa session feedback <id>                   # 查看反馈评分
pa session feedback <id> --output json     # 完整反馈

pa session workspace list <id>             # 列出 session 生成的 workspace 文件
pa session workspace list <id> --output json

pa session workspace download <id> reports/out.md
pa session workspace download <id> reports/out.md -o ./analysis/out.md
pa session workspace download <id> reports/out.md --output json
                                           # JSON 输出下载元数据
                                           # 不传 -o 时默认保存到当前目录

pa session summarize <id>                  # 生成摘要；默认 local，不改正式结果
pa session summarize <id> --persist        # 成功后覆盖当前正式 Session Insight
pa session summarize <id> --output-dir ./evaluations
                                           # 指定本地评估结果根目录

pa session delete <id>                     # 需确认
pa session delete <id> -f                  # 跳过确认
```

`session workspace` 仅暴露智能体在 session workspace 中生成的文件，不包含用户上传的 `assets/` 内容。

### Session 摘要与 Agent 洞察生成

PACLI 可以调用平台已有的模型、密钥和默认 prompt，对单个 Session 或 Agent 发起异步生成任务。CLI 不接受模型、密钥或 prompt 覆盖参数。

#### local 与 persist

- 默认是 `local`：结果落到 `.pa/evaluations/<job-id>/`，同时保留在短期 generation job 结果中；不进入正式 Web 洞察页面，也不覆盖 `pa_session_insights` 或正式 Agent snapshot。需要读取任务结果时使用当前用户有权限的 CLI / 结果 API。
- 显式传 `--persist`：生成成功后直接覆盖当前正式结果，同时仍把本次结果下载到本地，便于对照验证。
- 两种模式都经过同一个平台 generation job、Runner、模型配置和默认 prompt；差别只在是否提交到正式洞察表。

默认输出目录是当前目录下的 `.pa/evaluations/<job-id>/`，也可以通过 `--output-dir <path>` 修改根目录。目录结构如下：

```text
.pa/evaluations/<job-id>/
├── manifest.json
├── summary.md                    # Session 摘要任务
├── diagnostics/summary.md        # Session 执行诊断
├── business/insights.md          # Agent 业务洞察（如请求）
└── design/insights.md            # Agent 设计洞察（如请求）
```

`manifest.json` 包含任务状态、输入 basis、覆盖率、模型、prompt hash、generator version 和各 component 结果，适合后续比较 prompt 或生成策略。

#### 生成 Session 摘要

```bash
# 默认 local：不修改正式 Session Insight
pa session summarize <session-id>

# 覆盖正式 Session Insight，并保留本地评估文件
pa session summarize <session-id> --persist

# 指定本地输出根目录
pa session summarize <session-id> --output-dir ./insight-evaluations
```

#### 生成 Agent 洞察

```bash
# 默认生成 business + design，结果为 local
pa agent insights <agent-id>

# 只生成一个 component
pa agent insights <agent-id> --type business
pa agent insights <agent-id> --type design --version <agent-version-id>

# 覆盖成功生成的正式 component
pa agent insights <agent-id> --persist --type all

# 非交互环境在覆盖率不足时，显式接受现有有效样本
pa agent insights <agent-id> --use-available
```

命令会在创建任务前显示 business / design 的 `total`、`usable`、`included` 覆盖率。覆盖率不足时：

- 交互终端会询问是否继续，只有输入 `y` 或 `yes` 才使用现有有效样本。
- 非交互环境和 `--output json` 不会询问，必须显式传 `--use-available`。
- `--use-available` 不会补生成缺失的 Session Insight，只会使用当前已有的有效样本。

#### 中断后恢复任务

CLI 收到 `Ctrl-C`、等待超时或轮询网络失败时会停止本地等待，但平台任务仍以数据库状态为准。完成、失败等终态输出会包含 job ID；中断、超时或轮询失败时，错误提示也会给出可恢复的 job ID。CLI 不承诺在创建任务瞬间单独打印 job ID。取得 job ID 后可恢复等待和下载：

```bash
pa insights job <job-id> --wait
pa insights job <job-id> --wait --output-dir ./insight-evaluations
```

任务状态为 `generated` 或 `persisted` 时命令成功；`partial`、`failed` 或 `expired` 会返回非零退出码。local 任务结果有保留期限，过期后接口返回明确的 `410`，需要重新生成。

### 用量统计治理

```bash
pa usage get                                 # 查看平台总览用量
pa usage get --date-from 2026-07-01 --date-to 2026-07-07
                                             # 按日期区间查看平台总览用量（含边界）
pa usage clear                               # 清空平台用量统计并重置游标日期基线（需确认）
pa usage clear --force                       # 跳过确认
```

### 示例库管理

```bash
pa example list                                     # 列出示例（默认当前/默认空间）
pa example list --space default --search "demo"    # 按空间和关键词过滤
pa example list --output json                       # JSON 格式输出

pa example export-session <sessionId>               # 导出 session 示例包（zip）
pa example export-session <sessionId> -o ./bundle.zip
pa example export-session <sessionId> --as-dir      # 同时解压到同名目录
pa example export-session <sessionId> --as-dir ./bundle-dir

pa example import ./pa-example-bundle.zip           # 导入示例包
pa example import ./bundle-dir --space default      # 从目录导入（CLI 自动打包）
pa example import ./bundle.zip --force              # 同 space 同 digest 覆盖
pa example import ./bundle.zip --require-agent-match
                                                   # 强校验 agentId@version 存在

pa example delete <exampleId>                       # 需确认
pa example delete <exampleId> -f                    # 跳过确认
```

### Live Artifact 管理

```bash
pa live-artifact list                              # 列出所有 live artifact（自动分页）
pa live-artifact list --space <id>                 # 按空间过滤
pa live-artifact list --status published           # 按状态过滤（published/archived/all）
pa live-artifact list --scope all                  # 查看所有用户（需管理员）
pa live-artifact list --search "关键词"            # 按标题搜索
pa live-artifact list --output json                # JSON 格式输出

pa live-artifact get <id>                          # 查看详情

pa live-artifact publish --session <id> --dir <path>
                                                   # 从 session workspace 发布
pa live-artifact publish --session <id> --dir build/app --title "My App"
                                                   # 指定标题

pa live-artifact update <id> --status archived     # 修改状态
pa live-artifact update <id> --title "New Title"   # 修改标题

pa live-artifact refresh <id>                      # 重新构建 bundle

pa live-artifact delete <id>                       # 需确认
pa live-artifact delete <id> -f                    # 跳过确认

pa live-artifact source-docs <id> list              # 列出 source documents
pa live-artifact source-docs <id> add --path <path> # 添加 source document
pa live-artifact source-docs <id> remove <docId>    # 移除 source document
```

Live Artifact 支持 html-app（HTML Bundle）和 course（Markdown Flow）两种类型，类型由 bundle 目录中的 `manifest.json` 自动决定，CLI 命令无需区分。

## Agent 版本模型

- `pa_agents` 是逻辑 Agent，一个逻辑 Agent 下面可以有多个不可变版本。
- 每次对已有逻辑 Agent 再次上传，都会创建新版本，而不是覆盖旧版本。
- 每个逻辑 Agent 都有一个“当前发布版本”，新建 session 默认绑定它。
- session 一旦创建，就固定绑定到具体版本；后续发布新版本不会改变历史 session。

## 全局选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--output <format>` | 输出格式：table 或 json | table |
| `--server <url>` | 临时覆盖服务器地址 | 配置值 |
| `--version` | 显示版本 | - |
| `--help` | 显示帮助 | - |

## AI Agent Skills

CLI 附带 7 个 AI Agent Skills，可供 Claude Code 等 AI Agent 使用。

### 安装 Skills

在项目目录下执行：

```bash
pa skills-install
```

这会将 7 个 skills 安装到当前项目的 `.claude/skills/` 目录。安装后重启 Claude Code 即可自动加载。

也可指定目标目录：

```bash
pa skills-install --dir /path/to/project/.claude/skills
```

### 包含的 Skills

| Skill | 说明 |
|-------|------|
| `pa-shared` | 共享基础：配置、认证、全局选项 |
| `pa-agent` | 智能体管理 |
| `pa-skill` | 技能管理 |
| `pa-session` | 会话管理 |
| `pa-space` | 空间管理 |
| `pa-mcp` | MCP 服务器管理 |
| `pa-example` | 示例库管理（list/import/export-session/delete） |

## 认证

CLI 使用 API Key 认证。每个登录用户都可以在 PA Web 平台的 `/pa/profile/api-keys` 页面创建和撤销自己的 API Key。通过 `pa config profile add <name> --api-key <key>` 添加到对应环境的 Profile 中，或使用 `pa config set apiKey <key>` 修改当前 Profile 的 Key。

---

## 开发

适用于需要修改 CLI 源码的开发者。

```bash
# 克隆
git clone https://github.com/pcliupc/pa-cli.git
cd pa-cli

# 安装依赖
npm install

# 开发模式（无需 build，直接运行）
npm run dev -- agent list

# 构建
npm run build

# 运行测试
npm test

# 全局链接（本地开发用）
npm link
```

### 项目结构

```
src/
├── commands/
│   ├── agent/          # agent list/get/upload/download/delete/version
│   ├── skill/          # skill list/import/delete
│   ├── session/        # session list/get/delete/logs/feedback
│   ├── example/        # example list/import/export-session/delete
│   ├── live-artifact/  # live-artifact list/get/publish/update/refresh/delete/source-docs
│   └── config.ts       # config set/view, profile add/list/remove, use
├── lib/
│   ├── api-client.ts   # HTTP 客户端（认证、错误处理、文件上传下载）
│   ├── config.ts       # ~/.pa-cli/ profile 配置读写
│   └── output.ts       # table/json 格式化输出
└── index.ts            # CLI 入口
```

### 依赖

| 包 | 用途 |
|---|---|
| `commander` | CLI 框架 |
| `cli-table3` | 表格输出 |
| `chalk` | 彩色终端输出 |
| `ora` | 加载动画 |


## PA task 调用

普通 PA 任务支持提交业务参数和文件、有限等待、交互回答、停止/恢复及结构化结果。IPA 继续使用原有入口。

先核对当前默认 profile 的名称和服务器地址。现有 `pa agent list/get`、`pa space list` 使用全局当前 profile；task 的 `--profile` 只影响本次任务命令。因此，示例中的 `PROFILE_NAME` 和 Agent/Space ID 必须来自同一已核对环境。不要隐式运行 `pa config use`，也不要读取或展示 API Key；若目标环境不同，由用户明确选择环境或使用已在目标环境核实的 ID。

```bash
pa --output json task submit --profile PROFILE_NAME --agent AGENT_ID --space SPACE_ID \
  --request request.json --idempotency-key feedback-batch-42 --file feedback.csv
pa --output json task wait TASK_ID --profile PROFILE_NAME --timeout 60
pa --output json task get TASK_ID --profile PROFILE_NAME
pa --output json task respond TASK_ID --profile PROFILE_NAME --interaction INTERACTION_ID --request response.json
pa --output json task result TASK_ID --profile PROFILE_NAME --download-dir ./results/batch-42
pa skills-install --dir .agents/skills
```

`request.json` 包含 TaskEnvelope（至少 objective、definitionOfDone）；`--version` 可指定版本。`--profile` 仅影响本次 task 命令，不切换全局环境。网络响应不明时重试原 key 和原内容，不创建重复任务。

控制命令为 `start / stop / recover / resume / continue-budget`，除 start 外须显式 `--command-id`。`--request` 可提供从 `get.allowedActions[].context` 保存的原上下文，支持准确重试。需要用户同意的审批和追加预算由调用方明确决定，不会自动执行。已完成普通任务只读。

等待默认最多 60 秒（包含 HTTP 时间；单次 HTTP 超时 30 秒；`--timeout 0` 只读一次快照），`waitReason` 为 terminal、action_required 或 timeout；成功查询退出 0，即使任务 failed/waiting。API/CLI 错误退出 1，JSON 模式保留 status/errorCode/errorKey；Ctrl-C 退出 130 且不停止任务。业务结果在 `result.result.data`，下载精确版本并验证 SHA-256，拒绝不安全路径且不覆盖已有文件。

任务无需保持调用方连接，但执行仍依赖平台内部 Web→Backend 流；本版本不保证 Web 重启后自动续跑。完整 API 文档和反馈分析 fixture 位于平台仓库 `docs/PA_TASK_API.md`、`docs/examples/pa-task/`。随包的 `pa-task` Skill 可通过上面的 `skills-install` 命令安装给 Codex。
