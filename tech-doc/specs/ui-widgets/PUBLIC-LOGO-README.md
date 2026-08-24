# LGS1920 Logo Integration Guide

This folder contains the canonical logo assets used by both `studio` and the public `site`.

Files:

- `logo.svg`: standalone mark, used as the source of truth for the logo shape
- `logo-horizontal.svg`: horizontal lockup, mark on the left and wordmark on the right
- `logo-vertical.svg`: vertical lockup, mark on top and wordmark below
- `style.css`: shared SVG styling and token definitions

## Rendering Model

The logo is not a single flat image. It is built from layered SVG pieces:

- the main body shape
- the secondary cutout shapes
- the play-arrow shape, split into:
  - a visible fill layer
  - a visible border layer
  - a technical mask layer used to carve the shape out of the body

This matters because the logo has two separate concerns:

1. Visual rendering: what the user sees
2. Masking geometry: what gets cut out of the body

The visible colors come from CSS variables.
The cutout behavior comes from the SVG mask itself.

## CSS Variables

`style.css` defines the public tokens used by the SVG files:

- `--lgs--logo-primary`
- `--lgs--logo-secondary`
- `--lgs--logo-text-primary`
- `--lgs--logo-text-secondary`
- `--lgs--logo-wordmark-gap`
- `--lgs--logo-secondary-opacity`

Additional layout and geometry helpers are also defined there:

- `--lgs--logo-gap-horizontal`
- `--lgs--logo-horizontal-wordmark-offset-y`
- `--lgs--logo-gap-vertical`
- `--lgs--logo-play-arrow-border-width`
- `--lgs--logo-wordmark-font-family`
- `--lgs--logo-wordmark-font-size`

## How the Mask Works

Inside `logo.svg`, the arrow appears in the mask section as black shapes.
That black is technical, not visual.

In an SVG mask:

- white means visible
- black means cut out
- transparent does not behave like a reliable cutout for this use case

So the arrow must stay black inside the mask if you want the logo body to be hollowed out correctly.

Example from `logo.svg`:

```svg
<mask id="logo-cutout-mask">
  <use href="#logo-body-shape" class="lgs--logo-mask-base" fill="#ffffff"/>
  <use href="#logo-secondary-shapes" class="lgs--logo-mask-cutout" fill="#000000"/>
  <use href="#logo-play-arrow-outline"
       class="lgs--logo-mask-cutout lgs--logo-play-arrow-border"
       fill="none"
       stroke="#000000"/>
</mask>
```

## How the Visible Arrow Is Drawn

The visible arrow is rendered again in the symbol layer:

- `logo-play-arrow-fill` is the inner fill
- `logo-play-arrow-border` is the outline

Example from `logo.svg`:

```svg
<use id="logo-play-arrow-fill"
     href="#logo-play-arrow-outline"
     class="lgs--logo-primary-layer"
     transform="translate(528 651) scale(0.75) translate(-528 -651)"/>

<use id="logo-play-arrow-border"
     href="#logo-play-arrow-outline"
     class="lgs--logo-secondary-layer lgs--logo-play-arrow-border"
     fill="none"
     stroke="#bfa062"/>
```

The outline thickness is controlled in `style.css`:

```css
.lgs--logo-play-arrow-border {
  fill: none;
  stroke-width: var(--lgs--logo-play-arrow-border-width);
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

## Rendering the Standalone Logo in `studio`

`studio` renders the logo through the `LogoSvg` React component.

Typical usage:

```jsx
import { LogoSvg } from './LogoSvg'

export const HeaderLogo = () => (
  <LogoSvg
    src="/assets/logo/logo.svg"
    primaryColor="#ffffff"
    secondaryColor="#ffffff"
    secondaryOpacity={0}
    textPrimaryColor="#ffffff"
    textSecondaryColor="#ffffff"
    width="100%"
    title="LGS1920 logo"
  />
)
```

What the component does:

1. Fetches the requested SVG
2. Fetches `style.css`
3. Inlines the CSS into the SVG
4. Injects CSS variables through the root `<svg style="...">`
5. Optionally replaces the imported standalone logo inside the horizontal/vertical lockups
6. Prefixes IDs to avoid collisions when multiple logos are rendered on the same page

Important detail:

- `primaryColor` affects the visible primary fill
- `secondaryColor` affects the visible secondary shapes and the arrow outline
- `secondaryOpacity={0}` hides the visible secondary layer while keeping the mask intact

## Rendering the Horizontal and Vertical Lockups in `studio`

The horizontal and vertical variants are separate SVG files:

- `logo-horizontal.svg`
- `logo-vertical.svg`

They both import `logo.svg` as a nested image/reference and use the shared CSS.

Example:

```jsx
<LogoSvg
  src="/assets/logo/logo-horizontal.svg"
  primaryColor="var(--wa-color-brand)"
  secondaryColor="var(--wa-color-brand)"
  textPrimaryColor="var(--wa-color-brand)"
  textSecondaryColor="var(--wa-color-brand)"
  secondaryOpacity={0}
  width="clamp(6.6rem, 15vw, 10rem)"
