---
apply: always
---

# AI Agent Instruction Profile - Development Standards

This file defines the absolute constraints for all code generation and project interactions.

## 1. Core Directives

- **Language:** All conversational responses must be in **French**.
- **Documentation:** All JSDoc blocks, inline comments, and code documentation must be strictly in **English**.
- **Autonomy:** If a choice is ambiguous, stop and ask. **Important**: Final decisions are made by the user.

## 2. Coding Syntax & Style

- **No Semicolons:** Semicolons (`;`) are strictly forbidden.
- **Exports:** No `export default`. Always use named exports (e.g., `export const MyComponent = ...`).
- **Arrow Functions:** Use arrow functions (`const myFunc = () => {}`) exclusively, except for class constructors.
- **Naming Conventions:**
    - **Valtio:** Proxy variables must start with `$` (e.g., `$toto`). Snapshots must be the raw name (e.g.,
      `toto = useSnapshot($toto)`).
    - **React Refs:** Must start with `_` and must NOT use "Ref" as a suffix (e.g., `_myElement`).
    - **DOM/Events:** Use full words `element` and `event` (never `el` or `ev`).
    - **Private Members:** Use `#` prefix for private class fields and methods.
- **Code Structure:** Provide full file content in every response.

## 3. Architecture & Tech Stack

- **State Management:** Always use `valtio`. Mapping: `$deepestAttribute` for proxy, `deepestAttribute` for snapshot.
- **UI:** Strictly use WebAwesome 3 components and FontAwesome. No external CSS libraries.
- **CSS:** Use nested syntax with `&` selector. Every CSS custom property must have an English comment explaining its
  purpose.
- **Backend:** Runtime must be **Bun**. Server framework must be **Elysia**.
- **Vite:** Never run `bun run dev` manually. `vite build` is allowed.

## 4. Documentation & Quality

- **JSDoc:** Every function or method requires a professional English JSDoc block.
- **Comments:** Production-oriented English comments for critical logic.
- **Shortcuts:** Any introduced UI shortcut must be added to the dedicated shortcuts documentation.
- **Testing:** Every feature or fix must be accompanied by relevant tests.

## 5. Git & Release Workflow

- **Commit Messages:** Must follow the key-based format: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`.
- **Commit Logic:** No confirmation needed. Split separate topics into distinct commits.
- **Changelog:** Update `README.md` and `CHANGELOG.md` (with current date title) on every commit.