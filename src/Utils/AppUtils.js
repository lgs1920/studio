/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-07
 * Last modified: 2026-06-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    BUILD, CONFIGURATION, COUNTRIES, REPLAY_SETTINGS, FREE_ANONYMOUS_ACCESS, LAYERS_TERRAINS_SETTINGS,
    LGS_CONTEXT_MENU_HOOK, MILLIS, platforms, SERVERS, SETTINGS, SETTINGS_STORE, VAULT_STORE, WIDGET_LAYER_TOP, WIDGETS,
}                                   from '@Core/constants'
import { ElevationServer }          from '@Core/Elevation/ElevationServer'
import { Settings }                 from '@Core/settings/Settings'
import { SettingsSection }          from '@Core/settings/SettingsSection'
import { ionTokenManager }          from '@Core/ui/IonTokenManager'
import { ensureJourneyReplaySettings } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import axios                        from 'axios'
import * as Cesium                  from 'cesium'
import YAML                         from 'yaml'
import { EventEmitter }             from '../assets/libs/EventEmitter/EventEmitter'
import { FA2SL }                    from './FA2SL'

export class AppUtils {
    static THEME_STORAGE_KEY = 'theme'
    static ON_MAP_THEME_STORAGE_KEY = 'onMapTheme'
    static BRAND_COLOR_STORAGE_KEY = 'brandColor'
    static ROOT_THEME_CLASS = 'wa-theme-lgs1920'
    static DEFAULT_BRAND_COLOR = 'yellow'
    static BRAND_COLORS = ['yellow', 'orange', 'red', 'pink', 'purple', 'blue', 'green', 'gray']
    static ON_MAP_THEMES = ['default', 'spring', 'fall', 'winter']

    static LEGACY_ROOT_THEME_PREFIXES = [
        'sl-theme-',
        'wa-brand-',
        'wa-palette-',
        'wa-neutral-',
        'wa-success-',
        'wa-warning-',
        'wa-danger-',
    ]

    static LEGACY_ROOT_THEME_CLASSES = new Set([
                                                   'wa-theme-premium',
                                               ])
    static uiInit = false
    /**
     * Split a slug using '#'
     *
     * @return {array}
     */
    static splitSlug = (slug => slug.split(`#`))
    static deepClone = ((obj, parent = null, map = new Map()) => {
        if (obj === null) {
            return null
        }
        if (typeof obj !== 'object') {
            return obj
        }
        if (map.has(obj)) {
            return map.get(obj)
        }

        let clone
        if (Array.isArray(obj)) {
            clone = []
            map.set(obj, clone)
            obj.forEach((item, index) => {
                clone[index] = AppUtils.deepClone(item, null, map)
            })
        }
        else {
            clone = Object.assign({}, obj, parent)
            map.set(obj, clone)
            Object.keys(clone).forEach(key => {
                clone[key] = AppUtils.deepClone(obj[key], null, map)
            })
        }
        return clone
    })

    /**
     * Slugification
     *
     * from https://gist.github.com/hagemann/382adfc57adbd5af078dc93feef01fe1
     *
     * @param {string} string
     */
    static slugify = string => {
        if (string === undefined || string === null) {
            return ''
        }

        const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìıİłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;#'
        const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
        const p = new RegExp(a.split('').join('|'), 'g')

        // # is a special character
        const chunks = string.split('#')

        const slug = chunks.map(string => string.toString().toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
            .replace(/&/g, '-and-') // Replace & with 'and'
            .replace(/[^\w-]+/g, '') // Remove all non-word characters
            .replace(/--+/g, '-') // Replace multiple - with single -
            .replace(/^-+/, '') // Trim - from start of text
            .replace(/-+$/, ''), // Trim - from end of text)
        )

        return slug.join('#')
    }

    static MapToObject = map => Object.fromEntries(map.entries())

    static resolveBrandColor = (brandColor = null) => {
        const fallbackColor = localStorage.getItem(AppUtils.BRAND_COLOR_STORAGE_KEY) || AppUtils.DEFAULT_BRAND_COLOR
        const resolvedColor = brandColor || fallbackColor
        return AppUtils.BRAND_COLORS.includes(resolvedColor) ? resolvedColor : AppUtils.DEFAULT_BRAND_COLOR
    }

