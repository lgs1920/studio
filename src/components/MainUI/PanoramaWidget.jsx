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

import { CURRENT_POI, LGS_WIDGET, MILLIS, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import {
    getOrbitDirectionLabel,
    ORBIT_DIRECTION_MAX,
    ORBIT_DIRECTION_MIN,
    ORBIT_DIRECTION_STEP,
    ORBIT_RPM_MAX,
    ORBIT_RPM_MIN,
    ORBIT_RPM_STEP,
    PANORAMA_HEIGHT_OFFSET_MAX,
    PANORAMA_HEIGHT_OFFSET_MIN,
    PANORAMA_HEIGHT_OFFSET_STEP,
    PANORAMA_PITCH_MAX,
    PANORAMA_PITCH_MIN,
    PANORAMA_PITCH_STEP,
    persistOrbitSettings,
    normalizePanoramaHeightOffset,
    normalizePanoramaPitch,
}                                               from '@Core/OrbitSettings'
import { Widget }                                        from '@Components/MainUI/widgets/Widget'
import {
    OrbitInteractionHintsWidget,
}                                                                              from '@Components/MainUI/OrbitInteractionHintsWidget'
import { faAngle, faMountains }                                                from '@fortawesome/pro-regular-svg-icons'
import { FA2SL }                                                               from '@Utils/FA2SL'
import { foot, meter, UnitUtils }                                              from '@Utils/UnitUtils'
import { Cartesian3, Math as M }                from 'cesium'
import { WaButton, WaCard, WaIcon }             from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState }             from 'react'
import { useSnapshot }                          from 'valtio'
import { getOrbitWidgetConfig }                          from './orbitWidgetConfig'

const POINTER_PITCH_DEGREES_PER_PIXEL = 0.25
const POINTER_HEIGHT_METERS_PER_PIXEL = 10
const WHEEL_HEIGHT_METERS_PER_PIXEL = 1
const INTERACTION_PERSIST_DELAY = 400
const ADJUSTMENT_OVERLAY_DELAY = 2000
const PANORAMA_ADJUSTMENT_WIDGET = 'panorama-adjustment-widget'

const hasFinePointer = () => typeof window !== 'undefined' && (window.matchMedia?.('(any-pointer: fine)').matches ?? false)
const wheelDeltaModeFactor = event => event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
const numericValueOf = value => {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : 0
}
const panoramaBaseHeightOf = target => numericValueOf(target?.simulatedHeight ?? target?.height ?? 0)
const panoramaCameraAltitudeOf = (target, heightOffset) => panoramaBaseHeightOf(target) + numericValueOf(heightOffset)
const formatPanoramaCameraAltitude = (target, heightOffset) => {
    return UnitUtils.formatMetric(panoramaCameraAltitudeOf(target, heightOffset), {
        units:     [meter, foot],
        precision: 0,
    }).full
}
const formatCameraAltitude = height => UnitUtils.formatMetric(numericValueOf(height), {
    units:     [meter, foot],
    precision: 0,
}).full
const formatPanoramaPitch = pitch => `${Math.round(numericValueOf(pitch))}°`

