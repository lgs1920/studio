import './style.css'
import { faCalendar, faClock, faLocationDot, faMountains } from '@fortawesome/pro-regular-svg-icons'
import { SlCard }                                          from '@shoelace-style/shoelace/dist/react'
import { DateTime }                                        from 'luxon'
import { forwardRef, useEffect }                           from 'react'
import { sprintf }                                         from 'sprintf-js'
import { useSnapshot }                                     from 'valtio'
import { SECOND }                                          from '../../../Utils/AppUtils'
import { MARKER_TYPE, TRACK_TYPE }                         from '../../../Utils/cesium/EntitiesUtils'
import { FA2SL }                                           from '../../../Utils/FA2SL'
import { TextValueUI }                                     from '../TextValueUI/TextValueUI'

export const FloatingMenu = forwardRef(function FloatingMenu(props, ref) {

    const menuStore = vt3d.mainProxy.components.floatingMenu
    const menuSnap = useSnapshot(menuStore)

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
            vt3d.floatingMenu.element.addEventListener('mouseover', event => {
                clearTimeout(timeout)
            })
            // 'out of menu' event
            vt3d.floatingMenu.element.addEventListener('mouseleave', event => {
                timeout = setTimeout(reset, menuStore.delay * SECOND)
            })
        }
    }


    useEffect(() => {
        vt3d.floatingMenu.element = document.getElementById('floating-menu-container')
        visibility()
    }, [menuSnap.key])

    /**
     * Display longitude and latitude
     *
     * @return {JSX.Element}
     */
    const Coordinates = () => {
        return (<>
            <div id={'floating-menu-coordinates'} className={'floating-menu-data vt3d-card'}>
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
                {menuSnap === MARKER_TYPE && <div className={'floating-menu-data'}>
                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                    <div>
                        <TextValueUI value={sprintf('%\' 6.2f', marker.altitude)}
                                     id={'cursor-altitude'}
                                     text={'Alt:'}
                                     unit={'m'}/>
                    </div>
                </div>}
            </div>
            {menuSnap.type === MARKER_TYPE && <MarkerPlus/>}

        </>)
    }
    const Header = () => {
        let name, description
        switch (menuSnap.type) {
            case MARKER_TYPE:
                name = marker.name
                description = marker.description
                break
            case TRACK_TYPE:
                name = track.name
                description = track.description
                break
        }
        return (<>
            {(menuSnap.type === MARKER_TYPE || menuSnap === TRACK_TYPE) && <>
                <div id="floating-menu-marker-header" className={'vt3d-card'}>
                    <span className={'entity-title'}>{name}</span>
                    <div className={'entity-description'}>{description}</div>
                </div>
            </>}
        </>)
    }

    const MarkerPlus = () => {

        const time = DateTime.fromISO(marker.time).toLocaleString(DateTime.TIME_SIMPLE)
        const date = DateTime.fromISO(marker.time).toLocaleString(DateTime.DATE_MED)
        return (<>
                {marker.time && <>
                    <div className={'vt3d-card'}>
                        <div className={'floating-menu-data'}>
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
                    </div>
                </>}
            </>

        )
    }
    return (

        <div id="floating-menu-container" key={menuSnap.key}
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
})

