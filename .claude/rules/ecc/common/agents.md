# Agent Orchestration

> Trimmed for this repo on 2026-11-20: every subagent loads all instruction files again from scratch, so each spawn costs tokens before it does any work.

## When to delegate

Do the work inline by default. Delegate to an agent only when:
- the user asks for an agent, a slash command that runs one, or a multi-agent review; or
- the work cannot fit in the current context (a sweep across many files where only the conclusion matters).

Do not spawn agents "proactively", in parallel "because the tasks are independent", or for a review of a small diff: run independent tool calls in parallel inside this context instead.

## Available agents (when delegation is warranted)

| Agent | Purpose |
|-------|---------|
| planner / architect | Large features, architectural decisions |
| code-reviewer / typescript-reviewer | Review of a large change |
| security-reviewer | Auth, payments, tenant isolation before shipping |
| build-error-resolver | A broken build that needs many fixes |
| tdd-guide | Only when the user asks for it |

## Delegation Completion Contract

Applies to every agent at every depth (parent, child, grandchild):

1. **Your final message IS the deliverable.** Never end your turn with "waiting for background agents" — a spawned task is not a completed task.
2. **If you delegate, you own collection.** Wait for results, integrate them, then return. Fire-and-forget delegation is forbidden.
3. **Decompose only when the work cannot fit in one context.** Do not re-delegate a task already sized for a single agent.
