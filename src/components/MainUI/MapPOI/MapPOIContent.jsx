/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 *
 * File: MapPOIContent.jsx
 * Path: /home/christian/devs/assets/lgs1920/studio/src/components/MainUI/MapPOI/MapPOIContent.jsx
 *
 * Author : Christian Denat
 * email: christian.denat@orange.fr
 *
 * Created on: 2025-02-23
 * Last modified: 2025-02-23
 *
 *
 * Copyright © 2025 LGS1920
 *
 ******************************************************************************/

import { TextValueUI }     from '@Components/TextValueUI/TextValueUI'
import { SECOND }          from '@Core/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SlPopup }         from '@shoelace-style/shoelace/dist/react'
import { UIUtils }         from '@Utils/UIUtils'
import { ELEVATION_UNITS } from '@Utils/UnitUtils'
import { useRef }          from 'react'
import Timeout             from 'smart-timeout'
import './style.css'

export const MapPOIContent = ({point, hide}) => {
    const inner = useRef(null)

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
                    id={`poi-inner-${point.id}`}
                >
                    {(point.expanded || (!point.expanded && point.over)) && !point.showFlag &&

                        <>
                            <h3> {point.title ?? 'Point Of Interest'}</h3>
                            {point.scale > 0.6 && (
                                <div className="poi-full-coordinates">
                                    {!point.simulatedHeight && (
                                        <TextValueUI
                                            className="poi-elevation"
                                            text={'Altitude: '}
                                            value={point.height}
                                            format={'%d'}
                                            units={ELEVATION_UNITS}
                                        />
                                    )}
                                    {point.simulatedHeight && <span>&nbsp;</span>}
                                    <div className="poi-coordinates">
                                        <span>
                                            {UIUtils.toDMS(point.latitude)},{' '}
                                            {UIUtils.toDMS(point.longitude)}
                                        </span>
                                        <br/>
                                        <span>
                                            [{sprintf('%.5f , %.5f', point.latitude, point.longitude)}]
                                        </span>
                                        <br/>

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
                    <FontAwesomeIcon icon={point.icon} className="poi-as-flag"/>
                </SlPopup>
            }
        </>
    )
}