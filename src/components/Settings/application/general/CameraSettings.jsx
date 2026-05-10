/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { FOCUS_CENTROID, FOCUS_LAST, FOCUS_STARTER, SCENE_MODE_3D } from '@Core/constants'
import { WaDivider, WaIcon, WaRadio, WaRadioGroup, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useRef } from 'react'
import { useSnapshot }                                        from 'valtio/index'

/**
 * CameraSettings component.
 * Manages camera display options and focus behaviors.
 * @param {Object} props - Component properties.
 */
export const CameraSettings = () => {
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

    const updateCameraBoolean = useCallback((key, value) => {
        lgs.settings.ui.camera[key] = value
    }, [])

    const updateCameraStart = useCallback((key, value) => {
        lgs.settings.ui.camera.start[key] = value
    }, [])

    const updateCameraStartRotate = useCallback((key, value) => {
        lgs.settings.ui.camera.start.rotate[key] = value
    }, [])

    const updateTargetMarker = useCallback((event) => {
        const isChecked = event.target.checked
        lgs.settings.ui.camera.targetIcon.show = isChecked
        if (!isChecked && _targetPosition.current?.checked) {
            _targetPosition.current.click()
        }
    }, [])

    const updatePoiRotate = useCallback((event) => {
        lgs.settings.ui.poi.rotate = event.target.checked
    }, [])

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
                            <WaSwitch size="xs" label-at-start checked={camera.showPosition}
                                      onChange={(event) => updateCameraBoolean('showPosition', event.target.checked)}>
                                {' Show Position '}
                                <span slot="hint">{' Longitude, Latitude, Altitude '}</span>
                            </WaSwitch>
                            <WaDivider orientation="vertical"/>
                            <WaSwitch size="xs" label-at-start checked={camera.showHPR}
                                      onChange={(event) => updateCameraBoolean('showHPR', event.target.checked)}>
                                {' Show HPR '}
                                <span slot="hint">{' Head, Pitch, Roll '}</span>
                            </WaSwitch>
                        </div>
                    </>
                }

                <div className="drawer-horizontal-line align-to-top">
                    <WaSwitch size="xs" label-at-start checked={camera.targetIcon.show}
                              onChange={updateTargetMarker}>
                        {' Show Target Marker '}
                        <span slot="hint">
                            {' Marked with '}
                            <WaIcon name="arrows-to-circle" variant="regular"/>
                        </span>
                    </WaSwitch>
                    <WaDivider orientation="vertical"/>
                    <WaSwitch size="xs" label-at-start checked={camera.showTargetPosition} ref={_targetPosition}
                              onChange={(event) => updateCameraBoolean('showTargetPosition', event.target.checked)}>
                        {' Show Target Position '}
                        <span slot="hint">
                            {' Marked with '}
                            <WaIcon name="arrows-to-circle" variant="regular"/>
                        </span>
                    </WaSwitch>
                </div>
                <WaDivider/>
                <div className="drawer-horizontal-line align-to-top">
                    <WaSwitch size="xs" label-at-start checked={camera.showMovementWidget ?? true}
                              onChange={(event) => updateCameraBoolean('showMovementWidget', event.target.checked)}>
                        {' Camera Info '}
                        <span slot="hint">{' Angle and altitude while moving the camera '}</span>
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
                                  size={'xs'}
                                  onChange={(event) => updateCameraStart('app', event.target.value)}
                    >
                        <label slot="label">{' Start focus: '}</label>
                        <WaRadio value={FOCUS_STARTER}>{' Starter POI '}</WaRadio>
                        <WaRadio value={FOCUS_LAST}>{' Last Camera Location '}</WaRadio>
                        <WaRadio value={FOCUS_CENTROID}>{' Last Journey '}</WaRadio>
                    </WaRadioGroup>

                    <WaRadioGroup value={camera.start.journey}
                                  size={'xs'}
                                  onChange={(event) => updateCameraStart('journey', event.target.value)}>
                        <label slot="label">{' Journey focus: '}</label>
                        <WaRadio value={FOCUS_CENTROID}>{' Center '}</WaRadio>
                        <WaRadio value={FOCUS_LAST}>{' Last Camera Location '}</WaRadio>
                    </WaRadioGroup>
                </div>
                <WaDivider/>
                <div className="drawer-horizontal-line two-columns">
                    <WaSwitch size="xs" label-at-start checked={camera.start.rotate.app}
                              onChange={(event) => updateCameraStartRotate('app', event.target.checked)}>
                        {' Rotation after initial focus '}
                    </WaSwitch>
                </div>

                <WaDivider/>
                <div>
                    <WaSwitch size="xs" label-at-start checked={poi.rotate}
                              onChange={updatePoiRotate}>
                        {' Rotation after focusing on a POI '}
                    </WaSwitch>
                    <br/>
                    <WaSwitch size="xs" label-at-start checked={camera.start.rotate.journey}
                              onChange={(event) => updateCameraStartRotate('journey', event.target.checked)}>
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