    static resolveOnMapTheme = (onMapTheme = null) => {
        const fallbackTheme = localStorage.getItem(AppUtils.ON_MAP_THEME_STORAGE_KEY) || 'default'
        const resolvedTheme = onMapTheme || fallbackTheme
        const normalizedTheme = resolvedTheme === 'autumn' ? 'fall' : resolvedTheme
        return AppUtils.ON_MAP_THEMES.includes(normalizedTheme) ? normalizedTheme : 'default'
    }

    static applyOnMapTheme = (onMapTheme = null) => {
        if (typeof document === 'undefined') {
            return 'default'
        }

        const resolvedTheme = AppUtils.resolveOnMapTheme(onMapTheme)
        if (document.body) {
            document.body.dataset.onMapTheme = resolvedTheme
        }

        return resolvedTheme
    }

    static normalizeDocumentThemeClasses = (root = document.documentElement) => {
        if (!root) {
            return
        }

        const toRemove = Array.from(root.classList).filter((className) => {
            if (AppUtils.LEGACY_ROOT_THEME_CLASSES.has(className)) {
                return true
            }

            if (className.startsWith('wa-theme-') && className !== 'wa-theme-lgs1920') {
                return true
            }

            return AppUtils.LEGACY_ROOT_THEME_PREFIXES.some(prefix => className.startsWith(prefix))
        })

        if (toRemove.length > 0) {
            root.classList.remove(...toRemove)
        }
    }

    static setTheme = (theme = null, brandColor = null, onMapTheme = null) => {
        if (!theme) {
            theme = localStorage.getItem(AppUtils.THEME_STORAGE_KEY) || lgs.settings.theme || 'system'
        }

        const root = document.documentElement
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
        const resolvedBrandColor = AppUtils.resolveBrandColor(brandColor)
        const resolvedOnMapTheme = AppUtils.applyOnMapTheme(onMapTheme)

        AppUtils.normalizeDocumentThemeClasses(root)
        root.classList.add(AppUtils.ROOT_THEME_CLASS, `wa-brand-${resolvedBrandColor}`)
        root.classList.toggle('wa-dark', isDark)
        root.classList.toggle('wa-light', !isDark)

        return resolvedOnMapTheme
    }

    /**
     * Capitalize  string
     *
     * @param string {string}
     * @return {string}
     */
    static capitalize = (string) => {
        return string[0].toUpperCase() + string.slice(1)
    }

    /**
     * Converts a kebab-case string to camelCase or UpperCamelCase
     * @param {string} string - The string to transform
     * @param {boolean} [upper=false] - If true, returns UpperCamelCase (PascalCase)
     * @returns {string}
     */
    static camelCase = (string, upper = false) => {
        return string
            .split('-')
            .map((s, index) => {
                // Return empty string if segment is empty
                if (!s) {
                    return s
                }

                // Force uppercase for the first letter if it is not the first segment or if upper is requested
                if (index > 0 || upper) {
                    return s[0].toUpperCase() + s.slice(1)
                }

                // Default behavior for the first segment in lowerCamelCase
                return s[0].toLowerCase() + s.slice(1)
            })
            .join('')
    }


    /**
     * Converts a kebab-case string to PascalCase
     * @param {string} string - The string to transform
     * @param {boolean} [upper=false] - If true, returns UpperCamelCase (PascalCase)
     * @returns {string}
     */
    static pascalCase = (string) => AppUtils.camelCase(string, true)

