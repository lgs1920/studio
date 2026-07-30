# Project rules

This is the canonical source for the project's AI-agent and development rules.

## 1. Core Directives

- **Language:** All conversational responses must be in **French**.
- **Documentation and issues:** All JSDoc blocks, inline comments, code documentation, project documentation, and issue content must be strictly in **English**.
- **Autonomy:** If a choice is ambiguous, stop and ask. **Important**: Final decisions are made by the user.
- **Direct logging:** When the user explicitly asks for direct logging, use the appropriate built-in console method in the function body (`console.log`, `console.error`, or `console.table`) and do not route it through helper methods or wrappers.

## 2. Coding Syntax & Style

- **No Semicolons:** Semicolons (`;`) are strictly forbidden.
- **Exports:** No `export default`. Always use named exports (e.g., `export const MyComponent = ...`).
- **Arrow Functions:** Use arrow functions (`const myFunc = () => {}`) exclusively, except for class constructors.
- **Naming Conventions:**
  - **Valtio:** Proxy variables must start with `$` (e.g., `$toto`). Snapshots must be the raw name (e.g., `toto = useSnapshot($toto)`).
  - **React Refs:** Must start with `_` and must NOT use "Ref" as a suffix (e.g., `_myElement`).
  - **DOM/Events:** Use full words `element` and `event` (never `el` or `ev`).
  - **Private Members:** Use `#` prefix for private class fields and methods.
- **Code Structure:** Provide full file content in every response.
- **File size:** If the file exceeds 1500 lines, divide the code into multiple files, each dedicated to a specific set
  of responsibilities.

## 3. Architecture & Tech Stack

- **State Management:** Always use `valtio`. Mapping: `$deepestAttribute` for proxy, `deepestAttribute` for snapshot.
- **UI:** Strictly use WebAwesome 3 components and FontAwesome. No external CSS libraries.
- **CSS:** Use nested syntax with `&` selector. Every CSS custom property must have an English comment explaining its purpose.
- **Backend:** Runtime must be **Bun**. Server framework must be **Elysia**.
- **Vite:** Never run `bun run dev` manually. `vite build` is allowed.

## 4. Documentation & Quality

- **JSDoc:** Every function or method requires a professional English JSDoc block.
- **Comments:** Production-oriented English comments for critical logic.
- **Shortcuts:** Any introduced UI shortcut must be added to the dedicated shortcuts documentation.
- **Testing:** Every feature or fix must be accompanied by relevant tests.

### Technical documentation status

- Keep implementation documentation under `tech-doc/`.
- Put specifications that are proposed, pending validation, explicitly TODO, or describe future implementation work under `tech-doc/todo/`.
- Put specifications and architecture documents that describe the current implementation under `tech-doc/specs/`.
- Name `tech-doc` documentation files with uppercase, flat filenames using descriptive module prefixes when relevant, for example `CORE-...`, `JOURNEY_...`, or `HOW_TO_...`
- Avoid nested document paths inside `tech-doc/specs/` and `tech-doc/todo/` unless a document intentionally remains in a shared reference location.
- Keep general reference documentation in its existing module path unless it is an implementation specification.
- Update links in `README.md`, `tech-doc/README.md`, and nearby technical documents when moving a document.
- Every change to documentation under `tech-doc/` must be delivered through a pull request and merged to `main`.
- Do not use `COMMIT_HISTORY.md` as the source of truth for documentation status; determine status from the document and the implementation.

## 5. Git & Release Workflow

- **Commit Messages:** Must follow the key-based format: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`.
- **Commit Logic:** Never create commits automatically. Only create a commit when the user explicitly requests it. Do not stage or commit proactively on your own initiative.
- **Project rules changes:** Every modification to `PROJECT_RULES.md` must be isolated in a dedicated commit, submitted through a dedicated pull request, and merged into `main`.
- **Dependency inventory:** When a commit changes `package.json` dependencies or dependency-related credits, update `tech-doc/specs/README_DEPENDENCIES.md` in the same change set if the inventory is still meant to mirror the current package list.
- **Commit history:** `COMMIT_HISTORY.md` when preparing a commit.
- **Commit history entry:** Record every commit in `COMMIT_HISTORY.md` with its date, exact commit message, and a GitHub link in the format `https://github.com/lgs1920/studio/commit/<commit-id>`.

## 6. Issue Creation Workflow

- **Clarification and validation:** Before creating an issue, ask the user for any missing explanations or clarifications needed to understand and scope the request. Then present the complete proposed issue content for explicit user validation. Do not create the issue until the user has validated the proposal.
- **Complete fields:** Every created issue must have all available fields filled in, including title, description, assignee, labels, type, milestone, backlog, and any other fields required by the issue tracker.
- **Assignee:** Assign the issue to the user requesting its creation unless the user explicitly specifies another assignee.
- **Milestone and backlog:** When the user does not specify a backlog, use `Backlog`. When the user does not specify a milestone, use the latest available milestone. The user will update these values afterward if needed.
- **Issue body structure:** Write every issue body in the same structure: short context, requested behavior, acceptance criteria, and optional notes or questions. Keep the scope to one request per issue and prefer bullet lists for requirements.
- **Issue templates:** Use `.github/ISSUE_TEMPLATE/bug_report.md` for bugs and `.github/ISSUE_TEMPLATE/feature_request.md` for new features or improvements. Keep the sections consistent with the issue type and use the reproduction section only for bugs.
- **Issue type mapping:** Each issue template must include its hidden `issue-type` marker, and the automation must set the GitHub issue type accordingly (`bug` for `bug_report.md`, `feature` for `feature_request.md`).
- **Cross-repository issue mirroring:** Every open issue in `lgs1920/site` and `lgs1920/backend` must have a corresponding issue in `lgs1920/studio`.
- **Mirror title and label:** Prefix the Studio mirror title with `[Site]` or `[Backend]` and apply the matching lowercase `site` or `backend` label.
- **Mirror type:** The Studio mirror must use the same GitHub issue type as the source issue. If the source issue has no type, determine and set its correct type before creating the mirror.
- **Reciprocal links:** Add a cross-reference in both the source issue and its Studio mirror.
- **Duplicate prevention:** Before creating a mirror, search open and closed Studio issues for an existing reference to the source issue and reuse the existing mirror when one exists.
