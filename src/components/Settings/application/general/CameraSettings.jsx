/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-14
 * Last modified: 2026-03-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { FOCUS_CENTROID, FOCUS_LAST, FOCUS_STARTER, SCENE_MODE_3D } from '@Core/constants'
import { faArrowsToCircle, faVideo }                          from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon }                                    from '@fortawesome/react-fontawesome'
import { FA2SL }                                              from '@Utils/FA2SL'
import { WaDivider, WaIcon, WaRadio, WaRadioGroup, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useRef }                                      from 'react'
import { useSnapshot }                                        from 'valtio/index'

/**
 * CameraSettings component.
 * Manages camera display options and focus behaviors.
 * @param {Object} props - Component properties.
 */
export const CameraSettings = (props) => {
    // Valtio Proxies
    const $camera = lgs.settings.ui.camera
    const $poi = lgs.settings.ui.poi
    const $sceneMode = lgs.settings.scene.mode

    // Snapshots
    const camera = useSnapshot($camera)
    const poi = useSnapshot($poi)
    const sceneMode = useSnapshot($sceneMode)

    // Ref naming convention: starts with _ and no Ref suffix
    const _targetPosition = useRef(null)

    /**
     * Renders information toggles.
     * Used as a function to maintain DOM structure without re-mounting components.
     */
    const renderTabInfo = () => {
        return (
            <>
                {sceneMode.value * 1 === SCENE_MODE_3D.value &&
                    <>
                        <div className="drawer-horizontal-line align-to-top">
                            <WaSwitch size="xsmall" label-at-start checked={camera.showPosition}
                                      onChange={(event) => $camera.showPosition = event.target.checked}>
                                {' Show Position '}
                                <span slot="hint">{' Longitude, Latitude, Altitude '}</span>
                            </WaSwitch>

                            <WaSwitch size="xsmall" label-at-start checked={camera.showHPR}
                                      onChange={(event) => $camera.showHPR = event.target.checked}>
                                {' Show HPR '}
                                <span slot="hint">{' Head, Pitch, Roll '}</span>
                            </WaSwitch>
                        </div>
                        <WaDivider/>
                    </>
                }

                <div className="drawer-horizontal-line align-to-top">
                    <WaSwitch size="xsmall" label-at-start checked={camera.targetIcon.show}
                              onChange={(event) => {
                                  const isChecked = event.target.checked
                                  $camera.targetIcon.show = isChecked
                                  if (!isChecked && _targetPosition.current?.checked) {
                                      _targetPosition.current.click()
                                  }
                              }}>
                        {' Show Target Marker '}
                        <span slot="hint">
                            {' Marked with '}
                            <WaIcon name="arrows-to-circle" variant="regular"/>
                        </span>
                    </WaSwitch>

                    <WaSwitch size="xsmall" label-at-start checked={camera.showTargetPosition} ref={_targetPosition}
                              onChange={(event) => $camera.showTargetPosition = event.target.checked}>
                        {' Show Target Position '}
                        <span slot="hint">
                            {' Marked with '}
                            <WaIcon name="arrows-to-circle" variant="regular"/>
                        </span>
                    </WaSwitch>
                </div>
                <WaDivider/>
            </>
        )
    }

    /**
     * Renders position and rotation controls.
     */
    const renderTabPosition = () => {
        return (
            <>
                <div className="drawer-horizontal-line two-columns align-to-top">
                    <WaRadioGroup value={camera.start.app}
                                  size={'xsmall'}
                                  onChange={(event) => $camera.start.app = event.target.value}
                    >
                        <label slot="label">{' Start focus: '}</label>
                        <WaRadio value={FOCUS_STARTER}>{' Starter POI '}</WaRadio>
                        <WaRadio value={FOCUS_LAST}>{' Last Camera Location '}</WaRadio>
                        <WaRadio value={FOCUS_CENTROID}>{' Last Journey '}</WaRadio>
                    </WaRadioGroup>

                    <WaRadioGroup value={camera.start.journey}
                                  size={'xsmall'}
                                  onChange={(event) => $camera.start.journey = event.target.value}>
                        <label slot="label">{' Journey focus: '}</label>
                        <WaRadio value={FOCUS_CENTROID}>{' Center '}</WaRadio>
                        <WaRadio value={FOCUS_LAST}>{' Last Camera Location '}</WaRadio>
                    </WaRadioGroup>
                </div>
                <WaDivider/>
                <div className="drawer-horizontal-line two-columns">
                    <WaSwitch size="xsmall" label-at-start checked={camera.start.rotate.app}
                              onChange={(event) => $camera.start.rotate.app = event.target.checked}>
                        {' Rotation after initial focus '}
                    </WaSwitch>
                </div>

                <WaDivider/>
                <div>
                    <WaSwitch size="xsmall" label-at-start checked={poi.rotate}
                              onChange={(event) => $poi.rotate = event.target.checked}>
                        {' Rotation after focusing on a POI '}
                    </WaSwitch>
                    <br/>
                    <WaSwitch size="xsmall" label-at-start checked={camera.start.rotate.journey}
                              onChange={(event) => $camera.start.rotate.journey = event.target.checked}>
                        {' Rotation after focusing on a journey '}
                    </WaSwitch>
                </div>
            </>
        )
    }

    return (
        <>
            <span slot="summary">
                <WaIcon name="video" variant="regular"/>
                {' Camera Settings '}
            </span>
            <WaDivider/>
            {renderTabInfo()}
            {renderTabPosition()}
        </>
    )
}