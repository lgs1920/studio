# Multilingual Plan With Lingui

## Objective

Add multilingual support to LGS1920 Studio with Lingui, without forcing a big-bang rewrite of every UI string.

The target is:

- UI translated progressively, drawer by drawer.
- Reports HTML/PDF translated through the same translation layer.
- Locale stored in global settings.
- Date, number, distance and duration formatting handled consistently.
- Translation catalogs usable by developers first, and later by translators or a TMS.

## Why Lingui

Lingui is a good fit if we want a structured localization workflow rather than a loose dictionary of manual keys.

Strengths:

- React support through `@lingui/react`.
- Compile-time macros through `@lingui/react/macro` and `@lingui/core/macro`.
- Vite integration through `@lingui/vite-plugin`.
- ICU MessageFormat support for variables, plurals and rich messages.
- Message extraction from source code.
- `.po` catalogs that can be edited by translators or connected to a translation platform.
- Can also be used outside React through `@lingui/core`, which matters for report generation code.

Tradeoffs:

- Setup is heavier than `i18next`.
- We need extraction/compile scripts in the development workflow.
- Developers must avoid raw strings in newly migrated UI.
- Non-React code needs a small wrapper around the Lingui `i18n` instance.

Official references:

- Lingui: https://lingui.dev/
- Installation: https://lingui.dev/installation
- Vite plugin: https://lingui.dev/ref/vite-plugin
- React API: https://lingui.dev/ref/react
- Macros: https://lingui.dev/ref/macro

## Phase 1 - Dependencies

Install Lingui packages:

```bash
bun add @lingui/core @lingui/react
bun add -d @lingui/cli @lingui/conf @lingui/vite-plugin @lingui/babel-plugin-lingui-macro
```

The project already uses Vite with `@vitejs/plugin-react`, so the Babel macro plugin is the natural path.

## Phase 2 - Vite Integration

Update `vite.config.ts`.

Current pattern:

```ts
react()
```

Target pattern:

```ts
import {lingui} from '@lingui/vite-plugin'

react({
    babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
    },
}),
lingui(),
```

Keep the plugin order conservative:

```ts
plugins: [
    cesium(),
    serveCesiumDev(),
    serveProxyPhpDev(),
    react({
        babel: {
            plugins: ['@lingui/babel-plugin-lingui-macro'],
        },
    }),
    lingui(),
    VitePWA(...),
    mdPlugin(...),
    saveBranchInLocal(),
]
```

If the PWA/service worker build has trouble with macro compilation, keep Lingui active only in the main app build first, then handle the service worker separately. Do not translate service worker messages in the first migration.

## Phase 3 - Lingui Config

Create `lingui.config.ts` at the project root:

```ts
import type {LinguiConfig} from '@lingui/conf'

const config: LinguiConfig = {
    sourceLocale: 'en',
    locales: ['en', 'fr'],
    catalogs: [
        {
            path: '<rootDir>/src/locales/{locale}/messages',
            include: ['src'],
            exclude: [
                'src/**/*.test.*',
                'src/**/__tests__/**',
                'src/**/*.spec.*',
            ],
        },
    ],
    format: 'po',
}

export default config
```

Recommended language policy:

- Source locale: `en`
- First supported locales: `en`, `fr`
- UI copy written in English in source code.
- French added in `.po` catalogs.

Reason: source code stays internationally readable and Lingui extraction remains clean.

If the product copy must be authored in French first, invert the source locale to `fr`, but make that decision once and keep it stable.

## Phase 4 - Scripts

Add scripts to `package.json`:

```json
{
  "scripts": {
    "i18n:extract": "lingui extract",
    "i18n:compile": "lingui compile",
    "i18n:compile:watch": "lingui compile --watch",
    "i18n:check": "lingui extract --clean && lingui compile --strict"
  }
}
```

Build integration:

- During development, Vite can compile catalogs through the Lingui plugin.
- Before production build, run `bun run i18n:compile`.
- CI should run `bun run i18n:check` once the first migration is stable.

