# LGS1920Context

## Goal of the project

This project aims to be a free 3D visualization application for KML, KMZ, GPX, GeoJSON files with a video creation tool
for social networks.
The application could be used to theJourney cycling, biking, hiking or running routes.

Maybe , later I will add subscription to have a personal account to save tracks and videos andto access them with a
unique url.

## Roadmap

As off today there's no official roadmap;
but I think of something like that:

### MVP : first

* ~~A mockup that will be able to load theJourney file and display it~~
* A dedicated site (ie public build)

### Beta : adding some animation on tracks

* follow à theJourney with a camera targeted to window center.
* bird view ie following the route from a few metres above, from the rear, looking ahead.

### Beta : Add theJourney data and profile

* ~~compute elevation +,-, speed,
  hourly (km/h) and kilometer (time/km) averages and all similar and useful data.~~
* ~~Add a profile synchronised with theJourney animation~~

### 1.0 : Video export

* Add an image/video tool able to make simple screenshots for social network dedicated videos (9x16, 16x9, 4x3, 1x1)
* A local database for storing personal projects
* UI to add/edit/manage tracks

### Later (to be scheduled and ordered)

* Subscriptions
    * an external database
    * direct link to video
    * share videos to Facebook, Instagram, TikTok, Youtube ...
* Other
    * tools used to import files from tracker apps (direct access to theJourney file)
    * manage projects (ie group of tracks)
    * ...

## Libraries

The app is based on :

* cesiumjs - https://cesium.com/ - The Map engine
* Vite -  https://vitej.dev/ - frontend tooling
* React - https://react.dev/ - UI
* Valtio - https://valtio.pmnd.rs - state management
* Shoelace - https://shoelace.style/ - The web components used for UI
* fontawesome - https://fontawesome.com/ - The icons library
* Echarts - https://echarts.apache.org/en/index.html - Charts library
* Bun - https://bun.sh/ - javascript runtime

