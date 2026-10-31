---
name: finish_feature
description: Check, save and upload the current branch (never merges)
---

1. Run `npm run build`. If it fails, STOP and show me the error.
2. Run `git status` and `git diff --stat`. List every changed file. If any file is outside the approved plan, STOP and ask me.
3. Confirm no .env file, secret, node_modules or dist is staged.
4. Update docs/PROJECT-STATE.md: what changed, decisions made, open issues.
5. Commit with the message format type(scope): summary.
6. Push with `git push -u origin <branch-name>`.
7. Give me the final report from AGENTS.md and tell me to open the pull request.
8. NEVER merge. NEVER push to main. NEVER force push.