/>
```

The same component can render the vertical variant by changing `src`:

```jsx
<LogoSvg
  src="/assets/logo/logo-vertical.svg"
  primaryColor="#ffffff"
  secondaryColor="#ffffff"
  textPrimaryColor="#ffffff"
  textSecondaryColor="#ffffff"
  secondaryOpacity={0}
  width="100%"
/>
```

## Rendering the Logo in the Public `site`

The site does not use the React component directly.
Instead, Eleventy precomputes and injects the logo markup.

The pipeline is:

1. `eleventy.config.js` reads the source files from `studio/public/assets/logo/`
2. It copies the logo assets into `site/public/assets/logo/`
3. It builds `studioLogoHorizontalMarkup`
4. The layout injects that markup into the header

Relevant template usage:

```liquid
<a id="site-home-link" class="brand-name" href="{{ localizedHomeUrl | default: '/' }}" aria-label="{{ site.name }}">
  {{ studioLogoHorizontalMarkup }}
  <span class="brand-name-text">
    <span class="brand-title">LGS1920</span>
  </span>
</a>
```

Relevant Eleventy setup:

```js
eleventyConfig.addGlobalData('studioLogoHorizontalMarkup', studioLogoHorizontalMarkup)
```

The site markup is generated with the same source SVG and the same CSS tokens, so the result stays visually aligned with `studio`.

## Practical Rules

- Do not remove the black fill from the mask section if you want the hollow cutout to remain correct.
- Do not rely on the mask to provide visible color.
- Use CSS variables for visible colors.
- Use the mask for geometry only.
- Keep the standalone logo, horizontal lockup, and vertical lockup in sync by editing the source files in this folder, not by hand-editing generated markup elsewhere.

## Suggested Places to Edit

If you need to change:

- arrow border thickness: edit `style.css`
- visible primary/secondary colors: set CSS variables or component props
- the actual arrow shape: edit `logo.svg`
- the horizontal layout spacing: edit `logo-horizontal.svg` or the consuming layout/component
- the vertical layout spacing: edit `logo-vertical.svg` or the consuming layout/component

## Quick Verification

After changing the logo assets:

1. Build `studio` and confirm the SVG still renders correctly.
2. Build the `site` and confirm the generated header logo matches the `studio` treatment.
3. Inspect one page in each app to verify the mask still cuts out the arrow and the visible border uses the secondary color.

## Edit Workflow Tool

There is a small reversible CLI in `scripts/logo-tool.mjs`.

Export a more editor-friendly copy:

```bash
bun run logo:export
```

That command reads `public/assets/logo/logo.svg` and writes a flat authoring file:

```text
public/assets/logo/logo-editable.svg
```

The editable copy contains direct `<path>` elements for the visible shapes, with no `<use>` references and no embedded stylesheet. One technical outline path is kept hidden so the importer can rebuild the production arrow geometry.

Import the edited file back into the production format:

```bash
bun run logo:import
```

That command reads `public/assets/logo/logo-editable.svg`, takes the edited path geometry, restores `public/assets/logo/logo.svg`, and copies the canonical stylesheet back to:

```text
public/assets/logo/style.css
```

You can also pass explicit paths:

```bash
bun scripts/logo-tool.mjs export path/to/logo.svg path/to/logo-editable.svg
bun scripts/logo-tool.mjs import path/to/logo-editable.svg path/to/logo.svg
```

This is intentionally narrow. It is meant for the logo assets in this folder, not for arbitrary SVG files.

Important limitation:

- the script does not redraw geometry for you
- if a section of the logo is a single Bézier `path`, it will remain one path in the editable export
- the main body shape of this logo is one path by design
