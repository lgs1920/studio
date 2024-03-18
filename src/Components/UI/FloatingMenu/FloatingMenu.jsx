import './style.css'
import { faCalendar, faClock, faLocationDot, faMountains } from '@fortawesome/pro-regular-svg-icons'
import { SlCard }                                          from '@shoelace-style/shoelace/dist/react'
import { DateTime }                                        from 'luxon'
import { useLayoutEffect, useRef }                         from 'react'
import { sprintf }                                         from 'sprintf-js'
import { useSnapshot }                                     from 'valtio'
import { SECOND }                                          from '../../../Utils/AppUtils'
import { MARKER_TYPE, TRACK_TYPE }                         from '../../../Utils/cesium/EntitiesUtils'
import { FA2SL }                                           from '../../../Utils/FA2SL'
import { TextValueUI }                                     from '../TextValueUI/TextValueUI'

export const FloatingMenu = function FloatingMenu() {

    const menuStore = vt3d.mainProxy.components.floatingMenu
    const menuSnap = useSnapshot(menuStore)
    const element = useRef(null)

    let track = undefined, marker = undefined

    /**
     * Get information about Track and Marker (optional)
     */
    if (menuSnap.type === MARKER_TYPE || menuSnap.type === TRACK_TYPE) {
        track = vt3d.getTrackBySlug(menuSnap.target.track)
        if (menuSnap.type === MARKER_TYPE) {
            marker = track.markers.get(menuSnap.target.marker)
        }
    }

    /**
     * Reset timeout
     */
    let timeout
    const reset = () => {
        menuStore.show = false
        menuStore.key++
    }

    /**
     * Manage visibility
     *
     * WHen the pointer is ot on the menu, we wait x seconds then we remove it.
     * Else we stop the waiting nd the menu is shown until the pointer leaves
     */
    const visibility = () => {
        if (menuStore.show) {
            timeout = setTimeout(reset, menuStore.delay * SECOND)
            // 'on menu' event
            element.current.addEventListener('mouseover', event => {
                clearTimeout(timeout)
            })
            // 'out of menu' event
            element.current.addEventListener('mouseleave', event => {
                timeout = setTimeout(reset, menuStore.delay * SECOND)
            })
        }
    }

    /**
     * Fix coordinate to force the menu to stay in screen
     *
     * @type {number}
     */
    const offset = Number(_utils.ui.css.getCSSVariable('menu-offset'))
    const fixCoordinates = () => {
        if (element.current !== undefined) {
            const width  = element.current.offsetWidth,
                  height = element.current.offsetHeight

            // When right side of the box goes too far...
            if ((menuSnap.coordinates.x + width + offset) > document.documentElement.clientWidth) {
                menuStore.coordinates.x = document.documentElement.clientWidth - width - 2 * offset
            }
            // When bottom side of the box goes too far...
            if ((menuSnap.coordinates.y + height + offset) > document.documentElement.clientHeight) {
                menuStore.coordinates.y = document.documentElement.clientHeight - height - 2 * offset
            }
        }
    }

    /**
     * Once the popup has been rendered
     */
    useLayoutEffect(() => {
        fixCoordinates()
        visibility()
    }, [menuSnap])

    /**
     * Display longitude and latitude
     *
     * @return {JSX.Element}
     */
    const Coordinates = () => {
        return (<div className={'vt3d-card'}>
            <div id={'floating-menu-coordinates'} className={'floating-menu-data'}>
                <sl-icon variant="primary" library="fa" name={FA2SL.set(faLocationDot)}></sl-icon>
                <div>
                    <TextValueUI value={sprintf('%\' 2.5f', menuSnap.longitude)}
                                 id={'cursor-longitude'}
                                 text={'Lon:'}
                                 unit={'°'}/>
                    <TextValueUI value={sprintf('%2.5f', menuSnap.latitude)}
                                 id={'cursor-latitude'}
                                 text={'Lat:'}
                                 unit={'°'}/>
                </div>
            </div>
            <div className={'floating-menu-data'}>
                {menuSnap.type === MARKER_TYPE && track.hasAltitude &&
                    <>
                        <sl-icon variant="primary" library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                        <div>
                            <TextValueUI value={sprintf('%\' 6.2f', marker.altitude)}
                                         id={'cursor-altitude'}
                                         text={'Alt:'}
                                         unit={'m'}/>
                        </div>
                    </>
                }
            </div>
            {menuSnap.type === MARKER_TYPE && <MarkerPlus/>}

        </div>)
    }

    /**
     * Display popup header if we hav name or description
     *
     * @return {JSX.Element}
     * @constructor
     */
    const Header = () => {
        let name, description
        switch (menuSnap.type) {
            case MARKER_TYPE:
                name = marker?.name
                description = marker?.description
                break
            case TRACK_TYPE:
                name = track.name
                description = track.description
                break
        }
        return (<>
            {(menuSnap.type === MARKER_TYPE || menuSnap.type === TRACK_TYPE) && <>
                <div id="floating-menu-marker-header" className={'vt3d-card'}>
                    <span className={'entity-title'}>{name}</span>
                    <div className={'entity-description'}>{description}</div>
                </div>
            </>}
        </>)
    }

    /**
     * Add additional informatio for the marker
     *
     * @return {JSX.Element}
     * @constructor
     */
    const MarkerPlus = () => {

        let time, date
        if (track.hasTime && marker.time) {
            time = DateTime.fromISO(marker.time).toLocaleString(DateTime.TIME_SIMPLE)
            date = DateTime.fromISO(marker.time).toLocaleString(DateTime.DATE_MED)
        }
        return (<>
                {track.hasTime && marker.time && <>
                    <div className={'floating-menu-data add-top-space'}>
                        <sl-icon variant="primary" library="fa" name={FA2SL.set(faCalendar)}></sl-icon>
                        <div>
                            <TextValueUI value={date}
                                         id={'cursor-date'}/>
                        </div>
                    </div>
                    <div className={'floating-menu-data'}>
                        <sl-icon variant="primary" library="fa" name={FA2SL.set(faClock)}></sl-icon>
                        <div>
                            <TextValueUI value={time}
                                         id={'cursor-time'}/>
                        </div>
                    </div>
                </>}
            </>

        )
    }

    /**
     * Render the popup
     */
    return (

        <div id="floating-menu-container" key={menuSnap.key} ref={element}
             style={{top: menuSnap.coordinates.y, left: menuSnap.coordinates.x}}>

            {menuSnap.show &&
                <SlCard variant={'primary'}>
                    <div className={'vt3d-card-wrapper'}>
                        <Header/>
                        <Coordinates/>
                    </div>
                </SlCard>}
        </div>
    )
}

