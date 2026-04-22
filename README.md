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

## 命令列表

### 智能体管理

```bash
pa agent list                              # 列出全部匹配的智能体（自动拉取所有分页）
pa agent list --all                        # 包括未激活的
pa agent list --category <id>              # 按分类过滤
pa agent list --output json                # JSON 格式输出

pa agent upload ./my-agent/                # 上传目录
pa agent upload ./agent.yaml               # 上传 yaml
pa agent upload ./agent.zip                # 上传 zip
pa agent upload ./my-agent/ --overwrite    # 覆盖同名

pa agent download demo                     # 下载为 demo.zip
pa agent download demo -o ./demo.zip       # 指定输出路径

pa agent delete demo                       # 需确认
pa agent delete demo -f                    # 跳过确认
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

pa skill delete my-skill                   # 需确认
pa skill delete my-skill -f                # 跳过确认
```

### 会话管理

```bash
pa session list                            # 列出会话（默认前 20 条）
pa session list --agent demo               # 按智能体过滤
pa session list --scope all --agent demo   # 所有用户（需管理员）
pa session list --page 2 --limit 10        # 分页
pa session list --output json              # JSON 格式

pa session get <id>                        # 查看详情（阶段状态等）
pa session get <id> --output json          # 完整详情（含消息）

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

pa session delete <id>                     # 需确认
pa session delete <id> -f                  # 跳过确认
```

`session workspace` 仅暴露智能体在 session workspace 中生成的文件，不包含用户上传的 `assets/` 内容。

## 全局选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--output <format>` | 输出格式：table 或 json | table |
| `--server <url>` | 临时覆盖服务器地址 | 配置值 |
| `--version` | 显示版本 | - |
| `--help` | 显示帮助 | - |

## AI Agent Skills

CLI 附带 4 个 AI Agent Skills，可供 Claude Code 等 AI Agent 使用。

### 安装 Skills

在项目目录下执行：

```bash
pa skills-install
```

这会将 4 个 skills 安装到当前项目的 `.claude/skills/` 目录。安装后重启 Claude Code 即可自动加载。

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
│   ├── agent/          # agent list/upload/download/delete
│   ├── skill/          # skill list/import/delete
│   ├── session/        # session list/get/delete/logs/feedback
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
