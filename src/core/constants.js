/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: constants.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CESIUM_EVENTS as $CESIUM_EVENTS } from '@Core/events/cesiumEvents'
import {
    faBuildingColumns, faBuildings, faCampground, faCross, faCrown, faFlagPennant, faFlagSwallowtail, faFort,
    faHouseBlank, faLock, faMountains, faPlaceOfWorship, faSquareParking, faTablePicnic, faTelescope, faUnlock, faUser,
}                                          from '@fortawesome/duotone-regular-svg-icons'
import { faCompass, faRoute, faText }      from '@fortawesome/pro-regular-svg-icons'
import { faChartFft, faGavel }             from '@fortawesome/pro-solid-svg-icons'


export const SLOGAN = 'Replay the World Outdoors!'
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
export const DESKTOP_MIN = 992

/**
 * Main Configuration file
 *
 * @type {string}
 */
export const CONFIGURATION = 'config.yaml'
export const SETTINGS = 'settings.yaml'
export const LAYERS_TERRAINS_SETTINGS = 'layers-terrains.yaml'
export const COUNTRIES = 'countries.yaml'
export const WIDGETS = 'widgets.yaml'
export const WORLD = 'WORLD'
export const COUNTRY_FLAGS_DIR = '/assets/images/flags/'

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
export const APP_STUDIO = `${APP_KEY} Studio`
export const LGS_PROJECT = 'LGS1920 Project'
export const SETTINGS_STORE = 'settings'
export const VAULT_STORE = 'vault'
export const CURRENT_STORE = 'current'
export const JOURNEYS_STORE = 'journeys'
export const WIDGETS_STORE = 'widgets'
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
export const POI_FLAG_START = 'start'
export const POI_FLAG_STOP = 'stop'


export const UPDATE_JOURNEY_THEN_DRAW = 11
export const UPDATE_JOURNEY_SILENTLY = 22
export const REMOVE_JOURNEY = 33

export const DRAW_THEN_SAVE = 1
export const DRAW_WITHOUT_SAVE = 2
export const JUST_SAVE = 3

export const COLOR_SWATCHES_NONE = 'none'
export const COLOR_SWATCHES_SEQUENCE = 'sequence'
export const COLOR_SWATCHES_RANDOM = 'random'

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
export const LOW_TERRAIN_PRECISION = 1
export const HIGH_TERRAIN_PRECISION = 2


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
export const NONE = 'none'
export const LOCKED = 'locked'
export const UNLOCKED = 'unlocked'

/*******************************************************************************
 * UI Click/Touch events
 ******************************************************************************/
export const DOUBLE_CLICK_TIMEOUT = 300     // milliseconds
export const DOUBLE_TAP_TIMEOUT = 300       // milliseconds
export const LONG_TAP_TIMEOUT = 700         // milliseconds
export const CESIUM_EVENTS = $CESIUM_EVENTS

export const EVENTS = {
    DOWN:         'DOWN',
    UP:           'UP',
    CLICK:        'CLICK',
    TAP:          'TAP',
    DOUBLE_TAP:   'DOUBLE_TAP',
    LONG_TAP:     'LONG_TAP',
    DOUBLE_CLICK: 'DOUBLE_CLICK',
    RIGHT_DOWN:   'RIGHT_DOWN',
    RIGHT_UP:     'RIGHT_UP',
    RIGHT_CLICK:  'RIGHT_CLICK',
    MIDDLE_DOWN:  'MIDDLE_DOWN',
    MIDDLE_UP:    'MIDDLE_UP',
    MIDDLE_CLICK: 'MIDDLE_CLICK',
    MOUSE_MOVE:   'MOUSE_MOVE',
    WHEEL:        'WHEEL',
    PINCH_START:  'PINCH_START',
    PINCH_END:    'PINCH_END',
    PINCH_MOVE:   'PINCH_MOVE',
}

/*******************************************************************************
 * Custom  events
 ******************************************************************************/

export const APP_EVENT = {
    INITIAL_FOCUS: 'app/initial-focus',
    WELCOME:       {
        HIDE: 'app/welcome/hide',
    },
}


/** Scene Mode **/

