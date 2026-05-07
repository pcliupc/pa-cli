---
name: pa-space
version: 1.0.0
description: "PA 空间管理：列出和查看空间详情。空间（Space）是平台资源的业务边界和隔离单元。当用户需要查看空间列表、查看某个空间的详细信息、了解空间概念和角色时触发。"
metadata:
requires:
bins: ["pa"]
cliHelp: "pa space --help"
---

# PA 空间管理

**CRITICAL — 开始前 MUST 先读取 [`../pa-shared/SKILL.md`](../pa-shared/SKILL.md)，其中包含配置、认证规则。**

## 核心概念

- **空间（Space）**：平台资源的业务边界和隔离单元。Agent、Skill、MCP Server、Session 等资源都归属于某个空间。
- **默认空间（Default Space）**：所有用户都有默认空间。未指定 `--space` 的写入操作（upload、import、create）默认将资源放入默认空间。
- **空间角色**：用户在空间中拥有不同角色，角色决定可执行的操作权限。

## 命令参考

### 列出空间

列出当前用户可访问的所有空间。

```bash
# 列出所有空间
pa space list

# JSON 格式输出
pa space list --output json
```

输出列：Name、Key、ID、Role

JSON 输出重点关注：
- `id` — 空间唯一标识，用于其他命令的 `--space` 参数
- `key` — 空间标识键
- `name` — 空间显示名称
- `myRole` — 当前用户在该空间中的角色（null 表示默认空间）

### 查看空间详情

```bash
# 查看某个空间的详细信息
pa space get <space-id>
```

输出包含：
- Space 名称和 Key
- 空间 ID
- 空间描述（如有）
- 当前用户在该空间中的角色

## 常见场景

### 查看自己有权访问哪些空间

```bash
pa space list
```

### 确认某个空间的 ID 用于 --space 参数

```bash
pa space list --output json
```

从输出中获取目标空间的 `id`，然后在其他命令中使用 `--space <id>`。

### 获取某个空间的详细信息

```bash
pa space get <space-id>
```
