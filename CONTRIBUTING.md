# 🌐 ICON ELECTROMATIC — Engineering & Git Collaboration Guide

> **Official Contributor & Workflow Standards**  
> **Repository:** [`chinmayir30/ICONELECTROMATIC`](https://github.com/chinmayir30/ICONELECTROMATIC)  
> **Target Audience:** All engineers, AI collaborators, and contributors.

---

## 1. Core Philosophy & Architecture

This repository adheres to the industry-standard **GitHub Flow** adopted by leading engineering organizations (Google, Microsoft, Meta).

* **The `main` branch is production-ready at all times.** Code in `main` must always build without errors, pass all visual checks in both **Light** and **Dark** themes, and represent deployable code.
* **Direct pushes to `main` are strictly prohibited.** All enhancements, bug fixes, and refactors must originate from an isolated feature branch and be incorporated via a verified Pull Request (PR).
* **Isolation protects teammates.** By isolating work into feature branches, one engineer's work-in-progress code never disrupts other contributors.

```
       ┌────────────────────────────────────────────────────────┐
       │                 main branch (Protected)                │
       └───────┬────────────────────────────────────────▲───────┘
               │                                        │
          Step 1: Branch                           Step 4: Merge
               │                                        │
       ┌───────▼────────────────────────────────────────┴───────┐
       │              feature/<task-name> branch                │
       │     Step 2: Implement & Test (Build verification)      │
       │     Step 3: Commit & Push to Remote                    │
       └────────────────────────────────────────────────────────┘
```

---

## 2. The 5-Step Development Lifecycle

Every contributor—whether using the **Antigravity AI Agent** or standard **Git CLI**—must follow this 5-step loop for every task:

```text
Step 1: START    ──► Sync latest main & create isolated feature branch
Step 2: VERIFY   ──► Implement changes, test UI, and run `npm run build`
Step 3: PUSH     ──► Commit cleanly and push branch to GitHub
Step 4: MERGE    ──► Open PR and merge into main (GitHub or AI)
Step 5: CLEANUP  ──► Delete merged branch and sync local main for next task
```

---

## 3. Workflow for Antigravity AI Agent Users

When working with **Antigravity**, you do not need to execute low-level terminal commands manually. Use the standardized prompt templates below for predictable, high-quality execution:

### 🟢 Step 1: Starting a Task (Branch & Implement)
Copy and paste this prompt to start any new feature:

> **Prompt:**  
> *"First, pull the latest code from `origin main`. Then create and switch to a new branch called `feature/<task-name>`. Once on that branch, please implement the following: <describe your feature, styling adjustment, or bug fix in detail>."*

* **Example:**  
  *"First, pull the latest code from `origin main`. Then create and switch to a new branch called `feature/partner-search-filter`. Once on that branch, add a real-time search filter bar to the top of the Partners page so users can filter OEM cards by name, category, and country."*

---

### 🟡 Step 2: Quality Gate & Verification
Before pushing, command Antigravity to run automated compilation and design validation:

> **Prompt:**  
> *"Run `npm run build` to verify there are zero build or syntax errors. Check that the design is fully responsive and looks identical in visual polish across both Light Mode (`data-theme='light'`) and Dark Mode."*

---

### 🔴 Step 3: Commit & Push to GitHub
Once satisfied with the changes:

> **Prompt:**  
> *"Stage and commit all changes with a clear conventional commit message, and push this branch to `origin` on GitHub. Then provide the Pull Request link."*

---

### 🟣 Step 4: The Merge (Two Options)

#### Option A — On GitHub Web (Recommended for Multi-Person Teams):
1. Click the link provided by Antigravity (or visit [chinmayir30/ICONELECTROMATIC](https://github.com/chinmayir30/ICONELECTROMATIC)).
2. Click **"Compare & pull request"**.
3. Review the green/red diff under the **Files changed** tab.
4. Click **"Merge pull request"** → **"Confirm merge"**.

#### Option B — Direct AI Merge (Fast-Track):
> **Prompt:**  
> *"Switch to `main`, pull the latest remote changes, merge `feature/<task-name>` into `main`, and push the updated `main` to `origin`."*

---

### ⚪ Step 5: Cleanup & Sync (Prepare for the Next Task)
Once merged, close the loop so your local repository remains pristine:

> **Prompt:**  
> *"Switch back to `main`, pull the latest `origin main`, and delete the local feature branch `feature/<task-name>`."*

---

## 4. Workflow for Manual Terminal / CLI Users

For engineers working directly in the shell:

```bash
# -----------------------------------------------------------
# STEP 1: Sync main and branch out
# -----------------------------------------------------------
git checkout main
git pull origin main
git checkout -b feature/<task-name>

# -----------------------------------------------------------
# STEP 2: Implement & Validate
# -----------------------------------------------------------
# (Make your edits in the codebase)
npm run dev      # Test locally in browser
npm run build    # MUST exit with code 0

# -----------------------------------------------------------
# STEP 3: Stage, Commit & Push
# -----------------------------------------------------------
git status
git add .
git commit -m "feat(partners): add real-time search and domain filter pills"
git push -u origin feature/<task-name>

# -----------------------------------------------------------
# STEP 4: Merge via Pull Request on GitHub
# -----------------------------------------------------------
# Open https://github.com/chinmayir30/ICONELECTROMATIC/pulls
# Review diff -> Click "Merge pull request" -> "Confirm merge"

# -----------------------------------------------------------
# STEP 5: Local Cleanup & Sync
# -----------------------------------------------------------
git checkout main
git pull origin main
git branch -d feature/<task-name>
```

---

## 5. Branch Naming Conventions

Use structured, lowercase prefixes followed by a short hyphen-separated descriptor:

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feature/` | New functionality or capabilities | `feature/catalog-oem-table` |
| `fix/` | Bug fixes or alignment corrections | `fix/header-dropdown-zindex` |
| `style/` | CSS, typography, theme adjustments | `style/light-mode-card-contrast` |
| `content/` | Updating catalog data, copy, or blogs | `content/add-qorvo-whitepapers` |
| `perf/` | Performance, asset or bundling optimization | `perf/optimize-hero-video-loading` |
| `refactor/` | Code reorganization without UI changes | `refactor/unify-page-headers` |

---

## 6. Commit Message Standards (Conventional Commits)

Commit messages should be concise, imperative, and descriptive:

```text
<type>(<scope>): <short imperative summary>

[optional body explaining 'why' rather than 'what']
```

### Approved Types:
* `feat`: A new user-facing feature.
* `fix`: A bug fix or layout correction.
* `style`: Styling/CSS adjustments with no business logic impact.
* `refactor`: Code restructuring without bug fixes or new features.
* `docs`: Documentation updates (`README`, `CONTRIBUTING`).
* `perf`: Performance improvements.

### Examples:
* ✅ `feat(products): introduce category-level breadcrumbs navigation`
* ✅ `style(hero): remove background banner in light mode to match services page`
* ✅ `fix(contact): prevent form submission on empty email field`
* ❌ `updated stuff` *(unacceptable)*
* ❌ `fixed bugs` *(unacceptable)*

---

## 7. Handling Merge Conflicts

Merge conflicts occur when two contributors edit the same line of code in the same file. To resolve them safely:

1. Bring the latest `main` changes into your active branch:
   ```bash
   git checkout feature/<your-branch>
   git pull origin main
   ```
2. Git will insert standard conflict markers:
   ```javascript
   <<<<<<< HEAD (Your changes)
   const totalOEMs = 15;
   =======
   const totalOEMs = 16;
   >>>>>>> main (Incoming changes from team)
   ```
3. Open the file, discuss with the teammate if necessary, remove the marker lines (`<<<<<<<`, `=======`, `>>>>>>>`), and retain the correct merged code.
4. Verify by running `npm run build`.
5. Stage, commit, and push:
   ```bash
   git add .
   git commit -m "fix(merge): resolve conflict with main in catalogData.js"
   git push origin feature/<your-branch>
   ```

*(If using Antigravity, simply prompt: "Please resolve the merge conflict in `<file>` by keeping <intended change>, verify with `npm run build`, and push.")*

---

## 8. Rules of Engagement (The 5 Golden Rules)

| # | Rule | Rationale |
| :-: | :--- | :--- |
| **1** | **Never push directly to `main`** | Ensures `main` is always pristine and unbroken for every contributor. |
| **2** | **Never use `git push --force`** | Force-pushing can overwrite, rewrite, or permanently delete a teammate's commits. |
| **3** | **Always pull `main` before branching** | Guarantees your new work starts on top of the newest codebase. |
| **4** | **Never push code that fails `npm run build`** | Broken builds block other developers and halt deployments. |
| **5** | **Test both Light and Dark themes** | ICON ELECTROMATIC supports dual-theme parity; any visual change must look premium in both modes. |

---

*Document Version: 1.0.0 — Maintained for ICON ELECTROMATIC Engineering Team*
