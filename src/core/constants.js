/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: constants.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-03-02
 * Last modified: 2025-03-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    faBuildingColumns, faBuildings, faCampground, faCross, faCrown, faEarthEurope, faFlagSwallowtail, faFort,
    faHouseBlank, faLock, faMap, faMountains, faPlaceOfWorship, faRoad, faSquareParking, faTablePicnic, faTelescope,
    faUnlock, faUser,
} from '@fortawesome/duotone-regular-svg-icons'


export const SLOGAN = 'Replay Your Adventures!'
/*******************************************************************************
 * Time and duration constants in seconds
 */
const MILLIS = 1000
const SECOND = MILLIS
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY
export { MILLIS, SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, YEAR }

export const WRONG = -99999999999

/*******************************************************************************
 * Responsivity
 ******************************************************************************/
export const MOBILE_MAX = 767
export const DESKTOP_MIN = 768

/**
 * Main Configuration file
 *
 * @type {string}
 */
export const CONFIGURATION = 'config.yaml'
export const SETTINGS = 'settings.yaml'
export const LAYERS_TERRAINS_SETTINGS = 'layers-terrains.yaml'

/**
 * Servers identification
 *
 * @type {string}
 */
export const SERVERS = 'servers.json'
/**
 * Build date
 *
 * @type {string}
 */
export const BUILD = 'build.json'
/**
 * All platforms
 *
 * @type {{PROD: string, DEV: string, TEST: string, STAGING: string}}
 */
export const platforms = {
    DEV:     'development',
    STAGING: 'staging',
    PROD:    'production',
    TEST:    'test',
}


export const APP_KEY = 'LGS1920'
export const SETTINGS_STORE = 'settings'
export const VAULT_STORE = 'vault'
export const CURRENT_STORE = 'current'
export const JOURNEYS_STORE = 'journeys'
export const ORIGIN_STORE = 'origin'
export const POIS_STORE = 'pois'
export const CURRENT_JOURNEY = 'journey'
export const CURRENT_TRACK = 'track'
export const CURRENT_CAMERA = 'camera'

export const CURRENT_POI = 'poi'
export const POI_THRESHOLD_DISTANCE = 50 // meters

export const POI_STARTER_TYPE = 'starter'
export const FLAG_START_TYPE = 'start'
export const FLAG_STOP_TYPE = 'stop'
export const POI_TRACK_TYPE = 'track'
export const POI_STANDARD_TYPE = 'poi'
export const POI_TMP_TYPE = undefined


export const UPDATE_JOURNEY_THEN_DRAW = 1
export const UPDATE_JOURNEY_SILENTLY = 2
export const REMOVE_JOURNEY = 3

export const DRAW_THEN_SAVE = 1
export const DRAW_WITHOUT_SAVE = 2
export const JUST_SAVE = 3

export const COLOR_SWATCHES_NONE = 'none'
export const COLOR_SWATCHES_SEQUENCE = 'sequence'
export const COLOR_SWATCHES_RANDOM = 'random'

// List of settings exclusions (ie we keep the user choice)
// This array is then sorted alphabetically by object depth.
export const SETTING_EXCLUSIONS = [
    'layers.base', 'layers.terrain', 'layers.overlay',
    'layers.filter', 'layers.colorSettings',
    'app', 'scene', 'starter', 'coordinateSystem', 'unitSystem', 'poi.filter',
    'ui.camera', 'ui.welcome',
    'ui.menu', 'ui.poi.rotate', 'ui.poi.focusOnEdit',
].sort((a, b) => {
    const segmentsA = a.split('.')
    const segmentsB = b.split('.')

    for (let i = 0; i < Math.max(segmentsA.length, segmentsB.length); i++) {
        if (segmentsA[i] === undefined) {
            return -1
        }
        if (segmentsB[i] === undefined) {
            return 1
        }
        if (segmentsA[i] < segmentsB[i]) {
            return -1
        }
        if (segmentsA[i] > segmentsB[i]) {
            return 1
        }
    }
    return 0
})

/**
 * Layers and Terrains
 */
export const URL_AUTHENT_KEY = '{%authent%}'
export const LAYERS = 'layers'
export const BASE_ENTITY = 'base'
export const OVERLAY_ENTITY = 'overlay'
export const TERRAIN_ENTITY = 'terrain'
export const BASE_INDEX = 0      // Layer index
export const OVERLAY_INDEX = 1

export const DEFAULT_LAYERS_COLOR_SETTINGS = {
    brightness:            1.0,
    contrast:              1.0,
    alpha:                 1.0,
    hue:                   0.0,
    saturation:            1.0,
    gamma:                 1.0,
    colorToAlphaThreshold: 0,
    colorToAlpha:          '#ffffff',
}

