/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotationWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
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
import { LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD }          from '@Core/constants'
import { faAngle, faVideo }                                        from '@fortawesome/pro-regular-svg-icons'
import { FA2SL }                                                   from '@Utils/FA2SL'
import { foot, meter, UnitUtils }                                  from '@Utils/UnitUtils'
import { WaButton, WaCard, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { Math as M }                                               from 'cesium'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }              from 'valtio'
import { getOrbitWidgetConfig }       from './orbitWidgetConfig'

const CAMERA_ADJUSTMENT_WIDGET = 'rotation-camera-adjustment-widget'
const CAMERA_MOVEMENT_OVERLAY_UPDATE_DELAY = 500
const ADJUSTMENT_OVERLAY_DELAY = 2000
const USER_CAMERA_ACTION_WINDOW = 1000
const INITIAL_OVERLAY_RETRY_DELAY = 100
const INITIAL_OVERLAY_RETRY_LIMIT = 40

const numericValueOf = value => {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : 0
}

const formatCameraAltitude = height => UnitUtils.formatMetric(numericValueOf(height), {
    units:     [meter, foot],
    precision: 0,
}).full

const formatCameraPitch = pitch => `${Math.round(numericValueOf(pitch))}°`

const formatCameraAdjustmentValues = position => ({
    height: formatCameraAltitude(position?.height),
    pitch:  formatCameraPitch(position?.pitch),
})

const currentCameraMovementSnapshot = () => {
    const camera = lgs.camera
    const cartographic = camera?.positionCartographic
    if (!camera || !cartographic) {
        return null
    }

    const key = [
        cartographic.longitude,
        cartographic.latitude,
        cartographic.height,
        camera.heading,
        camera.pitch,
        camera.roll,
    ].map(value => Number.isFinite(Number(value)) ? Number(value).toFixed(6) : '').join('|')

    if (!key.replaceAll('|', '')) {
        return null
    }

    return {
        key,
        position: {
            height: cartographic.height,
            pitch:  M.toDegrees(camera.pitch ?? 0),
        },
    }
}

const appIsVisible = () => typeof document === 'undefined' || document.body.classList.contains('lgs-app-visible')

const isEditableTarget = target => target instanceof HTMLElement
    && Boolean(target.closest('input, textarea, select, wa-input, wa-textarea, wa-select'))

