---
name: pa-task
description: "Use when a business task should be delegated to an ordinary PA from Codex or another local agent, or when querying, answering, recovering, or downloading results for an existing PA task through PA CLI."
---

# PA tasks via CLI

Use the user's existing PA CLI profile and personal API Key. Never read or print keys. `pa task` targets ordinary PAs; IPA continues to use its existing entry point.

## Availability

Verify `pa task --help` before assuming the installed CLI supports tasks. The target Web must also have `/api/tasks` deployed; a local CLI update does not deploy the API. A repository build does not update the global `pa` installation or publish an npm release. When working from the repository before release, use `node /absolute/repository/path/cli/dist/index.js` in place of `pa` after building the CLI. Do not silently publish, install globally, or switch environments. After an authorized CLI update, refresh this Skill with `pa skills-install --dir .agents/skills` in the intended project.

## Workflow

1. Confirm the current global profile name and server URL, and the intended Space, input, and business goal. Existing `pa agent list/get` and `pa space list` use the global active profile; task `--profile` affects only that task command. Discover the intended ordinary PA with `pa agent list --output json` and `pa agent get <id> --output json`, then use the **same environment** for task submission and follow-up calls. `PROFILE_NAME` below is that verified profile, not a default environment. Never silently run `pa config use`, inspect credential files, or print keys. If the intended target differs from the current profile, have the user explicitly select the environment or use IDs already verified for the target; do not carry IDs across environments.
2. Prepare a TaskEnvelope JSON file with `objective`, `definitionOfDone`, and appropriate `inputs`, `constraints`, `expectedOutputs`, `outputSchema`. Do not set internal owner, lease, or authority fields. A validation pass checks shape, not factual correctness.
3. Choose one stable idempotency key per business task. Save the profile, key, request, attachment paths, returned taskId and sessionUrl. Retry uncertain submissions with the **same key and unchanged bytes**; never create a new key merely because a request timed out.
4. Submit:

```bash
pa --output json task submit --profile PROFILE_NAME --agent AGENT_ID --space SPACE_ID \
  --request request.json --idempotency-key feedback-batch-42 --file feedback.csv
```

`--request` contains the TaskEnvelope itself. `--version VERSION_ID` is optional. Repeat `--file` for more attachments. No file upload step or Session ID lookup is needed. Do not pass cross-task `inputArtifactRefs` or another Session's fileId.

5. Wait in bounded intervals:

```bash
pa --output json task wait TASK_ID --profile PROFILE_NAME --timeout 60
pa --output json task get TASK_ID --profile PROFILE_NAME
```

A successful query exits 0 even for failed/waiting tasks. Inspect `execution.status`, `waitReason`, `pendingInteractions`, and `allowedActions`. `timeout` ends the local wait only; Ctrl-C exits 130 and does not stop the task. API/CLI errors exit 1 with structured error fields in JSON mode. Never keep polling when a user decision is required.

6. On a question/approval/confirmation, inspect `pendingInteractions[].request.input` and `answerSchema`. If the existing user instruction does not authorize the specific decision, ask the user. Save a response JSON containing:

```json
{
  "resolution": {"answer": {"approved": true}, "parameterHash": "COPY_FROM_REQUEST", "decisionScope": "single_request"},
  "basis": "The user explicitly confirmed this specific request."
}
```

`answer` must match the actual answerSchema; the approval object above is only an example. Do not manufacture confirmation or treat this example as approval.

```bash
pa --output json task respond TASK_ID --profile PROFILE_NAME --interaction INTERACTION_ID --request response.json
```

7. Use controls only when authorized and offered by `allowedActions`. Save its `context` to a JSON file before writing; this freezes the target Turn, runtime generation or budget revision. For example:

```bash
pa --output json task stop TASK_ID --profile PROFILE_NAME --command-id decision-42 --request action-context.json
pa --output json task recover TASK_ID --profile PROFILE_NAME --command-id recovery-42 --request action-context.json
pa --output json task resume TASK_ID --profile PROFILE_NAME --command-id resume-42 --request action-context.json
pa --output json task continue-budget TASK_ID --profile PROFILE_NAME --command-id budget-42 --request action-context.json
pa --output json task start TASK_ID --profile PROFILE_NAME --request action-context.json
```

Only use the command matching the saved context. Start uses the fixed startup command ID from the server. Other decisions require an explicit stable command ID. Retry the same command/body after ambiguous responses, not a freshly fetched context. A stale-context error requires re-reading and reassessing; never automatically approve a new question or add another budget round.

`recover` reconciles evidence; `resume` starts a new Turn on the existing unfinished task. Neither grants permission to replay a tool with unknown effects. Completed ordinary tasks are read-only: new requirements need a new task.

8. Retrieve the final result:

```bash
pa --output json task result TASK_ID --profile PROFILE_NAME --download-dir ./results/batch-42
```

Business output is `result.result.data`; inspect summary, verification, assumptions, risks, and validationStatus as well. Exact file references and checksums are verified on download; an existing file is never overwritten. For follow-up work, download the prior result and attach it to a new task with `submit --file`. This does not create a shared cross-task file grant.

## Runtime boundary

The caller does not need to keep a browser or stream open. Execution still depends on the platform's Web-to-Backend internal stream and Web APIs. A submission receipt is not a durable independent queue guarantee. After an interrupted platform execution, inspect the same task and use an offered recovery action; do not silently duplicate the task.
