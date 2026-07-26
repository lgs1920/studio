# Project rules

This is the canonical source for the project's AI-agent and development rules.

## 1. Core Directives

- **Language:** All conversational responses must be in **French**.
- **Documentation:** All JSDoc blocks, inline comments, and code documentation must be strictly in **English**. Any project documentation requested by the user must also be written in **English**.
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
- **Commit Logic:** Never create commits automatically. Only create a commit when the user explicitly requests it.
- **Commit history:** `COMMIT_HISTORY.md` when preparing a commit.
- **Commit history entry:** Record every commit in `COMMIT_HISTORY.md` with its date, exact commit message, and a GitHub link in the format `https://github.com/lgs1920/studio/commit/<commit-id>`.

## 6. Issue Creation Workflow

- **Complete fields:** Every created issue must have all available fields filled in, including title, description, assignee, labels, type, milestone, backlog, and any other fields required by the issue tracker.
- **Assignee:** Assign the issue to the user requesting its creation unless the user explicitly specifies another assignee.
- **Milestone and backlog:** Before creating an issue, ask the user which milestone and backlog it belongs to. Do not create the issue until both choices have been confirmed.
- **Issue body structure:** Write every issue body in the same structure: short context, requested behavior, acceptance criteria, and optional notes or questions. Keep the scope to one request per issue and prefer bullet lists for requirements.
- **Issue templates:** Use `.github/ISSUE_TEMPLATE/bug_report.md` for bugs and `.github/ISSUE_TEMPLATE/feature_request.md` for new features or improvements. Keep the sections consistent with the issue type and use the reproduction section only for bugs.
- **Issue type mapping:** Each issue template must include its hidden `issue-type` marker, and the automation must set the GitHub issue type accordingly (`bug` for `bug_report.md`, `feature` for `feature_request.md`).
