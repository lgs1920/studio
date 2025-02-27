/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FloatingMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-27
 * Last modified: 2025-02-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import './style.css'
import { Track } from '@Core/Track'
import {
    faArrowTrendUp, faCalendarClock, faLocationDot, faMap, faMountains, faRulerHorizontal, faStopwatch,
}                from '@fortawesome/pro-regular-svg-icons'
import {
    SlCard,
}                from '@shoelace-style/shoelace/dist/react'
import {
    DAY, HOUR, SECOND,
}                from '@Utils/AppUtils'
import {
    POI_TYPE, TRACK_TYPE,
}                from '@Utils/cesium/EntitiesUtils'
import {
    FA2SL,
}                from '@Utils/FA2SL'
import {
    km, meter, mile, mph,
}                from '@Utils/UnitUtils'
import parse     from 'html-react-parser'
import {
    DateTime, Duration,
}                from 'luxon'
import {
    useLayoutEffect, useRef,
}                from 'react'
import {
    sprintf,
}                from 'sprintf-js'
import {
    useSnapshot,
}                from 'valtio'
import {
    NameValueUnit,
}                from '../DataDisplay/NameValueUnit'

export const FloatingMenu = function FloatingMenu() {

    const menuStore = lgs.mainProxy.components.floatingMenu
    const menuSnap = useSnapshot(menuStore)
    const element = useRef(null)

    let track = undefined, marker = undefined

    /**
     * Get information about Track and Marker (optional)
     */
    if (menuSnap.type === POI_TYPE || menuSnap.type === TRACK_TYPE) {
        let slug = menuSnap.target.track
        // fix for track where we send the object
        if (slug instanceof Track) {
            slug = menuSnap.target.track.slug
        }
        track = lgs.getJourneyBySlug(slug)
        lgs.theJourney = track
        if (menuSnap.type === POI_TYPE) {
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
    const offset = Number(__.ui.css.getCSSVariable('menu-offset'))
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
        return (<div className={'lgs-card'}>
            <div id={'floating-menu-coordinates'} className={'floating-menu-data'}>
                <div className={'floating-menu-title'}>
                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faLocationDot)}></sl-icon>
                    Position
                </div>
                <div className={'floating-menu-item'}>
                    <NameValueUnit value={sprintf('%\' 2.5f', menuSnap.longitude)}
                                   id={'cursor-longitude'}
                                   text={'Lon:'}
                                   units={'°'}/>
                    <NameValueUnit value={sprintf('%2.5f', menuSnap.latitude)}
                                   id={'cursor-latitude'}
                                   text={'Lat:'}
                                   units={'°'}/>
                </div>
            </div>
            <div className={'floating-menu-data'}>
                {menuSnap.type === POI_TYPE && track.hasAltitude &&
                    <div className={'floating-menu-item'}>
                        <div>
                            <NameValueUnit value={sprintf('%\' 6.2f', marker.altitude)}
                                           id={'cursor-altitude'}
                                           text={'Alt:'}
                                           units={[meter, mile]}/>
                        </div>
                    </div>
                }
            </div>
            {menuSnap.type === POI_TYPE && <MarkerPlus/>}
            {menuSnap.type === TRACK_TYPE && <TrackPlus/>}

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
            case POI_TYPE:
                name = marker?.name
                description = marker?.description
                break
            case TRACK_TYPE:
                name = track.title
                description = track.description
                break
        }
        return (<>
            {(menuSnap.type === POI_TYPE || menuSnap.type === TRACK_TYPE) && <>
                <div id="floating-menu-marker-header" className={'lgs-card'}>
                    <span className={'entity-title'}>{name}</span>
                    <div className={'entity-description'}>{parse(description)}</div>
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
                    <div className={'floating-menu-title'}>
                        <sl-icon variant="primary" library="fa" name={FA2SL.set(faCalendarClock)}></sl-icon>
                        Time
                    </div>
                    <div className={'floating-menu-data one-line'}>
                        <NameValueUnit value={date}
                                       id={'cursor-date'}/>
                        <NameValueUnit value={time}
                                       id={'cursor-time'}/>
                    </div>

                </>}
            </>

        )
    }

    const TrackPlus = () => {
        const metrics = track.metrics[0].global

        const duration = metrics.duration ? Duration.fromObject({seconds: metrics.duration}) : undefined
        const format = () => {
            let fmt = metrics.duration >= DAY / 1000
                      ? `dd \day} ` : ''
            fmt += metrics.duration >= HOUR / 1000 ? 'hh:' : ''
            fmt += 'mm'
            return fmt
        }

        return (<>
            {metrics && <>
                <div className={'floating-menu-title'}>
                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faMap)}></sl-icon>
                    Track
                </div>
                <div className={'floating-menu-data one-line'}>
                    <sl-icon variant="primary" library="fa" name={FA2SL.set(faRulerHorizontal)}></sl-icon>
                    <div>
                        <NameValueUnit value={metrics.distance} //TODO units KM or ...
                                       id={'cursor-distance'}
                                       units={[km, mph]}/>
                    </div>
                </div>
                {!isNaN(metrics.duration) &&
                    <div className={'floating-menu-data one-line'}>
                        <sl-icon variant="primary" library="fa" name={FA2SL.set(faStopwatch)}></sl-icon>
                        <div>
                            <NameValueUnit value={duration.toFormat(format())}
                                           id={'cursor-duration'}/>
                        </div>
                    </div>
                }

                {!isNaN(metrics.minHeight) && !isNaN(metrics.maxHeight) &&
                    <div className={'floating-menu-title'}>
                        <sl-icon variant="primary" library="fa" name={FA2SL.set(faMountains)}></sl-icon>
                        Altitude
                    </div>
                }

                {!isNaN(metrics.minHeight) &&
                    <div className={'floating-menu-data'}>
                        <div>
                            <NameValueUnit value={metrics.minHeight}
                                           text={'min.'}
                                           units={meter}
                            />
                        </div>
                    </div>
                }
                {!isNaN(metrics.maxHeight) &&
                    <div className={'floating-menu-data'}>
                        <div>
                            <NameValueUnit value={metrics.maxHeight}
                                           text={'max.'}
                                           units={meter}
                            />
                        </div>
                    </div>
                }

                {metrics.negativeElevation < 0 && metrics.positiveElevation > 0 &&
                    <div className={'floating-menu-title'}>
                        <sl-icon variant="primary" library="fa" name={FA2SL.set(faArrowTrendUp)}></sl-icon>
                        Elevation
                    </div>
                }
                {metrics.positiveElevation > 0 &&
                    <div className={'floating-menu-data'}>
                        <div>
                            <NameValueUnit value={sprintf('%\' .1f', metrics.positiveElevation)}
                                           text={'Gain'}
                                           units={meter}
                            />
                        </div>
                    </div>
                }
                {metrics.negativeElevation < 0 &&
                    <div className={'floating-menu-data'}>
                        <div>
                            <NameValueUnit value={sprintf('%\' .1f', metrics.negativeElevation)}
                                           text={'Loss'}
                                           units={meter}
                            />
                        </div>
                    </div>
                }

            </>}
        </>)

    }

    /**
     * Render the popup
     */
    return (

        <div id="floating-menu-container" key={menuSnap.key} ref={element}
             style={{top: menuSnap.coordinates.y, left: menuSnap.coordinates.x}}>

            {menuSnap.show &&
                <SlCard variant={'primary'}>
                    <div className={'lgs-card-wrapper'}>
                        <Header/>
                        <Coordinates/>
                    </div>
                </SlCard>}
        </div>
    )
}

