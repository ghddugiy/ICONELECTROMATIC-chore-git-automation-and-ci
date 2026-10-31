---
name: new_feature
description: Start a new task on a safe branch
---

1. Read AGENTS.md and docs/PROJECT-STATE.md.
2. Ask me for the task name and a one-line goal if I have not given them.
3. Run `git status`. If there are unsaved changes, STOP and tell me.
4. Run `git switch main`, then `git pull`.
5. Create a branch named type/short-description (feat/, fix/, chore/ or docs/) with `git switch -c`.
6. Write a plan: the files you expect to change, the risks, and how you will test. STOP and wait for my approval.
