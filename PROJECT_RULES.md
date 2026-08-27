# Project rules

This is the canonical source for the project's AI-agent and development rules.

## 1. Core Directives

- **Language:** All conversational responses must be in **French**.
- **Documentation and issues:** All JSDoc blocks, inline comments, code documentation, project documentation, and issue content must be strictly in **English**.
- **Autonomy:** If a choice is ambiguous, stop and ask. **Important**: Final decisions are made by the user.
- **No extrapolation:** Never extrapolate beyond the user's request. If a decision is not explicit, ask the user before acting. User directive: “JE N'EXTRAPOLE JAMAIS LA DEMANDE, JE DEMANDE AU MONSIEUR.”
- **Nuance and analytical rigor:** Avoid unwarranted certainty. Simplistic or overly categorical analyses can omit relevant context and lead to incorrect conclusions.
- **Depth of analysis:** Explore relevant subtleties, cross-check perspectives, and identify potential blind spots and biases before reaching a conclusion.
- **Technical verification:** Be especially vigilant with calculations, logic, and overall consistency. If data or reasoning appears anomalous or uncertain, explicitly identify the issue and re-check it step by step.
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
- **Dependency inventory:** When a commit changes `package.json` dependencies or dependency-related credits, update `tech-doc/specs/delivery/README_DEPENDENCIES.md` in the same change set if the inventory is still meant to mirror the current package list.
- **Commit history:** `COMMIT_HISTORY.md` is updated automatically by the `Update commit history` GitHub workflow after pushes to branches.
- **Commit history entry:** The workflow records every previously undocumented commit with its date, exact commit message, and a GitHub link in the format `https://github.com/lgs1920/studio/commit/<commit-id>`. The generated `docs: update commit history` commit is excluded from its own history update.

## 6. Issue Management Workflow

- **Clarification and validation:** Before creating an issue, ask the user for any missing explanations or clarifications needed to understand and scope the request. Then present the complete proposed issue content for explicit user validation. Do not create the issue until the user has validated the proposal.
- **Solution and implementation plan:** For every issue, propose a solution and an implementation plan for explicit user validation. Do not create or implement the issue until the proposed solution and plan have been validated.
- **Complete fields:** Every created issue must have all known and applicable fields filled in, including title, description, assignee, labels, type, priority, repository, Project status, and `Target release`. Do not invent a release, label, priority, or other value when the information is not known.
- **Assignee:** Assign the issue to the user requesting its creation unless the user explicitly specifies another assignee.
- **Release planning:** Use the Project-level `Target release` field as the source of truth for release planning across repositories. Use `Unplanned` when no approved release has been selected. Add a new target-release option only after the release has been approved.
- **Milestone migration:** A milestone is not required for a new issue when `Target release` is known. For an existing issue with a milestone, copy the exact milestone title to the matching `Target release` option when one exists. Keep the milestone during the migration until the result and dependent reporting have been reviewed. Do not clear or delete milestones automatically, and report any mismatch or conflict.
- **Backlog status:** Use the Project `Status` value `Backlog` for accepted work that is not ready to start. Do not treat backlog as a release field or encode versions in labels or statuses when `Target release` already provides that information.
- **Issue body structure:** Write every issue body in the same structure: short context, requested behavior, acceptance criteria, and optional notes or questions. Keep the scope to one request per issue and prefer bullet lists for requirements.
- **Issue templates:** Use `.github/ISSUE_TEMPLATE/bug_report.md` for bugs and `.github/ISSUE_TEMPLATE/feature_request.md` for new features or improvements. Keep the sections consistent with the issue type and use the reproduction section only for bugs.
- **Issue type mapping:** Each issue template must include its hidden `issue-type` marker, and the automation must set the GitHub issue type accordingly (`bug` for `bug_report.md`, `feature` for `feature_request.md`).

### Cross-repository issue ownership

