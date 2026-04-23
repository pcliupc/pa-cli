---
name: pa-agent
version: 1.0.0
description: "PA 智能体管理：列出、查看配置、上传、下载、删除流程智能体。当用户需要查看智能体列表、获取智能体配置（config.yaml）、上传新智能体（yaml/zip/目录）、下载智能体配置、删除智能体时触发。"
metadata:
requires:
bins: ["pa"]
cliHelp: "pa agent --help"
---

# PA 智能体管理

**CRITICAL — 开始前 MUST 先读取 [`../pa-shared/SKILL.md`](../pa-shared/SKILL.md)，其中包含配置、认证规则。**

## 核心概念

- **智能体（Agent）**：流程智能体，包含多个阶段（Stage），每个阶段可配置技能（Skill）。
- **config.yaml**：智能体的配置文件，定义阶段、人设、MCP 服务器等。
- **Private Skill**：智能体私有的技能，存储在智能体目录的 `skills/` 子目录中。

## 命令参考

### 列出智能体

```bash
# 列出所有激活的智能体
pa agent list

# 包括未激活的
pa agent list --all

# 按分类过滤
pa agent list --category <category-id>

# JSON 格式输出
pa agent list --output json
```

输出列：ID、Name、Description、Active、Stages、Updated

### 获取智能体配置

获取智能体的 config.yaml 原始内容（不包含私有技能和子智能体，仅配置文件本身）。

```bash
# 查看智能体配置
pa agent get demo

# JSON 格式输出
pa agent get demo --output json
```

如需获取完整的智能体包（含技能和子智能体），请使用 `pa agent download` 命令。

### 上传智能体

支持三种输入格式：`.yaml`/`.yml` 文件、`.zip` 压缩包、目录。

```bash
# 上传目录
pa agent upload ./my-agent/

# 上传 yaml 文件
pa agent upload ./agent-config.yaml

# 上传 zip
pa agent upload ./agent.zip

# 覆盖同名智能体
pa agent upload ./my-agent/ --overwrite
```

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

## 常见场景

### 查看有哪些智能体

```bash
pa agent list
```

### 从本地目录创建新智能体

```bash
pa agent upload ./agents/my-new-agent/
```

### 备份智能体

```bash
pa agent download demo -o ./backups/demo-$(date +%Y%m%d).zip
```

### 查看智能体配置

```bash
pa agent get demo
```