Do not enable strict CI checks on day one if many strings are intentionally untranslated during migration.

## Phase 5 - Runtime I18n Module

Create a single runtime entry point:

```text
src/i18n/
  index.js
  locales.js
  formats.js
```

`src/i18n/index.js` responsibilities:

- Own the shared `i18n` instance from `@lingui/core`.
- Detect initial locale.
- Load catalogs dynamically.
- Activate a locale.
- Expose helpers for React and non-React code.

Suggested API:

```js
import {i18n} from '@lingui/core'

export const DEFAULT_LOCALE = 'en'
export const SUPPORTED_LOCALES = ['en', 'fr']

export const normalizeLocale = locale => {
    const normalized = String(locale || '').toLowerCase().split('-')[0]
    return SUPPORTED_LOCALES.includes(normalized) ? normalized : DEFAULT_LOCALE
}

export const resolveInitialLocale = () => {
    const configured = globalThis.lgs?.settings?.application?.locale
    if (configured && configured !== 'auto') {
        return normalizeLocale(configured)
    }

    return normalizeLocale(globalThis.navigator?.language)
}

export const loadLocale = async locale => {
    const normalized = normalizeLocale(locale)
    const {messages} = await import(`../locales/${normalized}/messages.js`)
    i18n.load(normalized, messages)
    i18n.activate(normalized)
    document.documentElement.lang = normalized
    return normalized
}

export const t = (...args) => i18n._(...args)

export {i18n}
```

Exact import paths may need adjustment depending on Lingui generated output.

## Phase 6 - React Provider

Wrap the app once with Lingui:

```jsx
import {I18nProvider} from '@lingui/react'
import {i18n, loadLocale, resolveInitialLocale} from './i18n'
```

At app startup:

- Load `resolveInitialLocale()`.
- Render only after the initial catalog is loaded.
- Wrap the app with:

```jsx
<I18nProvider i18n={i18n}>
    <App/>
</I18nProvider>
```

If there is already an app bootstrap/loading layer, plug this into that layer rather than creating a second global loading state.

## Phase 7 - Global Locale Setting

Add a persisted setting:

```js
lgs.settings.application.locale = 'auto'
```

Allowed values:

- `auto`
- `en`
- `fr`

Add a small language selector in application settings, not in the Track Editor.

Behavior:

- `auto`: use browser language.
- `en` / `fr`: force that language.
- On change: call `loadLocale(nextLocale)` and update `document.documentElement.lang`.

The setting must be global, not per journey.

## Phase 8 - Coding Rules

For React text:

```jsx
import {Trans} from '@lingui/react/macro'

<WaButton>
    <Trans>Export a Report</Trans>
</WaButton>
```

For React attributes or string props:

```jsx
import {useLingui} from '@lingui/react/macro'

const {t} = useLingui()

<WaTooltip>
    {t`Export a Report`}
</WaTooltip>
```

For plurals:

```jsx
import {Plural} from '@lingui/react/macro'

<Plural
    value={poiCount}
    one="# POI exported."
    other="# POIs exported."
/>
```

Do not write:

```js
`${poiCount} POI(s) exported.`
```

For non-React code:

```js
import {msg} from '@lingui/core/macro'
import {i18n} from '@/i18n'

i18n._(msg`Export success`)
```

Avoid manual IDs at first. Let Lingui extract messages from source text unless there is a stable product reason to force custom IDs.

## Phase 8b - JSON And YAML Text

Lingui does not extract user-facing strings directly from arbitrary JSON or YAML files.

So there are only three clean options:

1. The JSON/YAML content is not user-facing.
   Keep it as-is.
   Examples:
   - IDs
   - slugs
   - internal config names
   - file names
   - icon names
   - technical provider labels that are not shown directly to users