    /**
     * Converts a camelCase or PascalCase string to kebab-case
     * @param {string} string - The string to transform
     * @returns {string}
     */
    static kebabCase = (string) => {
        return string
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // Insère un tiret entre une minuscule/chiffre et une majuscule
            .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2') // Gère les acronymes (ex: AppURL -> app-url)
            .toLowerCase()
    }
    /**
     * LGS1920Context initialisation
     *
     * @return {Promise<void>}
     */
    static init = async () => {
        // Read App configuration
        const appConfig = await fetch(CONFIGURATION, {cache: 'no-store'})
            .then(res => res.text())
            .then(text => YAML.parse(text),
            )
        // Read Settings
        let settings
        settings = await fetch(SETTINGS, {cache: 'no-store'})
            .then(res => res.text())
            .then(text => YAML.parse(text),
            )

        // Read Layers
        settings.layers = await fetch(LAYERS_TERRAINS_SETTINGS, {cache: 'no-store'})
            .then(res => res.text())
            .then(text => YAML.parse(text),
            )

        // Read Widgets
        const raw = await fetch(WIDGETS, {cache: 'no-store'})
            .then(res => res.text())
            .then(text => YAML.parse(text),
            )

        const replay = await fetch(REPLAY_SETTINGS, {cache: 'no-store'})
            .then(res => res.text())
            .then(text => YAML.parse(text),
            )

        const replayYamlSettings = replay?.replay ?? replay ?? {}

        settings.ui = settings.ui ?? {}
        settings.ui.replay = AppUtils.deepClone(replayYamlSettings)

        // add settings section
        settings.widgets = raw.widgets


        // Initialize groups with their metadata
        __.widgets = new Map()
        for (const [groupKey, groupValue] of Object.entries(raw['widget-groups'])) {
            __.widgets.set(groupKey, {
                ...groupValue,
                widgets: new Map(),
            })
        }

        // Assign widgets to their groups
        for (const [widgetKey, widgetValue] of Object.entries(raw.widgets)) {
            if (widgetValue.groups && Array.isArray(widgetValue.groups)) {
                for (const groupId of widgetValue.groups) {
                    const group = __.widgets.get(groupId)
                    if (group) {
                        group.widgets.set(widgetKey, widgetValue)
                    }
                }
            }
        }

        // Get the setting sections ID
        lgs.settingSections = Object.keys(settings)

        lgs.configuration = {...appConfig, ...settings}
        lgs.savedConfiguration = {...appConfig, ...settings}

        // Read countries
        __.countries = await fetch(COUNTRIES, {cache: 'no-store'})
            .then(res => res.text())
            .then(text => {
                      const countries = new Map()
                      YAML.parse(text).map(country => {
                          countries.set(country.code, country)
                      })
                      return countries
                  },
            )

        // Read servers
        lgs.servers = await fetch(SERVERS, {cache: 'no-store'}).then(
            res => res.json(),
        )

        lgs.build = await fetch(BUILD, {cache: 'no-store'}).then(
            res => res.json(),
        )

        lgs.platform = lgs.servers.platform

        lgs.createDB()

        lgs.setDefaultPOIConfiguration()

        // Register Font Awesome icons in ShoeLace
        FA2SL.registerFontAwesomeInShoelace('fa')

        // Backend
        lgs.BACKEND_API = `${lgs.servers.studio.proxy}${lgs.servers.backend.protocol}://${lgs.servers.backend.domain}:${lgs.servers.backend.port}`

        // Create an Axios instance
        lgs.axios = axios.create()

        lgs.colors = {}
        // Default colors (defined in theme.css)
        lgs.colors.light = __.ui.ui.hslaString2Hex(__.ui.css.getCSSVariable('--lgs-light-color'))
        lgs.colors.dark = __.ui.ui.hslaString2Hex(__.ui.css.getCSSVariable('--lgs-dark-color'))

        lgs.colors.ocean = __.ui.ui.hslaString2Hex(__.ui.css.getCSSVariable('--lgs-ocean-color'))
        lgs.colors.ground = __.ui.ui.hslaString2Hex(__.ui.css.getCSSVariable('--lgs-ground-color'))

        // Add theme dependant colors
        lgs.configuration.swatches.list.push(lgs.colors.light)
        lgs.configuration.swatches.list.push(lgs.colors.dark)

        // Default POI colors
        lgs.colors.poiDefaultBackground = lgs.colors.light
        lgs.colors.poiDefault = lgs.colors.dark


        /**************************************
         * Some dimension
         */
        lgs.gutter = {
            s:  __.ui.css.rem2px(__.ui.css.getCSSVariable('--lgs-gutter-s')),
            xs: __.ui.css.rem2px(__.ui.css.getCSSVariable('--lgs-gutter-xs')),
            l:  __.ui.css.rem2px(__.ui.css.getCSSVariable('--lgs-gutter-l')),
            m:  __.ui.css.rem2px(__.ui.css.getCSSVariable('--lgs-gutter-m')),
            n:  __.ui.css.rem2px(__.ui.css.getCSSVariable('--lgs-gutter')),
        }

        // Widgets
        __.ui.css.setCSSVariable('--lgs-above-widgets', WIDGET_LAYER_TOP + 1)


        /***************************************
         * Application settings
         */
        lgs.settings = new Settings()

        // Add settings sections
        const promises = lgs.settingSections.map(async (key) => {
            const section = new SettingsSection(key)
            await section.init()
            await lgs.settings.add(section)
        })
        await Promise.all(promises)

        Object.assign(lgs.stores.replay, ensureJourneyReplaySettings())

        await ionTokenManager.load()

        // Removed useless sections in DB  //TODO do not read and check if nothing changed
        const DBSections = await lgs.db.settings.keys(SETTINGS_STORE)
        const removedSections = DBSections.filter(element => !lgs.settingSections.includes(element))
        for (const key of removedSections) {
            await lgs.db.settings.delete(key, SETTINGS_STORE)
        }

        // Read and apply tokens
        for (const provider of lgs.settings.layers.providers) {
            let index = 0
            for (const layer of provider.layers) {
                if (layer.usage.type !== FREE_ANONYMOUS_ACCESS) {

                    const token = await lgs.db.vault.get(layer.id, VAULT_STORE)
                    // We get a token, let's use it now
                    if (token) {
                        provider.layers[index].usage.token = token
                        provider.layers[index].usage.unlocked = true
                    }
                }
                index++
            }
        }

        // sanitize strings once; HMR can rerun init in the same runtime
        if (!Object.getOwnPropertyDescriptor(String.prototype, 'sanitize')) {
            Object.defineProperty(String.prototype, 'sanitize', {
                value:        function () {
                    return this
                        .normalize('NFKD')                  // Removes accents and special Unicode characters
                        .replace(/[\u0300-\u036f]/g, '')    // Strips diacritics (accent marks)
                        .trim()                             // Removes leading and trailing spaces
                        .replace(/[/\\:*?"<>|]/g, '_')      // Replaces forbidden filename characters
                        .replace(/[\s]+/g, '_')             // Converts multiple spaces to a single underscore
                        .replace(/_+/g, '_')                // Collapses consecutive underscores
                        .replace(/^_+|_+$/g, '')           // Removes leading and trailing underscores
                },
                writable:     false,
                configurable: false,
            })
        }


        // Ping server
        const server = await __.app.pingBackend()

        if (server.alive) {
            try {
                // Versions
                try {
                    const response = await lgs.axios.get([lgs.BACKEND_API, 'versions'].join('/'))
                    lgs.versions = response.data
                }
                catch (error) {
                    console.error(error)
                }

                lgs.events = new EventEmitter()

                // Cesium ION auth
                Cesium.Ion.defaultAccessToken = lgs.stores.ion.token || ionTokenManager.sharedToken


                // Shoelace needs to avoid bubbling events. Here's an helper
                window.isOK = (event) => {
                    return event.eventPhase === Event.AT_TARGET
                }

                // Update last visit
                lgs.settings.app.lastVisit = Date.now()

                // Changelog metadata and content are loaded lazily when the drawer is displayed.
                lgs.changelog = {
                    files:  null,
                    toRead: [],
                }

                // Set Elevation servers
                lgs.elevationServers = ElevationServer.SERVERS

                return {status: true}
            }
            catch (error) {
                return {status: false, error: error}
            }
        }
        else {
            const info = __.app.isDevelopment() ? `'<br/>Try "bun run dev" to restart the application!` : ''
            return {
                status: false,
                error: new Error(`${lgs.settings.applicationName} Backend server seems to be unreachable!${info}`),
            }
        }


    }

    /**
     * create a single title for objects in Map
     *
     * if for the attribute title, title = "my title" already exists as title,
     * let's change it to "my title (1)" or "...(2)" until the new title
     * does not exist.
     *
     * @param {string} title         title to check
     * @param {Map} available             Map that contains objects with title attributes
     *
     * @return {string}     The single title
     *
     */
    static singleTitle = (title, available) => {
        let counter = 0
        let single = title

        // Vérifie si la valeur existe déjà dans le tableau
        const list = available instanceof Map ? Array.from(available.values()) : available
        let valueExists = list.some(obj => obj.title === single)
        while (valueExists) {
            counter++
            single = `${title} (${counter})`
            valueExists = list.some(obj => obj.title === single)
        }
        return single
    }

    /**
     * Ping Backend server
     *
     * Timeouts for connections and response are the same, 2 seconds
     *
     *
     * @return {alive:boolean}
     */
    static pingBackend = async () => {

        try {
            return lgs.axios({
                                 method:  'get',
                                 url:     [lgs.BACKEND_API, 'ping'].join('/'),
                                 headers: {
                                     'content-type': 'application/json',
                                     'Accept':       'application/json',
                                 },
                                 timeout: 3 * MILLIS,
                                 signal:  AbortSignal.timeout(3 * MILLIS),
                             })
                .then(async function (response) {
                    if (response.data !== '') {
                        return response.data
                    }
                    return await __.app.startBackend()
                })
                .catch(async function () {
                    return await __.app.startBackend()
                })
        }
        catch (error) {
            console.error(error)
            return {alive: false}
        }
    }

    /**
     * Start Backend server
     *
     * Timeouts for connections and response are the same, 2 seconds
     * This works on production, staging and test only
     *
     * @return {alive:boolean}
     */
    static startBackend = async () => {
        if (!__.app.isDevelopment()) {
            return lgs.axios({
                                 method:  'post',
                                 url:     `start-backend.php`,
                                 headers: {
                                     Accept:             'application/json',
                                     'X-Requested-With': 'XMLHttpRequest',
                                 },
                             })
                .then(function (response) {
                    return response.data
                })
                .catch(function (error) {
                    console.error(error)
                    return {alive: false}
                })
        }
        return {alive: false}
    }

    /**
     * Build a URL from protocol and domain
     *
     * @param protocol{string}
     * @param domain {string}
     *
     * @return {string}
     */
    static buildUrl = ({protocol = 'https', domain}) => {
        return `${protocol}://${domain}`
    }

    /**
     * Define a generic slug in the form of:
     *
     *    <prefix>#<content>#<suffix>
     *        or
     *    <prefix>#<content[0]>#<cotent[1]># ...<content[n]>#<suffix>
     *
     *    Prefix an suffix are optional (but it's better to have some :) )
     *
     * @param suffix {string|number}
     * @param content {string|number|array}
     * @param prefix {string|number}
     *
     * @return {string}
     */
    static setSlug = ({suffix = '', content = '', prefix = ''}) => {

        // content could be an array, let's join it into a single string
        // Slugify each term
        if (Array.isArray(content)) {
            content = content.map(text => __.app.slugify(text)).join('#')
        }
        else {
            content = __.app.slugify(content)
        }

        const start = (prefix.length > 0) ? `${__.app.slugify(prefix)}#` : ``
        const end = (suffix.length > 0) ? `#${__.app.slugify(suffix)}` : ``

        //
        return `${start}${(content.length > 0) ? content : ``}${end}`
    }

    /**
     * Check if it is running on development
     *
     * @return {boolean}
     */
    static isDevelopment = () => {
        return lgs.platform === platforms.DEV
    }

    /**
     * Check if it is running on production
     *
     * @return {boolean}
     */
    static isProduction = () => {
        return lgs.platform === platforms.PROD
    }

    /**
     * Check if it is running on test
     *
     * @return {boolean}
     */
    static isTest = () => {
        return lgs.platform === platforms.TEST
    }

    /**
     * Check if it is running on staging
     *
     * @return {boolean}
     */
    static isStaging = () => {
        return lgs.platform === platforms.STAGING
    }

    /**
     * Checks if an object is empty
     *
     * @param obj
     * @return {boolean} true if empty
     */
    static isEmpty = (obj = {}) => {
        return Object.keys(obj).length === 0
    }

    /**
     * Return the prev and next values of map.
     *
     * @param map
     * @param key
     * @return {{prevValue: *, nextValue: *}}
     */
    static findAdjacentValues(map, key) {
        const keys = Array.from(map.keys())
        const index = keys.indexOf(key)

        const prevKey = index > 0 ? keys[index - 1] : null
        const nextKey = index < keys.length - 1 ? keys[index + 1] : null

        const prevValue = prevKey ? map.get(prevKey) : null
        const nextValue = nextKey ? map.get(nextKey) : null

        return {prevValue, nextValue}
    }

    /**
     * Check if an element is inside its container
     *
     * @param element    React ref
     * @param container  React ref or window
     * @return {boolean}
     */
    static isOutOfContainer(element, container = window) {
        const elementRect = element.current.getBoundingClientRect()
        const containerRect =
                  container === window ? {
                          top:    0,
                          left:   0,
                          bottom: document.documentElement.clientHeight,
                          right:  document.documentElement.clientWidth,
                      }
                                       : container.current.getBoundingClientRect()

        // This is partially
        // return (
        //     elementRect.top < containerRect.top ||
        //     elementRect.left < containerRect.left ||
        //     elementRect.bottom > containerRect.bottom ||
        //     elementRect.right > containerRect.right
        // )

        return (
            elementRect.bottom < containerRect.top || // En dehors par le haut
            elementRect.top > containerRect.bottom || // En dehors par le bas
            elementRect.right < containerRect.left || // En dehors par la gauche
            elementRect.left > containerRect.right    // En dehors par la droite
        )
    }

    /**
     * Filters out methods from an object's own properties, returning a new object
     * containing only non-function properties (data attributes).
     *
     * @param {Object} obj - The object to filter, typically an instance of a class.
     * @returns {Object} A new object containing only the non-function own properties
     * of the input object.
     * @example
     * const obj = { id: 'poi1', type: 'standard', getId: () => 'poi1' };
     * filterAttributes(obj);
     * // Returns: { id: 'poi1', type: 'standard' }
     */
    static filterAttributes = obj => {
        const result = {}
        for (const key of Object.getOwnPropertyNames(obj)) {
            const value = obj[key]
            if (typeof value !== 'function') {
                result[key] = value
            }
        }
        return result
    }

    /**
     * Move the ContextMenu hook to the position of the event
     *
     * @param event cesium event (contains position={x,y})
     */
    static hooksContextMenu = (event) => {
        const contextMenuHook = document.getElementById(LGS_CONTEXT_MENU_HOOK)
        contextMenuHook.style.top = `${event.position.y}px`
        contextMenuHook.style.left = `${event.position.x}px`
    }

    /**
     * Checks whether the Web Share API is available and can share files if requested
     * @returns {boolean} True if sharing is supported (with or without files)
     */
    static canShare() {
        if (!navigator.share) {
            return false
        }

        if (navigator.canShare) {
            try {
                const testFile = new File(['test'], 'test.mp4', {type: 'video/mp4'})
                return navigator.canShare({files: [testFile]})
            }
            catch {
                return false
            }
        }

        return true
    }

    /**
     * Clamps a value between a min and max range.
     * @param {number} value - The value to clamp.
     * @param {number} min - Minimum allowed value.
     * @param {number} max - Maximum allowed value.
     * @returns {number} The clamped value.
     */
    static clamp = (value, min, max) => Math.max(min, Math.min(max, value))

    /**
     * Parses a string representing a pixel value and returns a rounded number.
     * Cleans non-numeric characters (except dot and sign), handles errors,
     * and applies precise rounding with floating-point error correction.
     *
     * @param {string|number} str - The input value (e.g., "12px", "-3.4rem", 15).
     * @param {number} [decimals=3] - Number of decimals for rounding.
     * @returns {number|null} The rounded number or null if invalid.
     */
    static parsePx = (str, decimals = 3) => {
        const num = parseFloat(String(str).replace(/[^\d.-]/g, ''))
        if (isNaN(num)) {
            return null
        }
        // Round with floating-point error compensation (Number.EPSILON)
        return Math.round((num + Number.EPSILON) * 10 ** decimals) / 10 ** decimals
    }
}
