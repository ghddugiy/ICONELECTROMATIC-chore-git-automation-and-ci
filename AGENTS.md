# AGENTS.md - Icon Electromatic website

## 1. What this project is
B2B catalog website for Icon Electromatic, a distributor of RF, microwave and
electronic components from OEM partners (Rogers, Mini-Circuits, Qorvo and others).
Goal: production-ready, secure, SEO-ready, handed over to the client with documentation.
Read docs/PROJECT-STATE.md at the start of every session for current status and decisions.

## 2. Tech stack
Current: vanilla JavaScript + Vite (hash routing, demo CMS stored in the browser).
Target (confirm in docs/PROJECT-STATE.md before assuming): static site generation,
a managed headless CMS, and a serverless function for enquiries.
Do not introduce a new framework, database or service unless the plan says so.

## 3. Non-negotiables
1. Never invent data (products, specs, prices, numbers, URLs, email addresses).
   If it is missing, stop and ask.
2. Never put passwords, API keys or tokens in code, comments or docs.
   Use environment variables and list their names in .env.example.
3. Validate all user input (forms, CMS content) on the server, not only in the browser.
4. Every public page has a unique <title>, meta description, canonical URL
   and exactly one <h1>.
5. Public pages use real URLs (no #hash routes) and are readable without JavaScript.
6. Public numbers and claims come from data, never hard-coded.
7. Demo or unfinished features are off by default in production.
8. No new dependency without telling me why, what it costs, and the simpler alternative.
9. Do not change files outside the task scope. If another file needs changing, ask.

## 4. Working method
- Plan first. Show the plan and wait for my approval before editing any file.
- One task per session, on its own branch (feature/..., fix/..., chore/...).
- Work in small steps. After each step, make sure the project still builds.
- If a requirement is unclear or two files disagree, stop and ask. Do not guess.
- Explain every change in plain language, as if to a beginner.

## 5. Code standards
- Clear names. Small functions that do one thing.
- Comments explain why, not what.
- New styling goes in CSS classes, not inline style attributes.
- Remove dead code instead of commenting it out.
- Images are compressed and have alt text. Large files never go into git without asking.

## 6. Git
- Never commit directly to main. Open a pull request.
- Commit messages use: type(scope): summary (types: feat, fix, docs, chore, refactor, test).
- Never commit .env files, node_modules or dist.

## 7. Definition of done
Build passes, tests pass, no console errors, checked at mobile width, no secrets,
no hard-coded claims, docs/PROJECT-STATE.md updated.

## 8. Final report (end of every task)
1. Files changed
2. What I did and why
3. How I tested it
4. What I am unsure about
5. Suggested next step

## 9. Git automation
- Start every task with /new_feature and finish with /finish_feature.
- Never merge, never push to main, never force push, never delete branches.
- Ask before any command that deletes files outside the approved plan.