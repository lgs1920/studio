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