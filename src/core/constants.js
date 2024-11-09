import { faCrown, faLock, faUnlock, faUser } from '@fortawesome/pro-solid-svg-icons'


export const SLOGAN = 'Replay Your Adventures!'
/**
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

/** other */
export const WRONG = -99999999999

/**
 * Main Configuration file
 *
 * @type {string}
 */
export const CONFIGURATION = 'config.json'
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
export const CURRENT_JOURNEY = 'journey'
export const CURRENT_TRACK = 'track'
export const CURRENT_POI = 'poi'

export const DRAW_THEN_SAVE = 1
export const DRAW_WITHOUT_SAVE = 2
export const JUST_SAVE = 3

export const COLOR_SWATCHES_NONE = 'none'
export const COLOR_SWATCHES_SERIE = 'serie'
export const COLOR_SWATCHES_RANDOM = 'random'

/**
 * Settings sections
 */
export const APP_SETTING_SECTION = 'app'
export const STARTER_SETTING_SECTION = 'starter'
export const CAMERA_SETTING_SECTION = 'camera'
export const PROFILE_SETTING_SECTION = 'profile'
export const TRACK_SETTING_SECTION = 'journey'
export const SWATCHES_SETTING_SECTION = 'colorSwatches'
export const UNITS_SETTING_SECTION = 'unitsSystem'
export const LAYERS_SETTING_SECTION = 'layers'
export const TERRAINS_SETTING_SECTION = 'terrains'
export const UI_SETTING_SECTION = 'ui'
export const THEME_SETTING_SECTION = 'theme'

export const SETTING_SECTIONS = [
    APP_SETTING_SECTION,
    STARTER_SETTING_SECTION,
    CAMERA_SETTING_SECTION,
    PROFILE_SETTING_SECTION,
    TRACK_SETTING_SECTION,
    SWATCHES_SETTING_SECTION,
    UNITS_SETTING_SECTION,
    LAYERS_SETTING_SECTION,
    TERRAINS_SETTING_SECTION,
    UI_SETTING_SECTION,
    THEME_SETTING_SECTION,
]


/**
 * Layers and Terrains
 */
export const BASE_LAYERS = 'base'
export const OVERLAY_LAYERS = 'overlay'
export const TERRAIN_LAYERS = 'terrain'
export const LAYERS_THUMBS_DIR = '/assets/images/layers/thumbnails'
export const PREMIUM_ACCESS = 'premium'
export const FREEMIUM_ACCESS = 'freemium'
export const FREE_ANONYMOUS_ACCESS = 'free'
export const FREE_ACCOUNT_ACCESS = 'account'
export const UNLOCKED_ACCESS = 'unlocked'
export const LOCKED_ACCESS = 'locked'

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

/** Drawers **/

export const INFO_DRAWER = 'info-drawer'
export const LAYERS_DRAWER = 'layers-drawer'
export const JOURNEY_EDITOR_DRAWER = 'journey-editor-drawer'