export const SCENE_MODE_2D = {
    value: 2, label: '2D', title: 'Map View', icon: 'map',
}
export const SCENE_MODE_3D = {
    value: 3, label: '3D', title: 'Globe View', icon: 'earth-europe',
}
export const SCENE_MODE_COLUMBUS = {
    value: 2.5, label: '2.5D', title: 'Columbus View', icon: 'road',
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
export const WIDGETS_EDITOR_DRAWER = 'widgets-editor-drawer'

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
export const GLOBAL_PARENT = '__global__'

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

/**
 * Mapping of Points of Interest (POI) categories to their associated icons.
 * Each entry in the map associates a POI category name or type with a visual representation,
 * which can be either a FontAwesome icon object or a custom SVG file path.
 * This variable provides a convenient way to retrieve icons for various types of POIs.
 *
 * Key-Value Structure:
 * - The key represents the POI category or identifier (e.g., 'shelter', POI_STANDARD_TYPE).
 * - The value is an object or array containing the icon representation:
 *   - FontAwesome icon objects use `{faIconName}` format.
 *   - Custom SVG file paths are represented as strings within an array (e.g., ['icon.svg']).
 *
 * Use Cases:
 * - Assigning graphical indicators to different POI types on a map application.
 * - Enhancing user interfaces by visually differentiating POI categories.
 *
 * Example POI Categories (Keys in the Map):
 * - 'shelter': Refers to a shelter icon.
 * - 'castle': Refers to a castle icon.
 * - 'viewpoint': Refers to a viewpoint telescope icon.
 *
 * Example Icon Types (Values in the Map):
 * - FontAwesome Icons: Represented as `{faIconName}` objects.
 * - Custom SVGs: File paths for custom icons, represented as strings in arrays.
 */
export const POI_CATEGORY_ICONS = new Map([
                                              [POI_STANDARD_TYPE, {faFlagSwallowtail}],
                                              [POI_FLAG_START, {faFlagPennant}],
                                              [POI_FLAG_STOP, {faFlagPennant}],
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


/**
 * A constant object representing different sizes for Points of Interest (POI).
 *
 * Each key in the object corresponds to a specific type of POI size, with
 * associated dimensions provided as width and height properties.
 *
 * Properties:
 * - expanded: Represents the dimensions for an expanded POI. Contains width and height.
 * - reduced: Represents the dimensions for a reduced POI. Contains width and height.
 * - arrow: Represents the dimensions for a POI arrow. Contains width and height.
 */
export const POI_SIZES = {
    'expanded': {width: 130, height: 60},
    'reduced': {width: 32, height: 32},
    'arrow':    {width: 6, height: 6},
}

// POI Origins
export const POI_VERTICAL_ALIGN_BOTTOM = -1, // Both are defined
             POI_VERTICAL_ALIGN_CENTER = 0   // for cesium engine

export const ADD_POI_EVENT    = 'poi/add',
             REMOVE_POI_EVENT = 'poi/remove',
             UPDATE_POI_EVENT = 'poi/update'


/** Compass **/
export const NO_COMPASS = 0,
COMPASS_FULL            = 1,
COMPASS_LIGHT           = 2

/*******************************************************************************
 * Context Menu
 ******************************************************************************/

export const LGS_CONTEXT_MENU_HOOK = 'lgs-context-menu-hook'

/*******************************************************************************
 * Device type, Navigator, Os, ...
 ******************************************************************************/

export const OS = {
    windows: 'windows',
    linux:   'linux',
    macOS: 'macos',
    macos: 'macos',
    android: 'android',
    iOS:     'ios',
    ios:   'ios',
    unknown: 'unknown',
}

export const OS_ICONS = {
    windows: ['windows', 'brands'],
    linux:   ['linux', 'brands'],
    macos:   ['apple', 'brands'],
    android: ['android', 'brands'],
    ios:     ['apple', 'brands'],
    unknown: ['desktop', 'regular'],
}

export const ORIENTATION = {
    portrait:  'portrait',
    landscape: 'landscape',
}

export const DEVICE_TYPE = {
    mobile:  'mobile',
    tablet:  'tablet',
    desktop: 'desktop',
    unknown: 'unknown',
}

export const NAVIGATOR = {
    chrome:  ['Chrome', 'brands'],
    firefox: ['Firefox', 'brands'],
    safari:  ['Safari', 'brands'],
    edge:    ['Edge', 'brands'],
    opera:   ['Opera', 'brands'],
    unknown: ['unknown', 'regular'],
}

/*******************************************************************************
 * Banners
 ******************************************************************************/
export const BANNER_HIDE_DELAY_INSTALL = 3  // Seconds
export const BANNER_HIDE_DELAY = 7          // Seconds
export const BANNER_SHOW_DELAY = 5          // Seconds


/*******************************************************************************
 * Widgets and Toolbars
 ******************************************************************************/
export const LGS_TOOLBAR = 'lgs-toolbar'
export const LGS_WIDGET = 'lgs-widget'
export const LGS_VISUAL_WIDGET = 'lgs-visual-widget'
export const LGS_ANIMATION_DRAGGING = 'lgs-animation-dragging'
export const LGS_ANIMATION_RESIZING = 'lgs-animation-resizing'
export const LGS_ANIMATION_SCALING = 'lgs-animation-scaling'
export const LGS_WIDGET_SCALE_BASE = 4
const LGS_WIDGET_DPR = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
export const LGS_WIDGET_SCALE_EFFECTIVE = Math.min(LGS_WIDGET_SCALE_BASE, LGS_WIDGET_SCALE_BASE / LGS_WIDGET_DPR)
export const LGS_WIDGET_SCALE_FACTOR = LGS_WIDGET_SCALE_EFFECTIVE
console.log()
export const WIDGET_MOUNT_TIMEOUT = 15000

export const VIDEO_CROP_ZONE = 'video-crop-zone'
export const VIDEO_TOOLS_WIDGETS   = 'video-tools-widgets',
             CROP_TOOLS_WIDGETS    = 'crop-tools-widgets',
             MULTI_PURPOSE_WIDGETS = 'multi-purpose-widgets',
             JOURNEY_WIDGETS       = 'journey-widgets',
             SCENE_WIDGETS         = 'scene-widgets'

export const COMPASS_WIDGET       = 'compass-widget',
             CREDITS_WIDGET       = 'credits-widget',
             PROFILE_WIDGET       = 'profile-widget',
             TEXT_WIDGET          = 'text-widget',
             JOURNEY_STATS_WIDGET = 'journey-stats-widget'

export const WIDGETS_CAPABILITIES   = [
           'canRemove',
           'canReset',
           'canMaximize',
           'canPosition',
           'canEdit',
       ],
             WIDGETS_CONFIGURATION  = new Map([
                                                  [
                                                      COMPASS_WIDGET, {
                                                      icon:      faCompass,
                                                      component: 'CompassWidget',
                                                  },
                                                  ],
                                                  [
                                                      CREDITS_WIDGET, {
                                                      icon:      faGavel,
                                                      component: 'CreditsWidget',
                                                  },
                                                  ],

                                                  [
                                                      PROFILE_WIDGET, {
                                                      icon:      faChartFft,
                                                      component: 'ProfileWidget',
                                                  },
                                                  ],
                                                  [
                                                      TEXT_WIDGET, {
                                                      icon:      faText,
                                                      component: 'TextWidget',
                                                  },
                                                  ],
                                                  [
                                                      JOURNEY_STATS_WIDGET, {
                                                      icon:      faRoute,
                                                      component: 'JourneyStatsWidget',
                                                  },
                                                  ],
                                              ]),

             WIDGET_LAYER_START = 4000,
             WIDGET_LAYER_STEP      = 1,
             WIDGET_LAYER_TOP   = 5000,


             DEFAULT_WIDGETS_LIST   = '@Components/MainUI/widgets/list',
             DEFAULT_WIDGET_CONTEXT = {
                 widgetEditor: false,
                 widgetsBoard: '',
                 zIndex: WIDGET_LAYER_START,
             }

export const SCENE_WIDGETS_BOARD = 'scene',
             VIDEO_WIDGETS_BOARD = VIDEO_CROP_ZONE

export const DYNAMIC_WIDGET_PART = 'dynamic-widget-part',
             STATIC_WIDGET_PART  = 'static-widget-part'

export const WIDGET_SHADOWS = new Map([
                                          ['small', ' var(--sl-shadow-medium)'],
                                          ['normal', ' var(--sl-shadow-large)'],
                                          ['large', ' var(--sl-shadow-x-large)'],
                                      ])
export const WIDGET_RADIUS = new Map([
                                         ['none', {name: 'None', value: '0'}],
                                         ['small', {name: 'Small', value: ' var(--lgs-border-radius-s)'}],
                                         ['medium', {name: 'Medium', value: ' var(--lgs-border-radius)'}],
                                         ['large', {name: 'Large', value: ' var(--lgs-border-radius-l)'}],
                                         ['pill', {name: 'Pill', value: ' 9999px'}],
                                     ])

/**
 * Google Fonts available for text widgets
 * Alphabetically sorted list of fonts loaded from Google Fonts
 */
export const WIDGET_GOOGLE_FONTS = [
    'Abril Fatface',
    'Alumni Sans Pinstripe',
    'Roboto Condensed',
    'Bangers',
    'Dancing Script',
    'Fredoka One',
    'Lobster',
    'Luckiest Guy',
    'Nunito',
    'Open Sans',
    'Oswald',
    'Pacifico',
    'Quicksand',
    'Roboto',
].sort((a, b) => a.localeCompare(b))

/**
 * Additional Google Fonts used by the app (not in widget selector)
 */
export const APP_GOOGLE_FONTS = [
    'Cookie',
    'Lato',
]

/**
 * System font stack for text widgets
 */
export const WIDGET_SYSTEM_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

/**
 * Complete list of font families for text widgets
 * Includes system font and Google Fonts
 */
export const WIDGET_FONT_FAMILIES = ['System', ...WIDGET_GOOGLE_FONTS]

export const WIDGET_EDITOR_PRE_RENDER_EVENT  = 'widget-editor-pre-render',
             WIDGET_EDITOR_POST_RENDER_EVENT = 'widget-editor-post-render'
