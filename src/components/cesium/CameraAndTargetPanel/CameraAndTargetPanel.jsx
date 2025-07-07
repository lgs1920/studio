/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraAndTargetPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-04
 * Last modified: 2025-07-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import './style.css'
import { NameValueUnit } from '@Components/DataDisplay/NameValueUnit.jsx'
import { APP_EVENT }         from '@Core/constants'
import { faAngle, faArrowsToCircle, faMountains, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import { meter, mile }       from '@Utils/UnitUtils'
import { useEffect, useRef } from 'react'
import { useSnapshot }       from 'valtio'

/**
 * Renders a panel with camera or target data, including an icon and animation.
 * @param {Object} props - Component props
 * @param {Object} props.icon - FontAwesome icon for the panel
 * @param {React.ReactNode} props.children - Content to display inside the panel
 * @param {boolean} props.play - Whether to play the animation
 * @param {Function} props.onDoubleClick - Handler for double-click event
 * @returns {JSX.Element} Animated panel with icon and data
 */
const CameraDataPanel = ({icon, children, play, onDoubleClick}) => (
    <SlAnimation size="small" easing="bounceInLeft" duration={1000} iterations={1} play={play}>
        <div className="camera-data-panel lgs-card on-map" onDoubleClick={onDoubleClick}>
            <sl-icon library="fa" name={FA2SL.set(icon)}/>
            <div>{children}</div>
        </div>
    </SlAnimation>
)

/**
 * Displays a panel with camera and target position data, including coordinates,
 * altitude, and HPR (heading, pitch, roll) when applicable.
 * Supports double-click to close the toolbar.
 * @returns {JSX.Element} Camera and target position panel
 */
export const CameraAndTargetPanel = () => {
    // Snapshots for reactive state from Valtio
    const camera = useSnapshot(lgs.mainProxy.components.camera)
    const $ui = lgs.settings.ui
    const ui = useSnapshot($ui)
    const panelRef = useRef(null)

    // Handle panel visibility on WELCOME.HIDE event
    useEffect(() => {
        const showPanel = () => {
            if (panelRef.current?.style) {
                panelRef.current.style.opacity = 1
            }
        }
        window.addEventListener(APP_EVENT.WELCOME.HIDE, showPanel)
        return () => window.removeEventListener(APP_EVENT.WELCOME.HIDE, showPanel)
    }, [])

    return (
        <div
            id="camera-and-target-position-panel"
            ref={panelRef}
            style={{opacity: 0}} // Initial opacity set to 0, updated on WELCOME.HIDE
        >
            {/* Target position panel */}
            {ui.camera.showTargetPosition && !__.ui.cameraManager.lookingAtTheSky(camera.target) && (
                <CameraDataPanel
                    icon={faArrowsToCircle}
                    play={ui.camera.showTargetPosition}
                    onDoubleClick={() => ($ui.camera.showTargetPosition = false)}
                >
                    {camera.target?.latitude && camera.target?.longitude ? (
                        <>
                            {__.convert(camera.target.latitude).to(lgs.settings.coordinateSystem.current)},{' '}
                            {__.convert(camera.target.longitude).to(lgs.settings.coordinateSystem.current)}
                            <sl-icon library="fa" name={FA2SL.set(faMountains)}/>
                            <NameValueUnit
                                value={camera.target.height?.toFixed()}
                                className="camera-altitude"
                                units={[meter, mile]}
                            />
                            {__.ui.sceneManager.is2D && (
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faVideo)}/>
                                    <NameValueUnit
                                        value={camera.position?.height?.toFixed()}
                                        className="camera-altitude"
                                        units={[meter, mile]}
                                    />
                                </>
                            )}
                        </>
                    ) : (
                         'Target data unavailable'
                     )}
                </CameraDataPanel>
            )}

            {/* Camera position and HPR panels (3D mode only) */}
            {!__.ui.sceneManager.is2D && (
                <>
                    {ui.camera.showPosition && camera.position && (
                        <CameraDataPanel
                            icon={faVideo}
                            play={ui.camera.showPosition}
                            onDoubleClick={() => ($ui.camera.showPosition = false)}
                        >
                            {camera.position.latitude && camera.position.longitude ? (
                                <>
                                    {__.convert(camera.position.latitude).to(lgs.settings.coordinateSystem.current)},{' '}
                                    {__.convert(camera.position.longitude).to(lgs.settings.coordinateSystem.current)}
                                    <sl-icon library="fa" name={FA2SL.set(faMountains)}/>
                                    <NameValueUnit
                                        value={camera.position.height?.toFixed()}
                                        className="camera-altitude"
                                        units={[meter, mile]}
                                    />
                                </>
                            ) : (
                                 'Position data unavailable'
                             )}
                        </CameraDataPanel>
                    )}

                    {ui.camera.showHPR && camera.position && (
                        <CameraDataPanel
                            icon={faAngle}
                            play={ui.camera.showHPR}
                            onDoubleClick={() => ($ui.camera.showHPR = false)}
                        >
                            <NameValueUnit
                                value={camera.position.heading?.toFixed()}
                                className="camera-heading"
                                text="Heading:"
                                units="°"
                            />
                            <NameValueUnit
                                value={camera.position.pitch?.toFixed()}
                                className="camera-pitch"
                                text="Pitch:"
                                units="°"
                            />
                            <NameValueUnit
                                value={camera.position.roll?.toFixed()}
                                className="camera-roll"
                                text="Roll:"
                                units="°"
                            />
                        </CameraDataPanel>
                    )}
                </>
            )}
        </div>
    )
}