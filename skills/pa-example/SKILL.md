---
name: pa-example
version: 1.0.0
description: "PA 示例库管理：列出示例、将 session 导出为只读示例包、导入示例包（zip/目录）、删除示例。当用户需要复用高质量历史会话、在空间之间分发示例、导入外部示例包时触发。"
metadata:
requires:
bins: ["pa"]
cliHelp: "pa example --help"
---

# PA 示例库管理

**CRITICAL — 开始前 MUST 先读取 [`../pa-shared/SKILL.md`](../pa-shared/SKILL.md)，其中包含配置、认证规则。**

## 核心概念

- **示例（Example）**：从历史 session 提炼出的可复用内容包，可用于知识沉淀和跨空间分发。
- **示例包（Example Bundle）**：用于导入导出的 `.zip` 包，包含示例元数据、快照和关联资产。
- **只读导出（Read-only Export）**：`export-session` 导出的 bundle 用于分发与复用，不用于继续运行原 session。
- **导入校验（Import Validation）**：导入时可选择强校验目标平台是否存在匹配的 `agentId@version`。

## 命令参考

### 列出示例

```bash
# 列出当前/默认空间示例
pa example list

# 指定空间
pa example list --space default

# 按关键词搜索（标题/摘要/session）
pa example list --search "demo"

# JSON 格式输出
pa example list --output json
```

输出列：ID、Title、Session、Files、Artifacts、Live、Updated

### 从 session 导出示例包

```bash
# 导出 zip（默认文件名 pa-example-bundle.zip）
pa example export-session <sessionId>

# 指定 zip 输出路径
pa example export-session <sessionId> -o ./bundle.zip

# 导出后同时解压到目录
pa example export-session <sessionId> --as-dir
pa example export-session <sessionId> --as-dir ./bundle-dir
```

参数说明：
- `-o, --out <path>`：导出 zip 路径
- `--as-dir [path]`：导出后额外解压到目录；不传 path 时使用 zip 同名目录

### 导入示例包

```bash
# 从 zip 导入
pa example import ./pa-example-bundle.zip

# 从目录导入（CLI 会先自动打包）
pa example import ./bundle-dir

# 导入到指定空间
pa example import ./bundle.zip --space default

# 同 space + 同 digest 时覆盖
pa example import ./bundle.zip --force

# 强制要求目标平台存在匹配的 agentId@version
pa example import ./bundle.zip --require-agent-match
```

参数说明：
- `--space <spaceKey>`：导入目标空间
- `--force`：目标空间存在同 digest 示例时覆盖
- `--require-agent-match`：要求平台有匹配 Agent 及版本，否则导入失败

### 删除示例

```bash
# 需确认
pa example delete <exampleId>

# 跳过确认
pa example delete <exampleId> -f
```

## 安全与边界

- `export-session` 只导出示例复用所需内容，不会把 session 变成可继续执行的运行态。
- `import` 仅支持 `.zip` 或目录输入；目录输入由 CLI 自动打包后上传。
- `delete` 默认交互确认，避免误删示例资产。

## 常见场景

### 把高质量会话沉淀为示例

```bash
pa example export-session <sessionId> -o ./demo-example.zip
```

### 在另一个空间复用示例

```bash
pa example import ./demo-example.zip --space target-space
```

### 快速查看当前空间示例库

```bash
pa example list --space default
```
