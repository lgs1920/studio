import * as Cesium      from 'cesium'
import { EventEmitter } from '../assets/libs/EventEmitter/EventEmitter'
import { ChangelogManager } from '../core/ui/ChangelogManager'
import { FA2SL }        from './FA2SL'

export const CONFIGURATION ='/config.json'

export class AppUtils {
    /**
     * Slugification
     *
     * from https://gist.github.com/hagemann/382adfc57adbd5af078dc93feef01fe1
     *
     * @param {string} string
     */
    static  slugify = (string => {

        if (string === undefined || string === null) {
            return ''
        }
        const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìıİłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
        const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
        const p = new RegExp(a.split('').join('|'), 'g')

        return string.toString().toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with -
            .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
            .replace(/&/g, '-and-') // Replace & with 'and'
            .replace(/[^\w\-]+/g, '') // Remove all non-word characters
            .replace(/\-\-+/g, '-') // Replace multiple - with single -
            .replace(/^-+/, '') // Trim - from start of text
            .replace(/-+$/, '') // Trim - from end of text
    })

    static deepClone = ((obj, parent) => {
        if (obj === null) return null
        let clone = Object.assign({}, obj, parent)
        Object.keys(clone).forEach(
            key =>
                (clone[key] =
                    typeof obj[key] === 'object' ? AppUtils.deepClone(obj[key]) : obj[key]),
        )
        if (Array.isArray(obj)) {
            clone.length = obj.length
            return Array.from(clone)
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
        lgs.setDefaultConfiguration()

        // Backend  @vite
        lgs.BACKEND_API = `${import.meta.env.VITE_BACKEND_API}/`

         // Versions
         lgs.versions = await fetch(`${lgs.BACKEND_API}versions`)
             .then(res => res.json())
             .catch(error => console.error(error)
        )

        lgs.events = new EventEmitter()

        // Cesium ION auth
        Cesium.Ion.defaultAccessToken = lgs.configuration.ionToken

        // Register Font Awesome icons in ShoeLace
        FA2SL.useFontAwesomeInShoelace('fa')

        // Shoelace needs to avoid bubbling events. Here's an helper
        window.isOK = (event) => {
            return event.eventPhase === Event.AT_TARGET
        }

        // Update last visit
        lgs.settings.app.lastVisit = Date.now()

        // Read changelog
        const changeLog = new ChangelogManager()
        changeLog.list().then(files => {
            lgs.changelog={
                files:files,
                toRead:changeLog.whatsNew(files.list,lgs.settings.app.lastVisit)
            }
        })

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