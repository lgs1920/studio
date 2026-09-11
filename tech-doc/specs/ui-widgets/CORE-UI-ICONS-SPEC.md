# Web Awesome Icon System

## Status

This document describes the implemented icon integration used by the application. It is the
reference for selecting, registering, extending, and testing Web Awesome and Font Awesome
icons.

## Purpose

The application uses Web Awesome's `wa-icon` component as the UI icon surface and Font Awesome
as the icon definition and SVG rendering source. The integration supports custom Font Awesome
kits while preserving Web Awesome's normal icon library behavior.

The integration provides these properties:

- Components use the native `WaIcon` React wrapper without a project-specific icon wrapper.
- Public names use Font Awesome icon names in kebab case.
- `family` and `variant` select the relevant custom kit definition.
- The `classic` family remains the default and does not need to be specified.
- Custom kit imports are centralized and are not repeated in UI components.
- Icons absent from the custom kits continue through Web Awesome's default resolver.

## Public component contract

Use the Web Awesome React wrapper in React components:

```jsx
<WaIcon name="camera-sliders" />
```

The equivalent custom element syntax is:

```html
<wa-icon name="camera-sliders"></wa-icon>
```

The public `name` is the Font Awesome definition's `iconName`, normalized to the name used by
the component. JavaScript export names are implementation details and are not public names.
For example, the kit export `faCameraSliders` is used with `name="camera-sliders"`.

The default `classic` family is implicit:

```jsx
<WaIcon name="camera-sliders" variant="solid" />
```

Specify `family` when selecting another family:

```jsx
<WaIcon name="cave-in-mountains" family="duotone" variant="regular" />
<WaIcon name="github" family="brands" />
<WaIcon name="video" family="sharp" variant="solid" />
```

`family` and `variant` are icon properties. They are independent from a button's appearance or
variant.

The `library` property is optional for custom kit icons because the integration extends the Web
Awesome `default` library. It can be provided when the custom library must be selected explicitly,
including icons rendered in a separate browser document such as a Picture-in-Picture window:

```jsx
<WaIcon
    library="my-library"
    name="camera-sliders"
    variant="solid"
/>
```

## Font Awesome definitions and prefixes

Font Awesome definitions contain a prefix that identifies their internal icon namespace. The
prefix is required by Font Awesome's renderer and remains in the definition:

| Definition prefix | Web Awesome family | Meaning |
| --- | --- | --- |
| `fak` | `classic` | Custom icon from a classic kit |
| `fakd` | `duotone` | Custom icon from a duotone kit |
| `fab` | `brands` | Font Awesome brand definition |
| `fas`, `far`, and related prefixes | `classic` or another Font Awesome family | Font Awesome style definition |

The prefix is not included in the `name` prop. Web Awesome `family` and `variant` values are
the component-level selection API. The resolver maps those values to the appropriate definition
and Font Awesome then uses the definition prefix while generating the SVG.

## Registration architecture

The generic resolver is implemented in [`src/Utils/useWebAWesomeKits.js`](../../../src/Utils/useWebAWesomeKits.js). The
application bootstrap imports the concrete kit modules and passes them to the resolver.

The application imports the custom kit modules once, at the application bootstrap boundary:

```js
import * as kitIcons from '@awesome.me/kit-########/icons/kit/custom'
import * as kitDuotoneIcons from '@awesome.me/kit-########/icons/kit-duotone/custom'
```

The default ordered registrations associate each module with a Web Awesome family:

```js
const MY_LIBRARY_KITS = [
    {family: 'classic', icons: kitIcons},
    {family: 'duotone', icons: kitDuotoneIcons},
]

registerIconLibraryFromKits('my-library', MY_LIBRARY_KITS)
```

`registerIconLibraryFromKits(libraryName, kits)` performs two registrations during application
initialization:

1. It registers the supplied `libraryName` for explicit selection.
2. It replaces the Web Awesome `default` resolver with a resolver that checks the custom kit
   definitions first and delegates missing icons to the original resolver.

The existing default library mutator and sprite sheet are preserved when the default resolver
is replaced. This keeps Web Awesome's existing behavior available for icons outside the custom
kits.

