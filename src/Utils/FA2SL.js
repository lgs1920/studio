import {findIconDefinition, icon, library} from '@fortawesome/fontawesome-svg-core'
import {registerIconLibrary}               from '@shoelace-style/shoelace'

/**
 * This class is used to insert font awesome icons (version 6.5 and higher) into Shoelace web components.
 *
 * Font Awesome : https://fontawesome.com
 * Shoelace     : https://shoelace.style
 *
 * Usage:
 *
 *  // for pro icons,you need to have a pro account
 *  // Icons installation here : https://fontawesome.com/docs/web/setup/packages
 *
 *
 *  import {faCircleInfo}               from '@fortawesome/pro-regular-svg-icons'
 *  import {faGithub}                                                       from '@fortawesome/free-brands-svg-icons'
 *
 *  import {SlIcon}                     from '@shoelace-style/shoelace/dist/react'
 *
 *  import {FA2SL}                      from '../FA2SL'
 *  FA2SL.useFontAwesomeInShoelace('fa')  // This should be done once in your app.
 *
 *  return (
 *      <>
 *           <sl-icon library="fa" name={FA2SL.set(faCircleInfo)}></sl-icon>
 *           <SlIconButton library="fa" name={FA2SL.set(faGithub)} target={'_blank'} href={'<any URL>'}/>
 *      </>
 *  )
 *
 *
 *
 * @author : christian Denat (christian.denat@orange.fr)
 * @version : 1.0
 */
export class FA2SL {
    /**
     * This method register a Font Awesome Family (or an array of family)
     * in Shoelace
     *
     * (see https://shoelace.style/components/icon#icon-libraries)
     *
     * @param {Array|String} families
     * @type {function(*): void}
     */
    static useFontAwesomeInShoelace = ((families) => {
        // Maybe we need to convert to array
        if (typeof families === 'string') {
            families = [families]
        }

        families.forEach((family) => {
            /**
             * @param {string} family : the icon family (fab,fas,fass,fad ...)
             */
            registerIconLibrary(family, {
                /**
                 * Resolver
                 *
                 * @param name {string}     <family>-<icon-name>
                 * @return {string}         Encoded IconURL
                 */
                resolver: name => {
                    // extract prefix and iconName from name
                    // name is
                    const dashIndex = name.indexOf('-')
                    const prefix = name.slice(0, dashIndex)
                    const iconName = name.slice(dashIndex + 1)
                    // Find the right icon in the icon library
                    const faIcon = findIconDefinition({prefix: prefix, iconName: iconName})
                    // And return it as encoded URL
                    return `data:image/svg+xml,${encodeURIComponent(icon(faIcon).html)}`
                },
                /**
                 * Mutator
                 *
                 * @param svg
                 */
                mutator: svg => {
                    svg.setAttribute('fill', 'currentColor')
                    svg.setAttribute('part', 'svg')
                },
            })
        })

    })

    /**
     * Set full icon name and preregister the icon
     *
     * When we import an icon:
     *
     * import {faGithub}       from '@fortawesome/free-brands-svg-icons'
     * import {faCircleInfo}   from '@fortawesome/pro-regular-svg-icons'
     *
     * the imported entity  (faGithub or faCircleInfo )is based on iconDefinition type.
     * (see https://fontawesome.com/docs/apis/javascript/methods#findicondefinition-params)
     *
     * To be used with Shoelace, we need to preregister this icon into the current Font Awesome library.
     * (see https://fontawesome.com/docs/apis/javascript/methods#library-add-icondefinitions)
     *
     * @param {IconDefinition} iconDefinition Icon structure
     * @return {string}        name on the form of <prefix>-<iconName>
     *
     */
    static set = (iconDefinition) => {
        // preregistering
        library.add(iconDefinition)
        // set iconname from the icon data
        return `${iconDefinition.prefix}-${iconDefinition.iconName}`
    }
}