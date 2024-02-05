//import { registerIconLibrary } from '@shoelace-style';
import { library, icon } from '@fortawesome/fontawesome-svg-core'


export class AppUtils {
    static setTheme = (theme=null) => {
        if (!theme) {
            theme = window.vt3DContext.configuration.theme
        }
        document.documentElement.classList.add(`sl-theme-${theme}`);
    }

    /**
     * Capitalize  string
     *
     * @param string {string}
     * @return {string}
     */
    static  capitalize= (string) =>{
        return string[0].toUpperCase() + string.slice(1)
    }

    /**
     * CamelCase a string ( aaa-bbb => aaaBbb)
     *
     * @param string {string}
     * @return {string}
     */
    static camelCase =(string) =>{
        return string
            .split('-')
            .map((s, index) => {
                return (
                    (index === 0 ? s[0].toLowerCase() : s[0].toUpperCase()) +
                    s.slice(1).toLowerCase()
                )
            })
            .join('')
    }
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

export {SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, YEAR}


// registerIconLibrary('fa', {
//     resolver: name => {
//         const filename = name.replace(/^fa[rbs]-/, '');
//         let folder = 'regular';
//         if (name.substring(0, 4) === 'fas-') folder = 'solid';
//         if (name.substring(0, 4) === 'fab-') folder = 'brands';
//         return `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.15.1/svgs/${folder}/${filename}.svg`;
//     },
//     mutator: svg => svg.setAttribute('fill', 'currentColor')
// });