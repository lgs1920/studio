/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotateButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-19
 * Last modified: 2025-05-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { NONE, POI_STANDARD_TYPE } from '@Core/constants'
import { MapPOI }                  from '@Core/MapPOI'
import { POI }    from '@Core/POI'
import { faArrowRotateRight }          from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import React                           from 'react'
import { useSnapshot }                 from 'valtio'


export const RotateButton = (props) => {
    const $mainUI = lgs.stores.main.components.mainUI
    const rotate = useSnapshot($mainUI).rotate
    const camera = useSnapshot(lgs.mainProxy.components.camera)
    const $pois = lgs.mainProxy.components.pois
    const pois = useSnapshot($pois)

    const DUMMY_TARGET = 'target'

    const handleRotation = async () => {
        if (rotate.running) {
            await __.ui.cameraManager.stopRotate()
            if (__.ui.sceneManager.target?.element === POI_STANDARD_TYPE) {
                // Object.assign(__.ui.sceneManager.target,{animated:false})
                Object.assign($pois.list.get(pois.current), {animated: false})
            }
        }
        else {
            __.ui.sceneManager.focus(camera.target, {
                heading:    camera.position.heading,
                pitch:      camera.position.pitch,
                roll:       camera.position.roll,
                range: camera.position.range,
                infinite:   true,
                rotate:     true,
                flyingTime: 0,    // no move, no time ! We're on target
                target: DUMMY_TARGET
                ,
            })
            if (__.ui.sceneManager.target?.element === POI_STANDARD_TYPE) {
                Object.assign($pois.list.get(pois.current), {animated: true})
            }
        }
    }

    return (
        <>
            <SlTooltip hoist placement={props.tooltip}
                       content={rotate.running ? 'Stop Map Rotation' : 'Start Map Rotation'}>
                <SlButton size={'small'} className={'square-button'} id={'launch-rotation'}
                          onClick={handleRotation} loading={rotate.running}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowRotateRight)}/>

                </SlButton>
            </SlTooltip>
        </>
    )
}