export const LAYERS_THUMBS_DIR = '/assets/images/layers/thumbnails'
export const PREMIUM_ACCESS = 'premium'
export const FREEMIUM_ACCESS = 'freemium'
export const FREE_ANONYMOUS_ACCESS = 'free'
export const FREE_ACCOUNT_ACCESS = 'account'
export const UNLOCKED_ACCESS = 'unlocked'
export const LOCKED_ACCESS = 'locked'

export const TERRAIN_FROM_CESIUM = 'cesium'
export const TERRAIN_FROM_CESIUM_ELLIPSOID = 'ellipsoid'
export const TERRAIN_FROM_URL = 'url'

export const ACCESS_ICONS = {
    [FREEMIUM_ACCESS]:       {
        icon: faCrown,
        text: 'Freemium Access',
    },
    [PREMIUM_ACCESS]:        {
        icon: faCrown,
        text: 'Premium Access',
    },
    [FREE_ANONYMOUS_ACCESS]: {
        icon: faUnlock,
        text: '',
    },
    [FREE_ACCOUNT_ACCESS]:   {
        icon: faUser,
        text: 'Need account',
    },
    [UNLOCKED_ACCESS]:       {
        icon: faUnlock,
        text: 'Unlocked',
    },
    [LOCKED_ACCESS]:         {
        icon: faLock,
        text: 'locked',
    },
}

export const ALL = 'all'
export const LOCKED = 'locked'
export const UNLOCKED = 'unlocked'

/*******************************************************************************
 * UI Elements
 ******************************************************************************/

export const DOUBLE_CLICK_DELAY = 300 // milliseconds
export const DOUBLE_TAP_DELAY = 300     // milliseconds

/** Scene Mode **/

export const SCENE_MODE_2D = {
    value: 2, label: '2D', title: 'Map View', icon: faMap,
}
export const SCENE_MODE_3D = {
    value: 3, label: '3D', title: 'Globe View', icon: faEarthEurope,
}
export const SCENE_MODE_COLUMBUS = {
    value: 2.5, label: '2.5D', title: 'Columbus View', icon: faRoad,
}

export const SCENE_MODES = new Map([
                                       [SCENE_MODE_2D.value, SCENE_MODE_2D],
                                       [SCENE_MODE_3D.value, SCENE_MODE_3D],
                                       [SCENE_MODE_COLUMBUS.value, SCENE_MODE_COLUMBUS],
                                   ])

/** Drawers **/

export const INFO_DRAWER = 'info-drawer'
export const LAYERS_DRAWER = 'layers-drawer'
export const JOURNEY_EDITOR_DRAWER = 'journey-editor-drawer'
export const SETTINGS_EDITOR_DRAWER = 'settings-editor-drawer'
export const POIS_EDITOR_DRAWER = 'pois-editor-drawer'


/** Jaurney, Track, POI **/

export const GPX = 'gpx'
export const KML = 'kml'
export const KMZ = 'kmz'
export const GEOJSON = 'geojson'
export const JSON_ = 'json'

export const TRACK_SLUG = 'track'

export const SIMULATE_ALTITUDE = 99
export const DRAWING = 0
export const DRAWING_FROM_UI = 1
export const DRAWING_FROM_DB = 3
export const REFRESH_DRAWING = 2
export const ADD_JOURNEY = 9
export const FOCUS_ON_FEATURE = 1
export const NO_FOCUS = 2

/** Menu Disposition **/
export const START = 'start'
export const END = 'end'
export const TOP = 'top'
export const BOTTOM = 'bottom'

export const MENU_END_END = 'end-end'
export const MENU_END_START = 'end-start'
export const MENU_START_END = 'start-end'
export const MENU_START_START = 'start-start'
export const MENU_BOTTOM_START = 'bottom-start'
export const MENU_BOTTOM_END = 'bottom-end'

export const REMOVE_JOURNEY_IN_EDIT = 'in-journey-edit'
export const REMOVE_JOURNEY_IN_TOOLBAR = 'in-journey-toolbar'

/** Focus */
export const FOCUS_STARTER = 'starter'
export const FOCUS_LAST = 'last'
export const FOCUS_CENTROID = 'center'

let faSummit
/** POI Categories **/
export const POI_CATEGORY_ICONS = new Map([
                                              [POI_STANDARD_TYPE, {faFlagSwallowtail}],
                                              ['shelter', {faHouseBlank}],
                                              ['refuge', ['house-bed.svg']],
                                              ['building', {faBuildings}],
                                              ['viewpoint', {faTelescope}],
                                              ['summit', {faMountains}],
                                              ['cave', ['cave-in-mountains.svg']],
                                              ['car-park', {faSquareParking}],
                                              ['castle', {faFort}],
                                              ['place-of-worship', {faPlaceOfWorship}],
                                              ['cross', {faCross}],
                                              ['monument', {faBuildingColumns}],
                                              ['ruins', ['ruins.svg']],
                                              ['campground', {faCampground}],
                                              ['picnic-area', {faTablePicnic}],
                                          ])