---
name: pa-skill
version: 1.0.0
description: "PA 技能管理：列出、导入、删除技能（Skill）。当用户需要查看技能列表、搜索技能、导入新技能（zip/目录）、删除技能时触发。"
metadata:
requires:
bins: ["pa"]
cliHelp: "pa skill --help"
---

# PA 技能管理

**CRITICAL — 开始前 MUST 先读取 [`../pa-shared/SKILL.md`](../pa-shared/SKILL.md)，其中包含配置、认证规则。**

## 核心概念

- **技能（Skill）**：智能体可使用的可复用能力单元，包含 SKILL.md（frontmatter + 正文）和相关文件。
- **Marketplace Skill**：发布到技能市场的公共技能，可被任意智能体引用。
- **Private Skill**：智能体私有的技能，存储在智能体目录的 `skills/` 子目录中（本 skill 不涉及，见 pa-agent）。

## 命令参考

### 列出技能

```bash
# 列出所有技能
pa skill list

# 按关键词搜索
pa skill list --search "PDF"

# 按分类过滤
pa skill list --category utility

# JSON 格式输出
pa skill list --output json
```

输出列：Name、Display Name、Version、Category、Downloads、Updated

### 导入技能

支持 `.zip` 文件和目录。

```bash
# 从目录导入
pa skill import ./my-skill/

# 从 zip 导入
pa skill import ./skill.zip

# 覆盖同名技能
pa skill import ./my-skill/ --overwrite

# 设置分类和标签
pa skill import ./my-skill/ --category ai --tags "pdf,document,generation"
```

### 删除技能

```bash
# 需确认
pa skill delete my-skill-name

# 跳过确认
pa skill delete my-skill-name -f
```

**注意**：如果技能被智能体引用，删除会失败并提示引用列表。需先解除引用才能删除。

## 常见场景

### 查看平台有哪些可用技能

```bash
pa skill list
```

### 搜索特定功能的技能

```bash
pa skill list --search "会议"
```

### 导入自定义技能

```bash
pa skill import ./skills/my-custom-skill/ --category utility --tags "custom,internal"
```
