# PA CLI

PA Framework 命令行工具，通过命令行管理智能体和技能。

## 安装

```bash
cd cli
npm install
npm run build
npm link    # 全局注册 pa 命令
```

## 快速上手

### 1. 配置服务器地址

```bash
pa config set serverUrl http://localhost:3000
```

### 2. 配置 API Key

先在 Web 项目的 `.env` 文件中设置：

```
PA_CLI_API_KEY=pa_dev_test_key
```

然后在 CLI 中配置（两边 key 要一致）：

```bash
pa config set apiKey pa_dev_test_key
```

### 3. 查看当前配置

```bash
pa config
```

输出：
```
serverUrl: http://localhost:3000
apiKey:    pa_de*******key
```

## 命令列表

### 智能体管理

```bash
# 列出所有智能体
pa agent list
pa agent list --all                    # 包括未激活的
pa agent list --category <id>          # 按分类过滤
pa agent list --output json            # JSON 格式输出

# 上传智能体（支持 yaml / zip / 目录）
pa agent upload ./my-agent/            # 上传目录
pa agent upload ./agent.yaml           # 上传 yaml
pa agent upload ./agent.zip            # 上传 zip
pa agent upload ./my-agent/ --overwrite  # 覆盖同名

# 下载智能体
pa agent download demo                 # 下载为 demo.zip
pa agent download demo -o ./downloads/demo.zip  # 指定路径

# 删除智能体
pa agent delete demo                   # 需确认
pa agent delete demo -f                # 跳过确认
```

### 技能管理

```bash
# 列出所有技能
pa skill list
pa skill list --search "关键词"        # 搜索
pa skill list --category utility       # 按分类过滤
pa skill list --output json            # JSON 格式输出

# 导入技能（支持 zip / 目录）
pa skill import ./my-skill/            # 导入目录
pa skill import ./skill.zip            # 导入 zip
pa skill import ./my-skill/ --overwrite --category ai --tags "tag1,tag2"

# 删除技能
pa skill delete my-skill               # 需确认
pa skill delete my-skill -f            # 跳过确认
```

## 全局选项

```bash
--output <format>   # 输出格式：table（默认）或 json
--server <url>      # 临时覆盖服务器地址
--version           # 显示版本
--help              # 显示帮助
```

## 开发

```bash
npm run dev -- <command>     # 开发模式运行（tsx，无需 build）
npm run build                # 编译 TypeScript
npm test                     # 运行测试
npm run test:watch           # 监听模式运行测试
```

## 认证说明

CLI 使用 API Key 认证（Bearer Token）。API Key 通过环境变量 `PA_CLI_API_KEY` 配置在 Web 服务端，CLI 侧通过 `pa config set apiKey` 配置。

当前为环境变量方案（单一 API Key），适合开发/内部使用。未来可迁移到数据库存储的 per-user API Key。
