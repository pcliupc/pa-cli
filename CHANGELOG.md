# PA CLI 更新记录

## 1.11.0

### 新增

- **普通 PA 任务调用**：`pa task submit/get/wait/respond/result` 支持提交业务参数和附件、查询进展、处理问题与审批，以及获取结构化结果和文件。
- **任务控制**：提供 `start/stop/recover/resume/continue-budget`，使用服务端提供的准确上下文和稳定命令 ID；任务命令可用 `--profile` 选择环境，不改变全局 Profile。
- **结果下载校验**：按准确文件版本下载并验证 SHA-256，保留已有文件，不覆盖同名目标。
- **Knowledge 资料库**：`pa knowledge` 支持文档与目录管理，Markdown/CSV 的创建、正文读取与更新，以及文档目录调整和删除确认。
- **Session 摘要与 Agent 业务洞察**：`pa session summarize`、`pa agent insights` 和 `pa insights job --wait` 支持异步生成、恢复等待和结果下载。默认保存在本地，显式 `--persist` 才覆盖正式结果。
- **`pa-task` Skill**：`pa skills-install` 现在提供 8 个随包 Skills，可安装到 Codex 的 `.agents/skills/` 或 Claude Code 的 `.claude/skills/`。

### 改进

- API 错误保留服务端错误码、翻译 key 和已知任务身份，便于调用方处理冲突、过期和恢复。
- 支持带请求体的 DELETE；完善资料库 revision 并发校验和非交互删除确认。
- 完善洞察任务的中断、超时、过期及部分失败处理。
- 校准 README 和随包 Skill 的洞察命令示例，与当前业务洞察实现一致。

### 使用说明

- 新命令依赖目标 PA 平台已部署相应 API；更新 CLI 不会更新平台服务。
- `pa task` 面向普通 PA；任务中途仍可能等待问题、工具审批或阶段确认。CLI 不会自动批准，也不会自动追加预算。
- `task wait` 超时或 Ctrl-C 仅结束本地等待，不会停止平台任务；正常查询退出码不代表任务成功，请检查任务状态。
- 已完成普通任务只读；新要求需要创建新任务。
- Agent 设计分析已并入业务洞察；`--type all` 兼容为业务洞察，单独的 `--type design` 和按 `--version` 生成不受支持。
- 更新后执行 `pa skills-install --dir .agents/skills` 或项目实际使用的 Skills 目录，并重新加载 Agent。

## 1.10.0 — 2026-07-08

上一公开 npm 版本。本次更新范围为该版本之后累计的 CLI 改动。
