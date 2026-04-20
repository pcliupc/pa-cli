# PA CLI

PA Framework 命令行工具，通过命令行管理流程智能体平台的智能体、技能和会话。

## 安装

### 全局安装

```bash
npm install -g github:pcliupc/pa-cli
```

安装后 `pa` 命令可直接使用：

```bash
pa --help
```

### 免安装直接运行

```bash
npx github:pcliupc/pa-cli --help
```

## 快速上手

### 1. 配置服务器地址

指向你的 PA Web 平台地址：

```bash
pa config set serverUrl https://your-pa-instance.example.com
```

### 2. 配置 API Key

联系平台管理员获取 API Key，然后配置：

```bash
pa config set apiKey pa_your_api_key_here
```

### 3. 开始使用

```bash
pa agent list
pa skill list
pa session list
```

### 查看当前配置

```bash
pa config
```

输出（API Key 自动脱敏）：
```
serverUrl: https://your-pa-instance.example.com
apiKey:    pa_yo*********ere
```

## 命令列表

### 智能体管理

```bash
pa agent list                              # 列出所有智能体
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

pa session delete <id>                     # 需确认
pa session delete <id> -f                  # 跳过确认
```

## 全局选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--output <format>` | 输出格式：table 或 json | table |
| `--server <url>` | 临时覆盖服务器地址 | 配置值 |
| `--version` | 显示版本 | - |
| `--help` | 显示帮助 | - |

## AI Agent Skills

CLI 附带 4 个 AI Agent Skills（位于 `skills/` 目录），可供 Claude Code 等 AI Agent 使用：

| Skill | 说明 |
|-------|------|
| `pa-shared` | 共享基础：配置、认证、全局选项 |
| `pa-agent` | 智能体管理 |
| `pa-skill` | 技能管理 |
| `pa-session` | 会话管理 |

## 认证

CLI 使用 API Key 认证。API Key 由 PA 平台管理员在服务端配置（环境变量 `PA_CLI_API_KEY`），用户通过 `pa config set apiKey` 配置到本地。

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
│   └── config.ts       # config set/view
├── lib/
│   ├── api-client.ts   # HTTP 客户端（认证、错误处理、文件上传下载）
│   ├── config.ts       # ~/.pa-cli/config.json 读写
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
