/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotationWidget.jsx
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

import {
    getOrbitDirectionLabel,
    ORBIT_DIRECTION_MAX,
    ORBIT_DIRECTION_MIN,
    ORBIT_DIRECTION_STEP,
    ORBIT_RPM_MAX,
    ORBIT_RPM_MIN,
    ORBIT_RPM_STEP,
    persistOrbitSettings,
}                                   from '@Core/OrbitSettings'
import { OrbitInteractionHintsWidget } from '@Components/MainUI/OrbitInteractionHintsWidget'
import { Widget }                     from '@Components/MainUI/widgets/Widget'
import { WaButton, WaCard, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot }              from 'valtio'
import { getOrbitWidgetConfig }       from './orbitWidgetConfig'

export const RotationWidget = memo(() => {
    const $rotate = lgs.stores.ui.mainUI.rotate
    const rotate = useSnapshot($rotate)
    const panorama = useSnapshot(lgs.stores.ui.mainUI.panorama)
    const {toolBar} = useSnapshot(lgs.settings.ui.menu)
    const config = useMemo(() => getOrbitWidgetConfig('rotation-widget', toolBar.fromStart), [toolBar.fromStart])

    const stopPropagation = useCallback((event) => {
        event.stopPropagation()
    }, [])

    const stopRotation = useCallback((event) => {
        event?.stopPropagation?.()
        void __.ui.poiManager.stopRotationAndSync()
    }, [])

    const updateRPM = useCallback((event) => {
        const value = Number(event.target.value)
        $rotate.rpm = value
    }, [$rotate])

    const persistRPM = useCallback((event) => {
        const value = Number(event.target.value)
        void persistOrbitSettings(rotate.target, 'rotation', {rpm: value})
    }, [$rotate, rotate.target])

    const updateDirection = useCallback((event) => {
        const value = Number(event.target.value)
        $rotate.direction = value
    }, [$rotate])

    const persistDirection = useCallback((event) => {
        const value = Number(event.target.value)
        void persistOrbitSettings(rotate.target, 'rotation', {direction: value})
    }, [$rotate, rotate.target])

    return (
        <div className="orbit-mode-widgets">
            <OrbitInteractionHintsWidget/>
            <Widget
                isVisible={rotate.running && !panorama.active}
                config={config}
                className="orbit-widget-shell"
            >
                <WaCard
                    appearance="plain"
                    className="orbit-widget rotation-widget lgs-card wa-theme-lgs1920-on-map"
                    onWheel={stopPropagation}
                >
                    <div className="orbit-widget-header">
                        <div className="panorama-widget-title">
                            <WaIcon className="grabber orbit-widget-grabber" name="grip-dots" variant="solid"/>
                            <WaIcon name="arrows-rotate" animation="spin" variant="regular"/>
                            <span>{'Rotation'}</span>
                        </div>
                        <WaButton appearance="plain" size="small" onClick={stopRotation}>
                            <WaIcon name="xmark" variant="regular"/>
                        </WaButton>
                    </div>

                    <div className="panorama-widget-body">
                        <div className="panorama-widget-slider">
                            <span>{'RPM'}</span>
                            <input
                                className="panorama-widget-range"
                                type="range"
                                min={ORBIT_RPM_MIN}
                                max={ORBIT_RPM_MAX}
                                step={ORBIT_RPM_STEP}
                                value={rotate.rpm}
                                onInput={updateRPM}
                                onChange={persistRPM}
                            />
                            <strong>{rotate.rpm.toFixed(1)}</strong>
                        </div>

                        <div className="panorama-widget-slider">
                            <span>{'Sense'}</span>
                            <input
                                className="panorama-widget-range"
                                type="range"
                                min={ORBIT_DIRECTION_MIN}
                                max={ORBIT_DIRECTION_MAX}
                                step={ORBIT_DIRECTION_STEP}
                                value={rotate.direction}
                                onInput={updateDirection}
                                onChange={persistDirection}
                            />
                            <strong>{getOrbitDirectionLabel(rotate.direction)}</strong>
                        </div>
                    </div>

                    <WaButton appearance="outlined" size="small" onClick={stopRotation}>
                        <WaIcon slot="start" name="arrows-rotate" animation="spin" variant="regular"/>
                        {'Stop'}
                    </WaButton>
                </WaCard>
            </Widget>
        </div>
    )
})
