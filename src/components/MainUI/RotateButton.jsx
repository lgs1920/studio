/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotateButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-26
 * Last modified: 2025-02-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faArrowRotateRight }          from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import React                           from 'react'
import { useSnapshot }                 from 'valtio'


export const RotateButton = (props) => {
    const proxy = lgs.mainProxy.components.mainUI
    const rotate = useSnapshot(proxy).rotate
    const camera = useSnapshot(lgs.mainProxy.components.camera)
    const pois = lgs.mainProxy.components.pois
    const snap = useSnapshot(pois)
    const handleRotation = async () => {
        if (rotate.running || !snap.current) {
            __.ui.cameraManager.stopRotate()
            pois.current = await __.ui.poiManager.stopAnimation(snap.current.id)
        }
        else {
            __.ui.sceneManager.focus(camera.target, {
                heading:    camera.position.heading,
                pitch:      camera.position.pitch,
                roll:       camera.position.roll,
                range:      5000,
                infinite:   true,
                rotate:     true,
                flyingTime: 0,    // no move, no time ! We're on target
            })
            pois.current = await __.ui.poiManager.startAnimation(snap.current.id)
        }
    }

    return (
        <>
            <SlTooltip hoist placement={props.tooltip}
                       content={rotate.running ? 'Stop Map Rotation' : 'Start Map Rotation'}>
                <SlButton size={'small'} className={'square-icon'} id={'launch-rotation'}
                          onClick={handleRotation} loading={rotate.running}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowRotateRight)}/>

                </SlButton>
            </SlTooltip>
        </>
    )
}
