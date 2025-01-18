import {
    BUILD, CONFIGURATION, FREE_ANONYMOUS_ACCESS, MILLIS, platforms, SERVERS, SETTINGS, SETTINGS_STORE, VAULT_STORE,
}                           from '@Core/constants'
import { ElevationServer }  from '@Core/Elevation/ElevationServer'
import { Settings }         from '@Core/settings/Settings'
import { SettingsSection }  from '@Core/settings/SettingsSection'
import { ChangelogManager } from '@Core/ui/ChangelogManager'
import axios                from 'axios'
import * as Cesium          from 'cesium'
import YAML                 from 'yaml'
import { EventEmitter }     from '../assets/libs/EventEmitter/EventEmitter'
import { FA2SL }            from './FA2SL'

export class AppUtils {
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

    static setTheme = (theme = null) => {
        if (!theme) {
            theme = lgs.settings.theme
        }
        document.documentElement.classList.add(`sl-theme-${theme}`)
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
     * CamelCase a string ( aaa-bbb => aaaBbb, aaa-bbbCcc => aaaBbbCcc)
     *
     * @param string {string}
     * @return {string}
     */
    static camelCase = (string) => {
        return string
            .split('-')
            .map((s, index) => {
                if (index === 0) {
                    return s[0].toLowerCase() + s.slice(1)
                }
                else {
                    return s[0].toUpperCase() + s.slice(1)
                }
            })
            .join('')
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
        const settings = await fetch(SETTINGS, {cache: 'no-store'})
            .then(res => res.text())
            .then(text => YAML.parse(text),
            )

        // Get the setting sections ID
        lgs.settingSections = Object.keys(settings)

        lgs.configuration = {...appConfig, ...settings}
        lgs.savedConfiguration = {...appConfig, ...settings}

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
        FA2SL.useFontAwesomeInShoelace('fa')

        // Backend
        lgs.BACKEND_API = `${lgs.servers.studio.proxy}${lgs.servers.backend.protocol}://${lgs.servers.backend.domain}:${lgs.servers.backend.port}`

        // Create an Axios instance
        lgs.axios = axios.create()

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
                Cesium.Ion.defaultAccessToken = lgs.configuration.ionToken


                // Shoelace needs to avoid bubbling events. Here's an helper
                window.isOK = (event) => {
                    return event.eventPhase === Event.AT_TARGET
                }

                // Update last visit
                lgs.settings.app.lastVisit = Date.now()

                // Read changelog
                const changeLog = new ChangelogManager()
                changeLog.list().then(files => {
                    lgs.changelog = {
                        files:  files,
                        toRead: changeLog.whatsNew(files.list, lgs.settings.app.lastVisit),
                    }
                })

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
                                 method: 'get',
                                 url:    `start-backend.php`,
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

        // Array could be an array, let's join it into a single string
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


}
