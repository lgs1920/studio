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

import { NameValueUnit }   from '@Components/DataDisplay/NameValueUnit'
import { SECOND }          from '@Core/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SlPopup }         from '@shoelace-style/shoelace/dist/react'
import { ELEVATION_UNITS } from '@Utils/UnitUtils'
import { useRef, useEffect } from 'react'
import Timeout             from 'smart-timeout'
import './style.css'
import { useSnapshot }     from 'valtio'

export const MapPOIContent = ({id, hide}) => {
    const inner = useRef(null)
    const point = lgs.mainProxy.components.pois.list.get(id)
    const snap = useSnapshot(point)

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

    useEffect(() => {

    }, [point])

    return (
        <>
            <div className="poi-on-map">
                <div
                    className="poi-on-map-inner"
                    ref={inner}
                    onContextMenu={handleContextMenu}
                    onPointerLeave={() => {
                        Timeout.set(
                            lgs.mainProxy.components.pois.context.timer,
                            hide,
                            1.5 * SECOND,
                        )
                    }}

                    onPointerDown={(event) => {
                        __.ui.sceneManager.propagateEventToCanvas(event)
                    }
                    }

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
                         distance={__.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter'))}>
                    <>
                    <FontAwesomeIcon icon={point.icon} className="poi-as-flag"/>
                    </>
                </SlPopup>
            }
        </>
    )
}