- The managed repositories are `studio`, `site`, and `backend`. Create an issue in the repository that owns the code, documentation, or operational change.
- Never mirror a `site` or `backend` issue into `studio`. Cross-repository dependencies must be recorded with direct links in the original issue bodies, pull requests, or project fields; they must not be represented by duplicate issues.
- During the mirror-removal migration, inventory every `studio` issue that exists only as a mirror of a `site` or `backend` issue. Before deleting a mirror, transfer any information that is not already present to the owning issue, remove every link to the mirror from the original issue and related project documentation, and verify that the owning issue remains linked to the correct pull request and Project item.
- Delete only confirmed mirror issues. Do not delete an issue that owns work, has independent acceptance criteria, or cannot be mapped unambiguously to an owning `site` or `backend` issue. Report ambiguous cases for explicit user decision.
- After the migration, verify that creating a `site` or `backend` issue produces no `studio` issue and that no active issue body links to a deleted mirror.

### Project workflow statuses

Use the shared organization Project and keep its `Status` field limited to the delivery workflow:

New issues start in `Triage` unless their validated scope already justifies a different workflow state.

- `Triage`: new work that needs clarification, ownership, or prioritization.
- `Backlog`: accepted work that is not ready to start.
- `Ready`: scoped work with acceptance criteria and a target release.
- `In Progress`: active implementation.
- `Review`: a linked pull request is open.
- `QA`: review is approved and validation is in progress.
- `Blocked`: an explicit dependency or decision prevents progress.
- `Done`: the linked pull request is merged and the work is complete.

Move an issue to `Review` when its pull request opens, to `QA` after review approval, and to `Done` only after merge. Add every implementation issue to the Project and link it to its pull request.

Keep one shared Project across releases. Do not create a Project or a workflow status for each version. Preserve historical views, milestones, tags, and branches unless the user explicitly approves their removal.

## 7. Release Changelog Workflow

- Changelogs are stored in `public/assets/changelog/` and use the filename `YYYYMMDD-<version>.md`, where `YYYYMMDD` is the release date and `<version>` is the exact package/release version, including prerelease suffixes such as `1.0.0-beta.3`.
- When the target changelog does not exist, create it automatically using today's date and the naming/header convention of the closest existing changelog for the same release line. Never overwrite an existing changelog merely to normalize its historical formatting.
- Keep only the current draft for each release line. Once a newer draft is created, delete the previous draft changelog; do not retain multiple draft files. Published release changelogs must not be deleted.
- Each changelog must identify the application releases covered by the document: `Studio <version>`, `Backend <version>`, and `Site <date>`, because Site does not use a version number. The `Site` date is the date of the latest commit included for the site's evolutions. Include only applications with at least one evolution in the release, and omit an application entirely when it has no evolution to report.
- Every release changelog must contain these four sections, in this order: `New Features and Improvements`, `Closed Issues`, `Remaining Bugs`, and `Remaining Features`.
- Within each section, group entries under the owning application/repository headings `studio`, `backend`, and `site`, in that order. Omit an application heading only when it has no entry in that section.
- The `New Features and Improvements` section describes the user-visible novelties and improvements delivered by each application. It must not replace the detailed list of closed issues.
- The `Closed Issues` section lists every issue closed for the release and keeps each issue under its owning application/repository.
- For `site` and `backend`, include every issue closed on or after the date of the latest previous Studio release, even when the issue has no matching Project `Target release` or milestone. Use the date in the latest previous Studio changelog filename as the boundary, and keep each issue under its owning repository.
- The `Remaining Bugs` and `Remaining Features` sections must not list individual open issues. Instead, provide an external GitHub search link that displays the current open issues of the relevant type, grouped under the owning application/repository. Omit an application heading when its filtered GitHub search has no matching issue. These sections replace the previous global `Known Issues` and `Feature Backlog` entries in the main changelog content.
- Keep issue links pointing to the owning repository. Do not add links to mirror issues.
- Do not invent issue numbers, release versions, dates, fixes, features, or known issues. The application-specific GitHub links in `Remaining Bugs` and `Remaining Features` are the source of truth for current open items. Do not duplicate these links in a separate global `Resources` section.