## Definition indexing

The ordered kit list is converted into a map keyed by family, variant, and public name:

```text
family:variant:name
```

The resolver applies this sequence:

1. Read the `name`, `family`, and `variant` values received from Web Awesome.
2. Use `classic` and `solid` as internal defaults when Web Awesome does not provide a value.
3. Search for an exact family, variant, and name match.
4. Search for a family and name match with a wildcard variant for definitions without a specific
   variant.
5. Render the matching Font Awesome definition through `@fortawesome/fontawesome-svg-core`.
6. Delegate to Web Awesome's original default resolver when no custom definition matches.

Some generated custom kit exports encode a style in the internal icon name, for example
`regular-cave-in-mountains` or `solid-circle-slash`. The registry removes that style prefix
from the public lookup name and stores it as the variant. This allows the component contract to
remain `name="cave-in-mountains"` with `variant="regular"`.

Definitions without an encoded style, such as `camera-sliders` and the custom duotone exports,
use a wildcard variant. They can be selected with the requested variant while their family still
controls which kit is searched.

## Kit ordering and extension

`registerIconLibraryFromKits(libraryName, kits)` accepts a library name and an ordered array of
kit registrations. The first matching definition for an identical family, variant, and public
name is retained.

```js
registerIconLibraryFromKits('my-library', [
    {family: 'classic', variant: 'regular', icons: classicRegularIcons},
    {family: 'classic', variant: 'solid', icons: classicSolidIcons},
    {family: 'duotone', icons: duotoneIcons},
])
```

Each registration should identify the Web Awesome `family` and may provide a `variant` when all
definitions in that module share one style. When the registration does not provide a variant,
the resolver derives `thin`, `light`, `regular`, or `solid` from the generated icon name when
present. The definition prefix provides the family fallback for supported Font Awesome prefixes.

New kit modules must be imported by the application bootstrap and passed to
`registerIconLibraryFromKits()`. A UI component should only consume the Web Awesome icon
component and its public name, family, and variant properties.

## Accessibility

An icon that conveys meaning by itself must provide an accessible label through Web Awesome's
`label` property or an equivalent surrounding accessible name. Decorative icons inside a labelled
control should use the existing control label and remain hidden from redundant assistive output
according to the Web Awesome component behavior.

Icon-only controls must retain a visible or programmatic accessible name and a tooltip when the
surrounding UI pattern requires one. The icon registry does not provide accessible text and must
not be used as a replacement for control semantics.

## Failure behavior

The named custom resolver throws an error when an explicitly requested custom icon is not
available in the registered kits or cannot be rendered. The extended `default` resolver uses
Web Awesome's original behavior for missing custom names, which allows standard Web Awesome and
Font Awesome icons to continue working.

The following names are invalid for the public component contract:

```jsx
<WaIcon name="faCameraSliders" />
<WaIcon name="fak-camera-sliders" />
```

Use `name="camera-sliders"` instead.

## Validation

The integration is covered by:

- [`src/__tests__/unit/utils/use-web-awesome-kits.test.js`](../../../src/__tests__/unit/utils/use-web-awesome-kits.test.js),
  which tests classic, duotone, family and variant selection, kit ordering, default fallback,
  and rejection of JavaScript export names.
- [`src/__tests__/ui/replay/replay-drawer.test.jsx`](../../../src/__tests__/ui/replay/replay-drawer.test.jsx),
  which verifies the application uses the public `camera-sliders` name through `WaIcon`.
- [`src/__tests__/unit/data/app-utils-count.test.js`](../../../src/__tests__/unit/data/app-utils-count.test.js),
  which verifies centralized registration during application initialization.

Run the focused tests with:

```bash
bunx --bun vitest run \
    src/__tests__/unit/utils/use-web-awesome-kits.test.js \
    src/__tests__/ui/replay/replay-drawer.test.jsx \
    src/__tests__/unit/data/app-utils-count.test.js
```

The implementation uses Web Awesome Pro `3.12.0`. Consult the [Web Awesome icon
documentation](https://webawesome.com/docs/components/icon) when the library or wrapper API
changes.
