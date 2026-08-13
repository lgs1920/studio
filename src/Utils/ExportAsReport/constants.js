/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: constants.js
 *
 ******************************************************************************/

import {
    faCalendarDays,
    faClock,
    faGlobePointer,
    faLocationDot,
    faMountains,
    faPaperPlane,
    faPersonHiking,
    faRoute,
} from '@fortawesome/pro-regular-svg-icons'
import {
    faArrowRightLong as faArrowRightLongSolid,
    faLocationArrowUp as faLocationArrowUpSolid,
} from '@fortawesome/pro-solid-svg-icons'

export const CARDINAL_VIEWS = [
    {label: 'North', rotation: 0},
    {label: 'East', rotation: 90},
    {label: 'South', rotation: 180},
    {label: 'West', rotation: 270},
]
export const THREE_D_CARDINAL_VIEWS = [
    {label: 'North', shortLabel: 'N', heading: 0},
    {label: 'South', shortLabel: 'S', heading: 180},
    {label: 'West', shortLabel: 'W', heading: 270},
    {label: 'East', shortLabel: 'E', heading: 90},
]

export const PAGE_MARGIN = 12
export const SECTION_GAP = 6
export const TEXT_LINE_HEIGHT = 4.8
export const MAP_STROKE_WIDTH = 0.55
export const ENDPOINT_BADGE_RADIUS = 2.45
export const POI_BADGE_RADIUS = 2.55
export const TABLE_BADGE_RADIUS = 3.7
export const COORDINATE_MATCH_TOLERANCE = 0.000001
export const CESIUM_SCENE_3D_MODE = 3
export const THREE_D_SNAPSHOT_PITCH = -45
export const MAP_SNAPSHOT_TIMEOUT = 3500
export const PDF_COLORS = {
    text:       [0, 0, 0],
    muted:      [82, 82, 82],
    line:       [185, 185, 185],
    trace:      [68, 68, 68],
    headerFill: [238, 238, 238],
    mapFill:    [249, 249, 249],
    white:      [255, 255, 255],
}
export const PDF_ICON_DEFS = {
    activity: faPersonHiking,
    date:     faCalendarDays,
    location: faLocationDot,
    mountains: faMountains,
    mail:     faPaperPlane,
    route:    faRoute,
    site:     faGlobePointer,
    time:     faClock,
}
export const MAP_ICON_DEFS = {
    north:    faArrowRightLongSolid,
    progress: faLocationArrowUpSolid,
}
export const STUDIO_NAME = 'LGS1920 Studio'
export const STUDIO_URL = 'https://www.lgs1920.fr'
export const STUDIO_CONTACT = 'studio@lgs1920.fr'
export const STUDIO_SIGNATURE = `Proudly made with ${STUDIO_NAME}`
export const STUDIO_LOGO_URL = '/assets/images/logo-lgs1920-studio-s.png'
export const STUDIO_LOGO_RATIO = 300 / 103
