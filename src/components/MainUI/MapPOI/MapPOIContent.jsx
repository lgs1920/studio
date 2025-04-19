/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
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

import { NameValueUnit }                                  from '@Components/DataDisplay/NameValueUnit'
import { FontAwesomeIcon }                                                  from '@Components/FontAwesomeIcon'
import { DOUBLE_CLICK_DELAY, DOUBLE_TAP_DELAY, POIS_EDITOR_DRAWER, SECOND } from '@Core/constants'
import { SlPopup }                                                          from '@shoelace-style/shoelace/dist/react'
import { ELEVATION_UNITS }                   from '@Utils/UnitUtils'
import { memo, useEffect, useRef, useState } from 'react'
import Timeout                               from 'smart-timeout'
import './style.css'
import { useSnapshot }                                                      from 'valtio'

export const MapPOIContent = memo(({id, hide}) => {
    const inner = useRef(null)
    const point = lgs.mainProxy.components.pois.list.get(id)
    const snap = useSnapshot(point)
    const [clickTimeout, setClickTimeout] = useState(null)
    const [lastTap, setLastTap] = useState(0)

    const handleContextMenu = (event) => {
        event.preventDefault()

        // Visible if the camera is not in rotation
        // or when it is in rotation and
        //  - current = false (at the app launch or after a poi removal) or
        //  - we are on current point

        if (!__.ui.cameraManager.isRotating()
            || (__.ui.cameraManager.isRotating()
                &&
                (lgs.mainProxy.components.pois.current === false
                    || lgs.mainProxy.components.pois.current.id === point.id)
            )) {
            lgs.mainProxy.components.pois.context.visible = true
            lgs.mainProxy.components.pois.current = point
            __.ui.sceneManager.propagateEventToCanvas(event)
        }
    }


    const expand = () => {
        if (!point.expanded && !point.showFlag) {
            Object.assign(
                lgs.mainProxy.components.pois.list.get(point.id),
                {over: true},
            )
        }
    }

    const reduce = () => {
        Object.assign(
            lgs.mainProxy.components.pois.list.get(point.id),
            {over: false},
        )
    }
    /**
     * We open the POI Edit drawer and the current POI settings
     */
    const toggleEdit = () => {
        __.ui.drawerManager.toggle(POIS_EDITOR_DRAWER, 'edit-current')
    }

    const openEdit = () => {
        __.ui.drawerManager.open(POIS_EDITOR_DRAWER, 'edit-current')
    }

    /**
     * Trap pointer down.
     *
     * @param event
     */
    const handlePointerDown = (event) => {
        if (!clickTimeout) {
            const timeout = setTimeout(() => {
                setClickTimeout(null)
                // manage the simple click or tap (propagate it)
                __.ui.sceneManager.propagateEventToCanvas(event)
            }, DOUBLE_CLICK_DELAY)
            setClickTimeout(timeout)
        }
    }

    /**
     * Trap Double click
     *
     * @param event
     */
    const handleDoubleClick = (event) => {
        if (clickTimeout) {
            // We're in the delay, it is a double click
            clearTimeout(clickTimeout)
            setClickTimeout(null)
            if (snap.id === lgs.mainProxy.components.pois.current.id) {
                toggleEdit()
            }
            else {
                lgs.mainProxy.components.pois.current = snap
                openEdit()
            }
        }
    }

    const handleTouchStart = () => {
        const now = Date.now()
        if (now - lastTap < DOUBLE_TAP_DELAY) {
            if (clickTimeout) {
                // We're in the delay, it is a double touch
                clearTimeout(clickTimeout)
                setClickTimeout(null)
                if (snap.id === lgs.mainProxy.components.pois.current.id) {
                    toggleEdit()
                }
                else {
                    lgs.mainProxy.components.pois.current = snap
                    openEdit()
                }
            }
        }
        setLastTap(now)
    }

    useEffect(() => {
        console.log(point.id)
    }, [point])

    return (
        <>
            <div className="poi-on-map">
                <div className="poi-on-map-inner-background"/>
                <div className="poi-on-map-triangle-down"/>
                <div className="poi-on-map-inner"
                    ref={inner}
                    onContextMenu={handleContextMenu}
                    onPointerLeave={() => {
                        Timeout.set(
                            lgs.mainProxy.components.pois.context.timer,
                            hide,
                            1.5 * SECOND,
                        )
                    }}

                     onDoubleClick={handleDoubleClick}
                     onPointerDown={handlePointerDown}
                     onTouchStart={handleTouchStart}

                     id={`poi-inner-${point.id}`}
                >
                    {(point.expanded || (!point.expanded && point.over)) && !point.showFlag &&

                        <>

                            <h3> {point.title ?? 'Point Of Interest'}</h3>

                            {point.scale > 0.5 && (
                                <div className="poi-full-coordinates">
                                    {point.height && point.height !== point.simulatedHeight && (
                                        <NameValueUnit
                                            className="poi-elevation"
                                            text={'Altitude: '}
                                            value={snap.height.toFixed()}
                                            format={'%d'}
                                            units={ELEVATION_UNITS}
                                        />
                                    )}
                                    {!point.height || point.height === point.simulatedHeight && <span>&nbsp;</span>}
                                    <div className="poi-coordinates">
                                        <span>
                                          {__.convert(point.latitude).to(lgs.settings.coordinateSystem.current)},
                                            {' '}
                                            {__.convert(point.longitude).to(lgs.settings.coordinateSystem.current)}
                                        </span>

                                    </div>
                                </div>
                            )}
                        </>
                    }
                    {(point.showFlag || (!point.expanded && !point.over)) && (
                        <FontAwesomeIcon icon={point.icon} className="poi-as-flag"/>
                    )}
                </div>
                <div className="poi-on-map-marker"></div>
            </div>
            {(point.expanded || (!point.expanded && point.over)) && !point.showFlag &&
                <SlPopup className="poi-icons" placement="left-start" anchor={`poi-inner-${point.id}`} active="true"
                         distance={__.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-s'))}>
                    <FontAwesomeIcon icon={point.icon} className="poi-as-flag"/>
                </SlPopup>
            }
        </>
    )
})