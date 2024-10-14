import axios                                        from 'axios'
import * as Cesium                                  from 'cesium'
import { EventEmitter }                             from '../assets/libs/EventEmitter/EventEmitter'
import { ElevationServer }                          from '../core/Elevation/ElevationServer'
import { BUILD, CONFIGURATION, platforms, SERVERS } from '../core/LGS1920Context'
import { Settings }                                 from '../core/settings/Settings'
import { SettingsSection }                          from '../core/settings/SettingsSection'
import { APP_SETTINGS_SECTION }                     from '../core/stores/settings/app'
import { ChangelogManager }                         from '../core/ui/ChangelogManager'
import { FA2SL }                                    from './FA2SL'


export class AppUtils {
    /**
     * Slugification
     *
     * from https://gist.github.com/hagemann/382adfc57adbd5af078dc93feef01fe1
     *
     * @param {string} string
     */
    static  slugify = string => {
        if (string === undefined || string === null) {
            return ''
        }

        const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìıİłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;#'
        const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
        const p = new RegExp(a.split('').join('|'), 'g')

        // # is a special character
        const chunks = string.split('#')

        const slug = chunks.map(string=> string.toString().toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
            .replace(/&/g, '-and-') // Replace & with 'and'
            .replace(/[^\w-]+/g, '') // Remove all non-word characters
            .replace(/--+/g, '-') // Replace multiple - with single -
            .replace(/^-+/, '') // Trim - from start of text
            .replace(/-+$/, '') // Trim - from end of text)
        )

        return slug.join('#')
    }

    /**
     * Split a slug using '#'
     *
     * @return {array}
     */
    static splitSlug = (slug =>  slug.split(`#`))


    static deepClone = ((obj, parent = null, map = new Map()) => {
        if (obj === null) return null
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

    static MapToObject = map => Object.fromEntries(map.entries())

    static setTheme = (theme = null) => {
        if (!theme) {
            theme = lgs.configuration.theme
        }
        document.documentElement.classList.add(`sl-theme-${theme}`)
    }

    /**
     * Capitalize  string
     *
     * @param string {string}
     * @return {string}
     */
    static  capitalize = (string) => {
        return string[0].toUpperCase() + string.slice(1)
    }

    /**
     * CamelCase a string ( aaa-bbb => aaaBbb)
     *
     * @param string {string}
     * @return {string}
     */
    static camelCase = (string) => {
        return string
            .split('-')
            .map((s, index) => {
                return ((index === 0 ? s[0].toLowerCase() : s[0].toUpperCase()) + s.slice(1).toLowerCase())
            })
            .join('')
    }

    /**
     * LGS1920Context initialisation
     *
     * @return {Promise<void>}
     */
    static init = async () => {
        // Set Context
        lgs.configuration =  await fetch(CONFIGURATION).then(
            res => res.json()
        )
        lgs.servers=await fetch(SERVERS).then(
            res => res.json()
        )

        lgs.build = await fetch(BUILD).then(
            res => res.json(),
        )

        lgs.platform = lgs.servers.platform

        lgs.createDB()

        lgs.setDefaultConfiguration()

        // Register Font Awesome icons in ShoeLace
        FA2SL.useFontAwesomeInShoelace('fa')

        // Backend
        lgs.BACKEND_API= `${lgs.servers.studio.proxy}${lgs.servers.backend.protocol}://${lgs.servers.backend.domain}:${lgs.servers.backend.port}`

        // Create an Axios instance
        lgs.axios = axios.create();

        /***************************************
         * Application settings
         */
        lgs.settings = new Settings()

        // Add settings sections
        lgs.settings.add(new SettingsSection(APP_SETTINGS_SECTION))

        // Ping server
        const server = await __.app.pingBackend()

        if (server.alive) {

            try {
                // Versions
                try {
                    const response = await lgs.axios.get([lgs.BACKEND_API,'versions'].join('/'));
                    lgs.versions = response.data;
                } catch (error) {
                    console.error(error);
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
                error:  new Error(`${lgs.configuration.applicationName} Backend server seems to be unreachable!${info}`),
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
        } catch(error) {
            console.error(error)
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
                    console.log(response)
                    return response.data
                })
                .catch(function (error) {
                    console.error(error)
                    return {alive: false}
                })
        }
        return  {alive: false}
    }

    /**
     * Build a URL from protocol and domain
     *
     * @param protocol{string}
     * @param domain {string}
     *
     * @return {string}
     */
    static buildUrl = ({protocol='https', domain}) => {
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
        } else {
            content= __.app.slugify(content)
        }

        const start =  (prefix.length > 0) ?`${__.app.slugify(prefix)}#`:``
        const end =  (suffix.length > 0) ?`#${__.app.slugify(suffix)}`:``

        //
        return `${start}${(content.length > 0) ?content:``}${end}`
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

}

/** Time ans duration constants in seconds */
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