export const PanoramaWidget = memo(() => {
    const $panorama = lgs.stores.ui.mainUI.panorama
    const panorama = useSnapshot($panorama)
    const rotate = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const camera = useSnapshot(lgs.stores.main.components.camera)
    const cameraSettings = useSnapshot(lgs.settings.ui.camera)
    const {toolBar} = useSnapshot(lgs.settings.ui.menu)
    useSnapshot(lgs.settings.unitSystem)
    const [finePointer, setFinePointer] = useState(hasFinePointer)
    const animationRef = useRef(null)
    const lastFrameRef = useRef(null)
    const headingRef = useRef(0)
    const heightOffsetRef = useRef(panorama.heightOffset)
    const pitchRef = useRef(panorama.pitch)
    const rpmRef = useRef(panorama.rpm)
    const directionRef = useRef(panorama.direction)
    const controllerStateRef = useRef(null)
    const interactionPersistTimerRef = useRef(null)
    const adjustmentOverlayTimerRef = useRef(null)
    const [adjustmentVisible, setAdjustmentVisible] = useState(false)
    const [adjustmentValues, setAdjustmentValues] = useState(() => ({
        height: formatPanoramaCameraAltitude(panorama.target, panorama.heightOffset),
        pitch:  formatPanoramaPitch(panorama.pitch),
    }))
    const showCameraMovementWidget = cameraSettings.showMovementWidget ?? true
    const standardCameraKeyRef = useRef(null)
    const config = useMemo(() => getOrbitWidgetConfig('panorama-widget', toolBar.fromStart), [toolBar.fromStart])
    const adjustmentConfig = useMemo(() => ({
        attachTo:        'center',
        contextMenu:     {
            canRemove: false,
        },
        draggable:       true,
        dynamic:         true,
        group:           SCENE_WIDGETS,
        id:              PANORAMA_ADJUSTMENT_WIDGET,
        left:            '50%',
        margin:          0,
        opacity:         1,
        persist:         true,
        resizable:       false,
        rotatable:       false,
        scalable:        false,
        snappable:       true,
        stopPropagation: true,
        top:             '60%',
        transient:       true,
        type:            LGS_WIDGET,
        widgetsBoard:    SCENE_WIDGETS_BOARD,
        zIndex:          11950,
    }), [])

    heightOffsetRef.current = normalizePanoramaHeightOffset(panorama.heightOffset)
    pitchRef.current = normalizePanoramaPitch(panorama.pitch)
    rpmRef.current = panorama.rpm
    directionRef.current = panorama.direction

    useEffect(() => {
        const mediaQuery = window.matchMedia?.('(any-pointer: fine)')
        if (!mediaQuery) {
            return
        }

        const updatePointerMode = () => setFinePointer(mediaQuery.matches)
        updatePointerMode()
        mediaQuery.addEventListener('change', updatePointerMode)

        return () => mediaQuery.removeEventListener('change', updatePointerMode)
    }, [])

    useEffect(() => {
        if (!panorama.active) {
            return
        }

        const heightOffset = normalizePanoramaHeightOffset(panorama.heightOffset)
        const pitch = normalizePanoramaPitch(panorama.pitch)

        if (heightOffset !== panorama.heightOffset) {
            $panorama.heightOffset = heightOffset
        }
        if (pitch !== panorama.pitch) {
            $panorama.pitch = pitch
        }
    }, [$panorama, panorama.active, panorama.heightOffset, panorama.pitch])

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

    const hideAdjustmentOverlay = useCallback(() => {
        setAdjustmentVisible(false)
        if (lgs.stores.ui.widget.current?.id === PANORAMA_ADJUSTMENT_WIDGET) {
            lgs.stores.ui.widget.current = {id: null}
        }
    }, [])

    const showAdjustmentValues = useCallback((values) => {
        setAdjustmentValues(values)
        setAdjustmentVisible(true)

        if (adjustmentOverlayTimerRef.current) {
            window.clearTimeout(adjustmentOverlayTimerRef.current)
        }

        adjustmentOverlayTimerRef.current = window.setTimeout(() => {
            hideAdjustmentOverlay()
            adjustmentOverlayTimerRef.current = null
        }, ADJUSTMENT_OVERLAY_DELAY)
    }, [hideAdjustmentOverlay])

    const showAdjustmentOverlay = useCallback((heightOffset, pitch) => {
        showAdjustmentValues({
                                 height: formatPanoramaCameraAltitude(panorama.target, heightOffset),
                                 pitch:  formatPanoramaPitch(pitch),
                             })
    }, [panorama.target, showAdjustmentValues])

    const showCameraAdjustmentOverlay = useCallback((position) => {
        showAdjustmentValues({
                                 height: formatCameraAltitude(position?.height),
                                 pitch:  formatPanoramaPitch(position?.pitch),
                             })
    }, [showAdjustmentValues])

    const schedulePersistPanoramaSettings = useCallback((updates = {}) => {
        if (interactionPersistTimerRef.current) {
            window.clearTimeout(interactionPersistTimerRef.current)
        }

        interactionPersistTimerRef.current = window.setTimeout(() => {
            interactionPersistTimerRef.current = null
            persistPanoramaSettings(updates)
        }, INTERACTION_PERSIST_DELAY)
    }, [persistPanoramaSettings])

    const setPanoramaHeightOffset = useCallback((value, persist = false) => {
        const heightOffset = normalizePanoramaHeightOffset(value, heightOffsetRef.current)
        if (heightOffset === heightOffsetRef.current) {
            return
        }

        heightOffsetRef.current = heightOffset
        $panorama.heightOffset = heightOffset
        showAdjustmentOverlay(heightOffset, pitchRef.current)

        if (persist) {
            schedulePersistPanoramaSettings({heightOffset})
        }
    }, [$panorama, schedulePersistPanoramaSettings, showAdjustmentOverlay])

    const setPanoramaPitch = useCallback((value, persist = false) => {
        const pitch = normalizePanoramaPitch(value, pitchRef.current)
        if (pitch === pitchRef.current) {
            return
        }

        pitchRef.current = pitch
        $panorama.pitch = pitch
        showAdjustmentOverlay(heightOffsetRef.current, pitch)

        if (persist) {
            schedulePersistPanoramaSettings({pitch})
        }
    }, [$panorama, schedulePersistPanoramaSettings, showAdjustmentOverlay])

    const handleAdjustmentWheel = useCallback((event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!panorama.active) {
            return
        }
        setPanoramaHeightOffset(
            heightOffsetRef.current + event.deltaY * wheelDeltaModeFactor(event) * WHEEL_HEIGHT_METERS_PER_PIXEL,
            true,
        )
    }, [panorama.active, setPanoramaHeightOffset])

    const closePanorama = useCallback((event) => {
        event?.stopPropagation?.()
        $panorama.active = false
        $panorama.target = false
    }, [$panorama])

    const updateHeight = useCallback((event) => {
        setPanoramaHeightOffset(event.target.value)
    }, [setPanoramaHeightOffset])

    const persistHeight = useCallback((event) => {
        const heightOffset = normalizePanoramaHeightOffset(event.target.value, heightOffsetRef.current)
        persistPanoramaSettings({heightOffset})
    }, [persistPanoramaSettings])

    const updatePitch = useCallback((event) => {
        setPanoramaPitch(event.target.value)
    }, [setPanoramaPitch])

    const persistPitch = useCallback((event) => {
        const pitch = normalizePanoramaPitch(event.target.value, pitchRef.current)
        persistPanoramaSettings({pitch})
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
        if (!panorama.active) {
            return
        }

        const timeout = window.setTimeout(() => {
            showAdjustmentOverlay(heightOffsetRef.current, pitchRef.current)
        }, 0)

        return () => window.clearTimeout(timeout)
    }, [panorama.active, showAdjustmentOverlay])

    useEffect(() => {
        if (!showCameraMovementWidget) {
            standardCameraKeyRef.current = null
            if (!panorama.active) {
                hideAdjustmentOverlay()
            }
            return
        }

        if (panorama.active || rotate.running) {
            standardCameraKeyRef.current = null
            return
        }

        const position = camera.position
        if (!position) {
            return
        }

        const cameraKey = [
            position.longitude,
            position.latitude,
            position.height,
            position.heading,
            position.pitch,
            position.roll,
        ].map(value => Number.isFinite(Number(value)) ? Number(value).toFixed(4) : '').join('|')

        if (!cameraKey.replaceAll('|', '')) {
            return
        }

        if (standardCameraKeyRef.current === null) {
            standardCameraKeyRef.current = cameraKey
            return
        }

        if (standardCameraKeyRef.current === cameraKey) {
            return
        }

        standardCameraKeyRef.current = cameraKey
        showCameraAdjustmentOverlay(position)
    }, [
                  camera.position,
                  hideAdjustmentOverlay,
                  panorama.active,
                  rotate.running,
                  showCameraAdjustmentOverlay,
                  showCameraMovementWidget,
              ])

    useEffect(() => {
        return () => {
            if (interactionPersistTimerRef.current) {
                window.clearTimeout(interactionPersistTimerRef.current)
                interactionPersistTimerRef.current = null
            }
            if (adjustmentOverlayTimerRef.current) {
                window.clearTimeout(adjustmentOverlayTimerRef.current)
                adjustmentOverlayTimerRef.current = null
            }
            hideAdjustmentOverlay()
        }
    }, [hideAdjustmentOverlay])

    useEffect(() => {
        if (!panorama.active || !finePointer || !lgs.viewer?.canvas) {
            return
        }

        const canvas = lgs.viewer.canvas
        const drag = {
            active:      false,
            mode:        'pitch',
            startHeight: heightOffsetRef.current,
            startPitch:  pitchRef.current,
            startY:      0,
        }

        const stopDragListeners = () => {
            document.removeEventListener('pointermove', handlePointerMove, true)
            document.removeEventListener('pointerup', handlePointerUp, true)
            document.removeEventListener('pointercancel', handlePointerUp, true)
        }

        const persistDragValue = () => {
            if (drag.mode === 'height') {
                schedulePersistPanoramaSettings({heightOffset: heightOffsetRef.current})
            }
            else {
                schedulePersistPanoramaSettings({pitch: pitchRef.current})
            }
        }

        function handlePointerDown(event) {
            if (event.pointerType === 'touch' || event.button !== 0 || !$panorama.active) {
                return
            }

            event.preventDefault()
            event.stopPropagation()

            drag.active = true
            drag.mode = event.altKey || event.shiftKey ? 'height' : 'pitch'
            drag.startHeight = heightOffsetRef.current
            drag.startPitch = pitchRef.current
            drag.startY = event.clientY

            document.addEventListener('pointermove', handlePointerMove, true)
            document.addEventListener('pointerup', handlePointerUp, true)
            document.addEventListener('pointercancel', handlePointerUp, true)
        }

        function handlePointerMove(event) {
            if (!drag.active) {
                return
            }

            event.preventDefault()
            event.stopPropagation()

            const deltaY = event.clientY - drag.startY
            if (drag.mode === 'height') {
                setPanoramaHeightOffset(drag.startHeight - deltaY * POINTER_HEIGHT_METERS_PER_PIXEL)
            }
            else {
                setPanoramaPitch(drag.startPitch - deltaY * POINTER_PITCH_DEGREES_PER_PIXEL)
            }
        }

        function handlePointerUp(event) {
            if (!drag.active) {
                return
            }

            event.preventDefault()
            event.stopPropagation()

            drag.active = false
            persistDragValue()
            stopDragListeners()
        }

        const handleWheel = (event) => {
            if (!$panorama.active) {
                return
            }

            event.preventDefault()
            event.stopPropagation()

            setPanoramaHeightOffset(
                heightOffsetRef.current + event.deltaY * wheelDeltaModeFactor(event) * WHEEL_HEIGHT_METERS_PER_PIXEL,
                true,
            )
        }

        canvas.addEventListener('pointerdown', handlePointerDown, true)
        canvas.addEventListener('wheel', handleWheel, {capture: true, passive: false})

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown, true)
            canvas.removeEventListener('wheel', handleWheel, {capture: true})
            stopDragListeners()
        }
    }, [
                  $panorama,
                  finePointer,
                  panorama.active,
                  schedulePersistPanoramaSettings,
                  setPanoramaHeightOffset,
                  setPanoramaPitch,
              ])

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
            hideAdjustmentOverlay()
            __.ui.cameraManager.restoreContinuousCameraRender()
            void __.ui.cameraManager.raiseUpdateEvent()
            void setPoiAnimated(false)
        }
    }, [panorama.active, panorama.target, panorama.heading, $panorama, hideAdjustmentOverlay, setPoiAnimated])

    return (
        <div className="orbit-mode-widgets">
            <OrbitInteractionHintsWidget/>
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
                        {!finePointer && (
                            <>
                                <div className="panorama-widget-slider">
                                    <span>{'Height'}</span>
                                    <input
                                        className="panorama-widget-range"
                                        type="range"
                                        min={PANORAMA_HEIGHT_OFFSET_MIN}
                                        max={PANORAMA_HEIGHT_OFFSET_MAX}
                                        step={PANORAMA_HEIGHT_OFFSET_STEP}
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
                                        min={PANORAMA_PITCH_MIN}
                                        max={PANORAMA_PITCH_MAX}
                                        step={PANORAMA_PITCH_STEP}
                                        value={panorama.pitch}
                                        onInput={updatePitch}
                                        onChange={persistPitch}
                                    />
                                    <strong>{`${Math.round(panorama.pitch)}°`}</strong>
                                </div>
                            </>
                        )}

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

            <Widget
                isVisible={panorama.active || adjustmentVisible}
                config={adjustmentConfig}
                className={`panorama-adjustment-widget-shell${adjustmentVisible ? ' adjustment-visible' : ''}`}
            >
                <div className="panorama-adjustment-overlay" onWheel={handleAdjustmentWheel}>
                    <span className="panorama-adjustment-metric">
                        <sl-icon library="fa" name={FA2SL.set(faAngle)}/>
                        <strong>{adjustmentValues.pitch}</strong>
                    </span>
                    <span className="panorama-adjustment-metric">
                        <sl-icon library="fa" name={FA2SL.set(faMountains)}/>
                        <strong>{adjustmentValues.height}</strong>
                    </span>
                </div>
            </Widget>
        </div>
    )
})
