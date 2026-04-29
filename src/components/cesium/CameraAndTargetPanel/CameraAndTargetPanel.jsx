/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraAndTargetPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './style.css'
import { NameValueUnit } from '@Components/DataDisplay/NameValueUnit.jsx'
import { Widget }      from '@Components/MainUI/widgets/Widget'
import {
    CAMERA_INFORMATION_WIDGET, LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD,
}                      from '@Core/constants'
import { faAngle, faArrowsToCircle, faMountains, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { FA2SL }       from '@Utils/FA2SL'
import { foot, meter } from '@Utils/UnitUtils'
import { useMemo }     from 'react'
import { useSnapshot } from 'valtio'

/**
 * Renders one camera information line with the icon used by the previous banners.
 * @param {Object} props - Component props
 * @param {Object} props.icon - FontAwesome icon for the line
 * @param {React.ReactNode} props.children - Content to display inside the line
 * @param {Function} props.onDoubleClick - Handler for double-click event
 * @returns {JSX.Element} Camera information line
 */
const CameraDataLine = ({icon, children, onDoubleClick}) => (
    <div className="camera-information-line" onDoubleClick={onDoubleClick}>
        <sl-icon library="fa" name={FA2SL.set(icon)}/>
        <div className="camera-information-values">{children}</div>
    </div>
)

const valueOf = value => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsedValue = Number(value)
        return Number.isFinite(parsedValue) ? parsedValue : null
    }
    return null
}
const coordinateOf = value => {
    const numericValue = valueOf(value)
    return numericValue === null ? null : __.convert(numericValue).to(lgs.settings.coordinateSystem.current)
}

/**
 * Displays camera and target information in a single draggable, non-resizable top-centered widget.
 * @returns {JSX.Element|null} Camera information widget
 */
export const CameraAndTargetPanel = () => {
    const camera = useSnapshot(lgs.stores.main.components.camera)
    const $ui = lgs.settings.ui
    const ui = useSnapshot($ui)
    const is2D = __.ui.sceneManager.is2D

    const config = useMemo(() => {
        return {
            attachTo:        'top',
            contextMenu:     {
                canRemove: true,
            },
            draggable:       true,
            dynamic:         true,
            group:           SCENE_WIDGETS,
            id:              CAMERA_INFORMATION_WIDGET,
            left:            '50%',
            margin:          lgs.gutter.s,
            persist:         false,
            resizable:       false,
            rotatable:       false,
            scalable:        false,
            showControlBox:  false,
            snappable:       false,
            stopPropagation: true,
            top:             '0px',
            type:            LGS_WIDGET,
            widgetsBoard:    SCENE_WIDGETS_BOARD,
            zIndex:          12000,
        }
    }, [])

    const targetLatitude = coordinateOf(camera.target?.latitude)
    const targetLongitude = coordinateOf(camera.target?.longitude)
    const targetHeight = valueOf(camera.target?.height)
    const positionLatitude = coordinateOf(camera.position?.latitude)
    const positionLongitude = coordinateOf(camera.position?.longitude)
    const positionHeight = valueOf(camera.position?.height)
    const heading = valueOf(camera.position?.heading)
    const pitch = valueOf(camera.position?.pitch)
    const roll = valueOf(camera.position?.roll)

    const hasSelectedInformation = ui.camera.showPosition || ui.camera.showHPR || ui.camera.showTargetPosition
    const showTargetPosition = ui.camera.showTargetPosition && !__.ui.cameraManager.lookingAtTheSky(camera.target)
    const showCameraPosition = !is2D && ui.camera.showPosition && camera.position
    const showCameraHPR = !is2D && ui.camera.showHPR && camera.position
    const hasRenderableInformation = showTargetPosition || showCameraPosition || showCameraHPR

    if (!hasSelectedInformation || !hasRenderableInformation) {
        return null
    }

    return (
        <Widget isVisible={true} config={config} className="camera-information-widget-shell">
            <div id="camera-information-widget" className="camera-information-panel lgs-card wa-theme-lgs1920-on-map">
                {showTargetPosition && (
                    <CameraDataLine
                        icon={faArrowsToCircle}
                        onDoubleClick={() => ($ui.camera.showTargetPosition = false)}
                    >
                        <>
                            {targetLatitude !== null && targetLongitude !== null && (
                                <>
                                    {targetLatitude},{' '}
                                    {targetLongitude}
                                </>
                            )}
                            {targetHeight !== null && (
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faMountains)}/>
                                    <NameValueUnit
                                        value={targetHeight}
                                        className="camera-altitude"
                                        units={[meter, foot]}
                                        precision={0}
                                    />
                                </>
                            )}
                            {is2D && positionHeight !== null && (
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faVideo)}/>
                                    <NameValueUnit
                                        value={positionHeight}
                                        className="camera-altitude"
                                        units={[meter, foot]}
                                        precision={0}
                                    />
                                </>
                            )}
                        </>
                    </CameraDataLine>
                )}

                {showCameraPosition && (
                    <CameraDataLine
                        icon={faVideo}
                        onDoubleClick={() => ($ui.camera.showPosition = false)}
                    >
                        <>
                            {positionLatitude !== null && positionLongitude !== null && (
                                <>
                                    {positionLatitude},{' '}
                                    {positionLongitude}
                                </>
                            )}
                            {positionHeight !== null && (
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faMountains)}/>
                                    <NameValueUnit
                                        value={positionHeight}
                                        className="camera-altitude"
                                        units={[meter, foot]}
                                        precision={0}
                                    />
                                </>
                            )}
                        </>
                    </CameraDataLine>
                )}

                {showCameraHPR && (
                    <CameraDataLine
                        icon={faAngle}
                        onDoubleClick={() => ($ui.camera.showHPR = false)}
                    >
                        <>
                            {heading !== null && (
                                <NameValueUnit
                                    value={heading}
                                    className="camera-heading"
                                    text="Heading:"
                                    units="°"
                                    precision={0}
                                />
                            )}
                            {pitch !== null && (
                                <NameValueUnit
                                    value={pitch}
                                    className="camera-pitch"
                                    text="Pitch:"
                                    units="°"
                                    precision={0}
                                />
                            )}
                            {roll !== null && (
                                <NameValueUnit
                                    value={roll}
                                    className="camera-roll"
                                    text="Roll:"
                                    units="°"
                                    precision={0}
                                />
                            )}
                        </>
                    </CameraDataLine>
                )}
            </div>
        </Widget>
    )
}