2. The JSON/YAML content is user-facing but stable and catalog-like.
   Store translation keys in the JSON/YAML, not final text.

   Example:

   ```yaml
   shortcuts:
     hideOtherJourneys:
       label: shortcuts.hideOtherJourneys.label
       description: shortcuts.hideOtherJourneys.description
   ```

   Then resolve at runtime:

   ```js
   import {i18n} from '@/i18n'
   import {msg} from '@lingui/core/macro'

   const label = i18n._({
       id: shortcut.label,
       message: 'Hide other journeys',
   })
   ```

   This is the safest pattern for files such as:
   - `public/shortcuts.yaml`
   - widget catalogs
   - flythrough clip catalogs
   - YAML-driven menus or presets

3. The JSON/YAML content is user-facing and authored as content.
   Split the content by locale.

   Example:

   ```text
   public/i18n/fr/shortcuts.yaml
   public/i18n/en/shortcuts.yaml
   ```

   Then load the locale-specific file:

   ```js
   const file = `/i18n/${locale}/shortcuts.yaml`
   ```

   Use this only when the file is really content, not application UI.
   Good candidates:
   - long help text
   - onboarding copy
   - legal/editorial content
   - big structured content blocks

Recommended rule for this project:

- UI labels in JSON/YAML: replace literal text with translation keys.
- Editorial content in JSON/YAML: use one file per locale.
- Pure config in JSON/YAML: leave untouched.

### For This Codebase

Files like `shortcuts.yaml`, `widgets.yaml`, `flythrough.yaml`, `config.yaml` and similar should be reviewed field by field.

Use this decision rule:

- If the field drives behavior, keep raw config.
- If the field is rendered to the user as a label, title, tooltip or description, convert it to a translation key.
- If the field is a long content block, move it to locale-specific JSON/YAML content.

### Runtime Helper For Key-Based YAML/JSON

Add one small helper for config-driven labels:

```js
import {i18n} from '@/i18n'

export const translateConfigValue = (value, fallback = '') => {
    if (!value) {
        return fallback
    }

    if (typeof value === 'string') {
        return i18n._({id: value, message: fallback || value})
    }

    if (typeof value === 'object' && value.id) {
        return i18n._({
            id: value.id,
            message: value.message || fallback || value.id,
        })
    }

    return fallback
}
```

That allows YAML to evolve from:

```yaml
label: Hide other journeys
```

to:

```yaml
label: shortcuts.hideOtherJourneys.label
```

or:

```yaml
label:
  id: shortcuts.hideOtherJourneys.label
  message: Hide other journeys
```

The object form is better when a fallback source message must stay close to the config.

### What Not To Do

- Do not try to make Lingui extract arbitrary YAML strings automatically as phase 1.
- Do not duplicate full UI text in many YAML files per language unless the file is real content.
- Do not mix raw French text, raw English text and translation keys in the same schema without a rule.

## Phase 9 - Formatting Rules

Translations solve language. Formatting solves locale-specific display.

Create `src/i18n/formats.js`:

```js
import {i18n} from './index'

export const currentLocale = () => i18n.locale || 'en'

export const formatNumber = (value, options = {}) =>
    new Intl.NumberFormat(currentLocale(), options).format(value)

export const formatDate = (value, options = {}) =>
    new Intl.DateTimeFormat(currentLocale(), options).format(value)

export const formatList = (values, options = {}) =>
    new Intl.ListFormat(currentLocale(), options).format(values)
```

Distances, speeds, altitude and coordinates should keep using existing unit conversion utilities, but the final number formatting should pass through locale-aware formatters.

## Phase 10 - Reports HTML/PDF

Reports are critical because they are generated outside normal React rendering.

Rules:

- Reports use the same active Lingui locale as the UI.
- Report export functions receive an optional `locale`.
- If no `locale` is passed, use `i18n.locale`.
- No persistent report-specific language setting in phase 1.

Example:

```js
import {msg} from '@lingui/core/macro'
import {i18n} from '@/i18n'

const reportTitle = i18n._(msg`Journey report`)
```

