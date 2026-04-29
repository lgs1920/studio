/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanoramaWidget.jsx
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

import { CURRENT_POI, MILLIS }                  from '@Core/constants'
import {
    getOrbitDirectionLabel,
    ORBIT_DIRECTION_MAX,
    ORBIT_DIRECTION_MIN,
    ORBIT_DIRECTION_STEP,
    ORBIT_RPM_MAX,
    ORBIT_RPM_MIN,
    ORBIT_RPM_STEP,
    persistOrbitSettings,
}                                               from '@Core/OrbitSettings'
import { Widget }                                        from '@Components/MainUI/widgets/Widget'
import { Cartesian3, Math as M }                from 'cesium'
import { WaButton, WaCard, WaIcon }             from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                          from 'valtio'
import { getOrbitWidgetConfig }                          from './orbitWidgetConfig'

export const PanoramaWidget = memo(() => {
    const $panorama = lgs.stores.ui.mainUI.panorama
    const panorama = useSnapshot($panorama)
    const {toolBar} = useSnapshot(lgs.settings.ui.menu)
    const animationRef = useRef(null)
    const lastFrameRef = useRef(null)
    const headingRef = useRef(0)
    const heightOffsetRef = useRef(panorama.heightOffset)
    const pitchRef = useRef(panorama.pitch)
    const rpmRef = useRef(panorama.rpm)
    const directionRef = useRef(panorama.direction)
    const controllerStateRef = useRef(null)
    const config = useMemo(() => getOrbitWidgetConfig('panorama-widget', toolBar.fromStart), [toolBar.fromStart])

    heightOffsetRef.current = panorama.heightOffset
    pitchRef.current = panorama.pitch
    rpmRef.current = panorama.rpm
    directionRef.current = panorama.direction

    const stopPropagation = useCallback((event) => {
        event.stopPropagation()
    }, [])

    const setPoiAnimated = useCallback(async (animated) => {
        if (panorama.target?.element !== CURRENT_POI) {
            return
        }

        const poiId = panorama.target.slug ?? panorama.target.id
        if (!poiId) {
            return
        }

        const poi = lgs.stores.main.components.pois.list.get(poiId)
        if (poi?.animated !== animated) {
            await __.ui.poiManager.updatePOI(poiId, {animated})
        }
    }, [panorama.target])

    const persistPanoramaSettings = useCallback((updates = {}) => {
        void persistOrbitSettings(panorama.target, 'panorama', updates)
    }, [panorama.target])

    const closePanorama = useCallback((event) => {
        event?.stopPropagation?.()
        $panorama.active = false
        $panorama.target = false
    }, [$panorama])

    const updateHeight = useCallback((event) => {
        const value = Number(event.target.value)
        $panorama.heightOffset = value
    }, [$panorama])

    const persistHeight = useCallback((event) => {
        const value = Number(event.target.value)
        persistPanoramaSettings({heightOffset: value})
    }, [persistPanoramaSettings])

    const updatePitch = useCallback((event) => {
        const value = Number(event.target.value)
        $panorama.pitch = value
    }, [$panorama])

    const persistPitch = useCallback((event) => {
        const value = Number(event.target.value)
        persistPanoramaSettings({pitch: value})
    }, [persistPanoramaSettings])

    const updateRPM = useCallback((event) => {
        const value = Number(event.target.value)
        $panorama.rpm = value
    }, [$panorama])

    const persistRPM = useCallback((event) => {
        const value = Number(event.target.value)
        persistPanoramaSettings({rpm: value})
    }, [persistPanoramaSettings])

    const updateDirection = useCallback((event) => {
        const value = Number(event.target.value)
        $panorama.direction = value
    }, [$panorama])

    const persistDirection = useCallback((event) => {
        const value = Number(event.target.value)
        persistPanoramaSettings({direction: value})
    }, [persistPanoramaSettings])

    useEffect(() => {
        if (!panorama.active || !panorama.target) {
            return
        }

        const target = panorama.target
        if (!Number.isFinite(target.longitude) || !Number.isFinite(target.latitude)) {
            return
        }

        __.ui.cameraManager.optimizeContinuousCameraRender()

        const controller = lgs.scene?.screenSpaceCameraController
        if (controller) {
            controllerStateRef.current = {
                enableInputs:    controller.enableInputs,
                enableLook:      controller.enableLook,
                enableRotate:    controller.enableRotate,
                enableTilt:      controller.enableTilt,
                enableTranslate: controller.enableTranslate,
                enableZoom:      controller.enableZoom,
            }

            controller.enableInputs = false
            controller.enableLook = false
            controller.enableRotate = false
            controller.enableTilt = false
            controller.enableTranslate = false
            controller.enableZoom = false
        }

        headingRef.current = Number.isFinite(panorama.heading)
                             ? panorama.heading
                             : M.toDegrees(lgs.camera.heading ?? 0)
        lastFrameRef.current = null

        const renderFrame = () => {
            const baseHeight = target.simulatedHeight ?? target.height ?? 0
            lgs.camera.setView({
                                   destination: Cartesian3.fromDegrees(target.longitude, target.latitude, baseHeight + heightOffsetRef.current),
                                   orientation: {
                                       heading: M.toRadians(headingRef.current),
                                       pitch:   M.toRadians(pitchRef.current),
                                       roll:    0,
                                   },
                               })
        }

        const tick = (timestamp) => {
            if (!$panorama.active) {
                return
            }

            if (lastFrameRef.current === null) {
                lastFrameRef.current = timestamp
            }

            const elapsedSeconds = (timestamp - lastFrameRef.current) / MILLIS
            lastFrameRef.current = timestamp
            headingRef.current = (headingRef.current + rpmRef.current * directionRef.current * 6 * elapsedSeconds) % 360
            renderFrame()
            animationRef.current = window.requestAnimationFrame(tick)
        }

        void setPoiAnimated(true)

        lgs.camera.flyTo({
                             destination: Cartesian3.fromDegrees(
                                 target.longitude,
                                 target.latitude,
                                 (target.simulatedHeight ?? target.height ?? 0) + heightOffsetRef.current,
                             ),
                             orientation: {
                                 heading: M.toRadians(headingRef.current),
                                 pitch:   M.toRadians(pitchRef.current),
                                 roll:    0,
                             },
                             duration:    0.8,
                             complete:    () => {
                                 if (!$panorama.active) {
                                     return
                                 }
                                 renderFrame()
                                 animationRef.current = window.requestAnimationFrame(tick)
                             },
                         })

        return () => {
            if (animationRef.current) {
                window.cancelAnimationFrame(animationRef.current)
                animationRef.current = null
            }

            const nextController = lgs.scene?.screenSpaceCameraController
            if (nextController && controllerStateRef.current) {
                Object.assign(nextController, controllerStateRef.current)
            }
            controllerStateRef.current = null
            __.ui.cameraManager.restoreContinuousCameraRender()
            void __.ui.cameraManager.raiseUpdateEvent()
            void setPoiAnimated(false)
        }
    }, [panorama.active, panorama.target, panorama.heading, $panorama, setPoiAnimated])

    return (
        <Widget
            isVisible={panorama.active}
            config={config}
            className="orbit-widget-shell"
        >
            <WaCard
                appearance="plain"
                className="orbit-widget panorama-widget lgs-card wa-theme-lgs1920-on-map"
                onWheel={stopPropagation}
            >
                <div className="orbit-widget-header">
                    <div className="panorama-widget-title">
                        <WaIcon className="grabber orbit-widget-grabber" name="grip-dots" variant="solid"/>
                        <WaIcon name="arrows-rotate" animation="spin" variant="regular"/>
                        <span>{'Panorama'}</span>
                    </div>
                    <WaButton appearance="plain" size="small" onClick={closePanorama}>
                        <WaIcon name="xmark" variant="regular"/>
                    </WaButton>
                </div>

                <div className="panorama-widget-body">
                    <div className="panorama-widget-slider">
                        <span>{'Height'}</span>
                        <input
                            className="panorama-widget-range"
                            type="range"
                            min="100"
                            max="5000"
                            step="50"
                            value={panorama.heightOffset}
                            onInput={updateHeight}
                            onChange={persistHeight}
                        />
                        <strong>{`${Math.round(panorama.heightOffset)} m`}</strong>
                    </div>

                    <div className="panorama-widget-slider">
                        <span>{'Angle'}</span>
                        <input
                            className="panorama-widget-range"
                            type="range"
                            min="-85"
                            max="15"
                            step="1"
                            value={panorama.pitch}
                            onInput={updatePitch}
                            onChange={persistPitch}
                        />
                        <strong>{`${Math.round(panorama.pitch)}°`}</strong>
                    </div>

                    <div className="panorama-widget-slider">
                        <span>{'RPM'}</span>
                        <input
                            className="panorama-widget-range"
                            type="range"
                            min={ORBIT_RPM_MIN}
                            max={ORBIT_RPM_MAX}
                            step={ORBIT_RPM_STEP}
                            value={panorama.rpm}
                            onInput={updateRPM}
                            onChange={persistRPM}
                        />
                        <strong>{panorama.rpm.toFixed(1)}</strong>
                    </div>

                    <div className="panorama-widget-slider">
                        <span>{'Sense'}</span>
                        <input
                            className="panorama-widget-range"
                            type="range"
                            min={ORBIT_DIRECTION_MIN}
                            max={ORBIT_DIRECTION_MAX}
                            step={ORBIT_DIRECTION_STEP}
                            value={panorama.direction}
                            onInput={updateDirection}
                            onChange={persistDirection}
                        />
                        <strong>{getOrbitDirectionLabel(panorama.direction)}</strong>
                    </div>
                </div>

                <WaButton appearance="outlined" size="small" onClick={closePanorama}>
                    <WaIcon slot="start" name="arrows-rotate" animation="spin" variant="regular"/>
                    {'Stop'}
                </WaButton>
            </WaCard>
        </Widget>
    )
})