const RotationCameraAdjustmentOverlay = memo(() => {
    const rotate = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const panorama = useSnapshot(lgs.stores.ui.mainUI.panorama)
    const cameraSettings = useSnapshot(lgs.settings.ui.camera)
    useSnapshot(lgs.settings.unitSystem)
    const [visible, setVisible] = useState(false)
    const visibleRef = useRef(false)
    const timerRef = useRef(null)
    const lastCameraKeyRef = useRef(null)
    const pointerActiveRef = useRef(false)
    const userActionUntilRef = useRef(0)
    const userActionFrameRef = useRef(null)
    const [values, setValues] = useState(() => formatCameraAdjustmentValues(currentCameraMovementSnapshot()?.position))
    const showCameraMovementWidget = cameraSettings.showMovementWidget ?? true
    const config = useMemo(() => ({
        attachTo:        'center',
        contextMenu:     {
            canRemove: false,
        },
        draggable:       true,
        dynamic:         true,
        group:           SCENE_WIDGETS,
        id:              CAMERA_ADJUSTMENT_WIDGET,
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

    const hide = useCallback(() => {
        visibleRef.current = false
        setVisible(false)
        if (lgs.stores.ui.widget.current?.id === CAMERA_ADJUSTMENT_WIDGET) {
            lgs.stores.ui.widget.current = {id: null}
        }
    }, [])

    const show = useCallback((position) => {
        setValues(formatCameraAdjustmentValues(position))
        visibleRef.current = true
        setVisible(true)

        if (timerRef.current) {
            window.clearTimeout(timerRef.current)
        }

        timerRef.current = window.setTimeout(() => {
            hide()
            timerRef.current = null
        }, ADJUSTMENT_OVERLAY_DELAY)
    }, [hide])

    const update = useCallback((position) => {
        setValues(formatCameraAdjustmentValues(position))
    }, [])

    const showCurrentSnapshot = useCallback(() => {
        const snapshot = currentCameraMovementSnapshot()
        if (!snapshot) {
            return false
        }

        lastCameraKeyRef.current = snapshot.key
        show(snapshot.position)
        return true
    }, [show])

    const showAfterUserAction = useCallback(() => {
        if (!showCameraMovementWidget || !lgs.stores.ui.mainUI.rotate.running || lgs.stores.ui.mainUI.panorama.active) {
            return
        }

        userActionUntilRef.current = performance.now() + USER_CAMERA_ACTION_WINDOW
        if (userActionFrameRef.current !== null) {
            window.cancelAnimationFrame(userActionFrameRef.current)
        }

        userActionFrameRef.current = window.requestAnimationFrame(() => {
            userActionFrameRef.current = null
            showCurrentSnapshot()
        })
    }, [showCameraMovementWidget, showCurrentSnapshot])

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current)
                timerRef.current = null
            }
            if (userActionFrameRef.current !== null) {
                window.cancelAnimationFrame(userActionFrameRef.current)
                userActionFrameRef.current = null
            }
            hide()
        }
    }, [hide])

    useEffect(() => {
        if (!showCameraMovementWidget || !rotate.running || panorama.active) {
            hide()
            return undefined
        }

        let hasShownOverlay = false
        let initialRetryCount = 0
        let initialRetryTimer = null
        let visibilityObserver = null

        const clearInitialRetry = () => {
            if (initialRetryTimer !== null) {
                window.clearInterval(initialRetryTimer)
                initialRetryTimer = null
            }
            visibilityObserver?.disconnect()
            visibilityObserver = null
        }

        const showInitialOverlay = () => {
            if (!appIsVisible()) {
                return false
            }

            if (showCurrentSnapshot()) {
                hasShownOverlay = true
                clearInitialRetry()
                return true
            }

            initialRetryCount += 1
            if (initialRetryCount >= INITIAL_OVERLAY_RETRY_LIMIT) {
                clearInitialRetry()
            }

            return false
        }

        const scheduleInitialOverlay = () => {
            if (showInitialOverlay()) {
                return
            }

            initialRetryTimer = window.setInterval(showInitialOverlay, INITIAL_OVERLAY_RETRY_DELAY)
            if (typeof MutationObserver !== 'undefined' && !appIsVisible()) {
                visibilityObserver = new MutationObserver(showInitialOverlay)
                visibilityObserver.observe(document.body, {
                    attributes:      true,
                    attributeFilter: ['class'],
                })
            }
        }

        const updateRotationCameraMovement = () => {
            const snapshot = currentCameraMovementSnapshot()
            if (!snapshot || snapshot.key === lastCameraKeyRef.current) {
                return
            }

            lastCameraKeyRef.current = snapshot.key
            if (!hasShownOverlay) {
                showInitialOverlay()
                return
            }

            if (performance.now() <= userActionUntilRef.current) {
                show(snapshot.position)
                return
            }

            if (visibleRef.current) {
                update(snapshot.position)
            }
        }

        scheduleInitialOverlay()
        const interval = window.setInterval(updateRotationCameraMovement, CAMERA_MOVEMENT_OVERLAY_UPDATE_DELAY)

        return () => {
            window.clearInterval(interval)
            clearInitialRetry()
        }
    }, [hide, panorama.active, rotate.running, show, showCameraMovementWidget, showCurrentSnapshot, update])

    useEffect(() => {
        if (!showCameraMovementWidget || !rotate.running || panorama.active) {
            return undefined
        }

        const canvas = lgs.viewer?.canvas ?? lgs.canvas
        if (!canvas) {
            return undefined
        }

        const handlePointerDown = () => {
            pointerActiveRef.current = true
            showAfterUserAction()
        }
        const handlePointerMove = () => {
            if (pointerActiveRef.current) {
                showAfterUserAction()
            }
        }
        const handlePointerUp = () => {
            if (pointerActiveRef.current) {
                showAfterUserAction()
            }
            pointerActiveRef.current = false
        }
        const handleWheel = () => showAfterUserAction()
        const handleKeyDown = event => {
            if (!isEditableTarget(event.target)) {
                showAfterUserAction()
            }
        }

        canvas.addEventListener('pointerdown', handlePointerDown, true)
        canvas.addEventListener('pointermove', handlePointerMove, true)
        canvas.addEventListener('wheel', handleWheel, {capture: true, passive: true})
        document.addEventListener('pointerup', handlePointerUp, true)
        document.addEventListener('pointercancel', handlePointerUp, true)
        document.addEventListener('keydown', handleKeyDown, true)

        return () => {
            pointerActiveRef.current = false
            canvas.removeEventListener('pointerdown', handlePointerDown, true)
            canvas.removeEventListener('pointermove', handlePointerMove, true)
            canvas.removeEventListener('wheel', handleWheel, true)
            document.removeEventListener('pointerup', handlePointerUp, true)
            document.removeEventListener('pointercancel', handlePointerUp, true)
            document.removeEventListener('keydown', handleKeyDown, true)
        }
    }, [panorama.active, rotate.running, showAfterUserAction, showCameraMovementWidget])

    return (
        <Widget
            isVisible={visible && rotate.running && !panorama.active}
            config={config}
            className={`panorama-adjustment-widget-shell${visible ? ' adjustment-visible' : ''}`}
        >
            <div className="panorama-adjustment-overlay">
                <span className="panorama-adjustment-metric">
                    <sl-icon library="fa" name={FA2SL.set(faVideo)}/>
                    <strong>{values.height}</strong>
                </span>
                <span className="panorama-adjustment-metric">
                    <sl-icon library="fa" name={FA2SL.set(faAngle)}/>
                    <strong>{values.pitch}</strong>
                </span>
            </div>
        </Widget>
    )
})

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
    }, [rotate.target])

    const updateDirection = useCallback((event) => {
        const value = Number(event.target.value)
        $rotate.direction = value
    }, [$rotate])

    const persistDirection = useCallback((event) => {
        const value = Number(event.target.value)
        void persistOrbitSettings(rotate.target, 'rotation', {direction: value})
    }, [rotate.target])

    return (
        <div className="orbit-mode-widgets">
            <OrbitInteractionHintsWidget/>
            <RotationCameraAdjustmentOverlay/>
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
