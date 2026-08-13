## Media and assets

### Welcome background media catalog

Welcome backgrounds are declared in `src/assets/media/welcome-background-media.js`
using the same `outdoor` catalog shape as the public site
(`site/src/assets/banner-media-catalog.js`). The catalog currently contains
these ten Pexels videos, each paired with its WebP fallback:

* `20260812-10548975`
* `20260812-15404528`
* `10713475-hd-1920-1080-24fps`
* `9733919-uhd-4096-2160-30fps`
* `11212807-hd-1920-1080-24fps`
* `12241795-3840-2160-25fps`
* `13574273-3840-2160-30fps`
* `13633344-3840-2160-60fps`
* `5837793-uhd-3840-2160-24fps`
* `8557574-uhd-2560-1440-30fps`

Add future files to `public/assets/media/` and register the video, fallback,
identifier, and credit in the shared catalog shape. Studio resolves one choice
per session and preloads both its video and WebP fallback.

### Video credits

* [Pexels](https://www.pexels.com/)

### Sample journeys credits

* Mont Blanc: placeoweb.com/
* LGS1920: christian.denat@orange.fr
