# LGS1920 Studio Dependency Inventory

This file mirrors the current root `package.json`. The authoritative source remains `package.json`; this document exists
to provide a readable dependency snapshot for contributors and maintainers.

## Dependency Highlights

### Product Runtime

- React
- React DOM
- Valtio
- Cesium
- Web Awesome
- Shoelace
- ECharts
- Mediabunny

### Build and Quality Tooling

- Vite
- `@vitejs/plugin-react`
- `vite-plugin-cesium`
- `vite-plugin-pwa`
- Vitest
- Oxlint
- `oxlint-tsgolint`
- TypeScript

## Runtime Dependencies

These are the current package names declared in the `dependencies` section of `package.json`.

```text
@awesome.me/kit-eb5c406148
@fortawesome/duotone-light-svg-icons
@fortawesome/duotone-regular-svg-icons
@fortawesome/duotone-thin-svg-icons
@fortawesome/fontawesome-svg-core
@fortawesome/free-brands-svg-icons
@fortawesome/free-regular-svg-icons
@fortawesome/pro-duotone-svg-icons
@fortawesome/pro-regular-svg-icons
@fortawesome/pro-solid-svg-icons
@fortawesome/react-fontawesome
@mapbox/extent
@mapbox/geojson-extent
@mapbox/togeojson
@renoun/screenshot
@shoelace-style/shoelace
@tmcw/togeojson
@turf/bbox
@turf/bbox-polygon
@turf/bearing
@turf/boolean-clockwise
@turf/centroid
@turf/convex
@turf/distance
@turf/flatten
@turf/helpers
@turf/invariant
@turf/meta
@turf/nearest-point
@turf/nearest-point-on-line
@turf/point-to-line-distance
@turf/transform-rotate
@web.awesome.me/webawesome-pro
@zumer/snapdom
argparse
axios
babel-plugin-module-resolver
canvg
cesium
classnames
color
colord
convert
deep-object-diff
dotenv
easy-file-picker
echarts
echarts-for-react
elysia
fflate
fs
fs.promises
geo-coordinates-parser
geojson-extent
geojson-minimum-bounding-rectangle
html-react-parser
html2canvas
idb
import
jspdf
luxon
mediabunny
path
pm2
png-chunk-itxt
png-chunks
png-chunks-encode
png-chunks-extract
react
react-custom-scrollbars
react-custom-scrollbars-2
react-dom
react-drag-drop-files
react-error-boundary
react-is
react-markdown
react-moveable
react-responsive
react-svg
react-toastify
simple-git
smart-timeout
sortablejs
sprintf-js
ssh2
ssh2-sftp-client
turf-linestring
turf-point
uuid
valtio
vite-plugin-cesium
vite-plugin-pwa
yaml
zip-a-folder
```

## Development Dependencies

These are the current package names declared in the `devDependencies` section of `package.json`.

```text
@testing-library/react
@types/bun
@types/react
@types/react-dom
@types/serve-static
@vitejs/plugin-react
baseline-browser-mapping
jsdom
typescript
vite
vite-plugin-markdown
vitest
```

## Trusted Dependencies

These packages are currently declared in the `trustedDependencies` section of `package.json`.

```text
core-js
protobufjs
```

## Notes

- A few tooling packages are currently declared in `dependencies` rather than `devDependencies`; this document reflects
  the repository as it exists today rather than an idealized split.
- When `package.json` changes, this file should be updated in the same change set.