Areas to migrate early:

- Report section titles.
- POI labels.
- Export success/error toasts.
- Date/distance/elevation labels.
- Map view names.
- Credits/static legal text only if product requires it.

HTML report:

- Use translated strings before building HTML templates.
- Set `<html lang="${locale}">`.

PDF report:

- Translate before drawing text.
- Verify font coverage for French accents.
- Keep layout tests for long translated labels.

## Phase 11 - Migration Order

Do not translate the whole app in one pass.

Recommended order:

1. Infrastructure only
   - dependencies
   - config
   - provider
   - locale setting
   - empty `en`/`fr` catalogs

2. Track Editor
   - journey selector area
   - tabs
   - journey details
   - track style labels
   - export menu and toasts

3. Reports
   - HTML report strings
   - PDF report strings
   - map labels
   - POI table labels

4. Fly Through
   - drawer labels
   - clip settings
   - export/status messages

5. Global Settings
   - application
   - camera
   - style
   - profile/sync

6. Widgets
   - widget editors
   - labels
   - tooltips
   - default text values only if they are UI copy

7. Error messages and diagnostics
   - user-facing errors only
   - keep developer console messages in English unless exposed to users

## Phase 12 - Catalog Workflow

Developer workflow:

```bash
bun run i18n:extract
bun run i18n:compile
bun run dev
```

Before commit:

```bash
bun run i18n:extract
bun run i18n:compile
bunx --bun eslint <changed files>
bunx --bun vitest run <targeted tests>
```

Catalog files:

```text
src/locales/en/messages.po
src/locales/fr/messages.po
```

Generated compiled files should be committed if the app imports them at runtime and the build expects them.

Decision to make during implementation:

- Commit compiled `messages.js`: simpler deploy/build behavior.
- Do not commit compiled `messages.js`: cleaner repo, but CI/build must compile catalogs every time.

Recommendation for this project: commit compiled files at first to reduce deployment risk, then revisit later.

## Phase 13 - Testing

Add focused tests:

- `normalizeLocale()` handles `fr-FR`, `en-US`, unknown values.
- `loadLocale()` activates locale and updates `document.documentElement.lang`.
- report builders receive translated labels.
- plurals render correctly for `0`, `1`, `2`.
- export toasts use translated strings.

Manual QA checklist:

- Switch app language from `auto` to `fr`.
- Switch app language from `fr` to `en`.
- Reload and verify persisted language.
- Export PDF in French.
- Export HTML report in French.
- Check long labels in Track Editor drawer.
- Check tooltips.
- Check mobile drawer width.

## Phase 14 - Developer Guardrails

After the first migration is stable:

- Add a lightweight lint convention: no new user-facing raw strings in migrated directories.
- Document accepted exceptions:
  - icon names
  - CSS class names
  - internal IDs
  - log/debug-only messages
  - third-party technical constants

Possible later automation:

- Use Lingui extract checks in CI.
- Add a custom ESLint rule for raw JSX text in migrated modules.
- Add pseudo-locale testing if layout regressions become common.

## Phase 15 - Risks

Vite/PWA build interaction:

- Lingui Vite plugin and PWA custom build need validation together.
- Keep service worker translation out of scope initially.

Reports:

- PDF text layout may change with French strings.
- Long labels need defensive layout.

Catalog churn:

- If source strings are rewritten often, `.po` files churn.
- For very stable areas, consider explicit message IDs later.

Mixed source language:

- Avoid mixing English and French source strings after migration starts.
- Pick one source locale and enforce it.

## Recommended First PR

Scope:

- Install Lingui dependencies.
- Add `lingui.config.ts`.
- Wire Vite.
- Add `src/i18n`.
- Add locale setting.
- Add provider.
- Translate only 5-10 strings in Track Editor, including `Hide other journeys`.
- Add one report string translated outside React.
- Add tests for locale resolution.

This proves the full path without creating a large risky diff.
