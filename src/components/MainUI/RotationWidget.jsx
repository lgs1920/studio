/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotationWidget.jsx
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

import {
    ORBIT_RPM_MAX,
    ORBIT_RPM_MIN,
    ORBIT_RPM_STEP,
    normalizeOrbitDirection,
    normalizeOrbitRPM,
    persistOrbitSettings,
}                                   from '@Core/OrbitSettings'
import { OrbitInteractionHintsWidget } from '@Components/MainUI/OrbitInteractionHintsWidget'
import { Widget }                     from '@Components/MainUI/widgets/Widget'
import { LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD }          from '@Core/constants'
import { faAngle, faVideo }                                        from '@fortawesome/pro-regular-svg-icons'
import { FA2SL }                                                   from '@Utils/FA2SL'
import { foot, meter, UnitUtils }                                  from '@Utils/UnitUtils'
import { WaButton, WaCard, WaIcon, WaSlider, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { Math as M }                                               from 'cesium'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }              from 'valtio'
import { scheduleCameraAdjustmentWidgetCenter } from './cameraAdjustmentWidgetPosition'
import { getOrbitWidgetConfig }       from './orbitWidgetConfig'
import { getOrbitRPMGaugeIcon }        from './orbitWidgetPresentation'

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

const isPlusKey = event => event.key === '+'
    || event.code === 'NumpadAdd'
    || event.key?.toLowerCase() === 'plus'
    || (event.code === 'Equal' && event.shiftKey)
const isMinusKey = event => event.key === '-'
    || event.code === 'Minus'
    || event.code === 'NumpadSubtract'
    || event.key?.toLowerCase() === 'minus'
const orbitRPMKeyboardDirection = (event) => {
    if (isPlusKey(event)) {
        return 1
    }
    if (isMinusKey(event)) {
        return -1
    }
    return 0
}
const orbitDirectionKeyboardSign = (event) => {
    if (event.key === 'ArrowRight') {
        return 1
    }
    if (event.key === 'ArrowLeft') {
        return -1
    }
    return 0
}

const RotationCameraAdjustmentOverlay = memo(() => {
    const rotate = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const panorama = useSnapshot(lgs.stores.ui.mainUI.panorama)
    const cameraFlight = useSnapshot(lgs.stores.ui.mainUI.cameraFlight)
    const cameraSettings = useSnapshot(lgs.settings.ui.camera)
    const widgetListSnapshot = useSnapshot(lgs.stores.ui.widget.list)
    useSnapshot(lgs.settings.unitSystem)
    const [visible, setVisible] = useState(false)
    const visibleRef = useRef(false)
    const timerRef = useRef(null)
    const centerAdjustmentCancelRef = useRef(null)
    const lastCameraKeyRef = useRef(null)
    const pointerActiveRef = useRef(false)
    const userActionUntilRef = useRef(0)
    const userActionFrameRef = useRef(null)
    const [values, setValues] = useState(() => formatCameraAdjustmentValues(currentCameraMovementSnapshot()?.position))
    const showCameraMovementWidget = cameraSettings.showMovementWidget ?? true
    const cameraFlightRunning = cameraFlight.running
    const adjustmentWidgetLocked = Boolean(
        widgetListSnapshot.get(CAMERA_ADJUSTMENT_WIDGET)?.locked
        ?? __.ui.widgetManager.getWidgetConfig(CAMERA_ADJUSTMENT_WIDGET)?.locked,
    )
    const config = useMemo(() => ({
        attachTo:        'center',
        canReduce:       false,
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
        persist:         false,
        resizable:       false,
        rotatable:       false,
        scalable:        false,
        snappable:       true,
        stopPropagation: true,
        top:             '50%',
        transient:       true,
        type:            LGS_WIDGET,
        widgetsBoard:    SCENE_WIDGETS_BOARD,
        zIndex:          11950,
    }), [])

    const centerAdjustmentWidget = useCallback(() => {
        centerAdjustmentCancelRef.current?.()
        centerAdjustmentCancelRef.current = scheduleCameraAdjustmentWidgetCenter(CAMERA_ADJUSTMENT_WIDGET)
    }, [])

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

        if (!adjustmentWidgetLocked) {
            timerRef.current = window.setTimeout(() => {
                hide()
                timerRef.current = null
            }, ADJUSTMENT_OVERLAY_DELAY)
        }
    }, [adjustmentWidgetLocked, hide])

    useEffect(() => {
        if (adjustmentWidgetLocked) {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current)
                timerRef.current = null
            }
            return
        }

        if (visibleRef.current && !timerRef.current) {
            timerRef.current = window.setTimeout(() => {
                hide()
                timerRef.current = null
            }, ADJUSTMENT_OVERLAY_DELAY)
        }
    }, [adjustmentWidgetLocked, hide])

    const unlockAdjustmentWidget = useCallback((event) => {
        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent?.stopImmediatePropagation?.()

        const widgetConfig = __.ui.widgetManager.getWidgetConfig(CAMERA_ADJUSTMENT_WIDGET)
        if (widgetConfig) {
            widgetConfig.locked = false
            __.ui.widgetManager.setConfig(CAMERA_ADJUSTMENT_WIDGET, widgetConfig)
        }

        const currentEntry = lgs.stores.ui.widget.list.get(CAMERA_ADJUSTMENT_WIDGET) ?? {}
        lgs.stores.ui.widget.list.set(CAMERA_ADJUSTMENT_WIDGET, {...currentEntry, locked: false})
        lgs.stores.ui.widget.current = {id: CAMERA_ADJUSTMENT_WIDGET}
    }, [])

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

    const showPersistentSnapshot = useCallback(() => {
        const snapshot = currentCameraMovementSnapshot()
        if (!snapshot) {
            visibleRef.current = true
            setVisible(true)
            return false
        }

        lastCameraKeyRef.current = snapshot.key
        show(snapshot.position)
        return true
    }, [show])

    const showAfterUserAction = useCallback(() => {
        if (
            !showCameraMovementWidget
            || cameraFlightRunning
            || !lgs.stores.ui.mainUI.rotate.running
            || lgs.stores.ui.mainUI.panorama.active
        ) {
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
    }, [cameraFlightRunning, showCameraMovementWidget, showCurrentSnapshot])

    useEffect(() => {
        return () => {
            centerAdjustmentCancelRef.current?.()
            centerAdjustmentCancelRef.current = null
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

    const adjustmentWidgetMounted = showCameraMovementWidget

    useEffect(() => {
        if (!adjustmentWidgetMounted) {
            centerAdjustmentCancelRef.current?.()
            centerAdjustmentCancelRef.current = null
            return undefined
        }

        centerAdjustmentWidget()

        const handleResize = () => centerAdjustmentWidget()
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            centerAdjustmentCancelRef.current?.()
            centerAdjustmentCancelRef.current = null
        }
    }, [adjustmentWidgetMounted, centerAdjustmentWidget])

    useEffect(() => {
        if (!showCameraMovementWidget) {
            hide()
            return undefined
        }

        if (adjustmentWidgetLocked) {
            showPersistentSnapshot()
            const interval = window.setInterval(() => {
                const snapshot = currentCameraMovementSnapshot()
                if (!snapshot || snapshot.key === lastCameraKeyRef.current) {
                    return
                }

                lastCameraKeyRef.current = snapshot.key
                update(snapshot.position)
            }, CAMERA_MOVEMENT_OVERLAY_UPDATE_DELAY)

            return () => window.clearInterval(interval)
        }

        if (cameraFlightRunning || !rotate.running || panorama.active) {
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
    }, [
        adjustmentWidgetLocked,
        cameraFlightRunning,
        hide,
        panorama.active,
        rotate.running,
        show,
        showCameraMovementWidget,
        showCurrentSnapshot,
        showPersistentSnapshot,
        update,
    ])

    useEffect(() => {
        if (!showCameraMovementWidget || cameraFlightRunning || !rotate.running || panorama.active) {
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
    }, [cameraFlightRunning, panorama.active, rotate.running, showAfterUserAction, showCameraMovementWidget])

    return (
        <Widget
            isVisible={adjustmentWidgetMounted}
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
                {adjustmentWidgetLocked && (
                    <button
                        type="button"
                        className="panorama-adjustment-lock-control"
                        aria-label="Unlock camera adjustment widget"
                        onClick={unlockAdjustmentWidget}
                        onPointerDown={event => event.stopPropagation()}
                    >
                        <WaIcon name="lock" variant="regular"/>
                    </button>
                )}
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

    const blockWidgetDrag = useCallback((event) => {
        event.stopPropagation()
        event.nativeEvent?.stopImmediatePropagation?.()
    }, [])

    const stopRotation = useCallback((event) => {
        event?.stopPropagation?.()
        void __.ui.poiManager.stopRotationAndSync()
    }, [])

    const updateRPM = useCallback((event) => {
        const value = Number(event.target.value)
        $rotate.rpm = value
    }, [$rotate])

    const setRotationRPM = useCallback((value, persist = false) => {
        const rpm = normalizeOrbitRPM(value, $rotate.rpm)
        if (rpm === $rotate.rpm) {
            return
        }

        $rotate.rpm = rpm

        if (persist) {
            void persistOrbitSettings($rotate.target, 'rotation', {rpm})
        }
    }, [$rotate])

    const setRotationDirectionSign = useCallback((sign, persist = false) => {
        const currentMagnitude = Math.abs(Number($rotate.direction))
        const magnitude = Number.isFinite(currentMagnitude) && currentMagnitude > 0
                          ? currentMagnitude
                          : 1
        const direction = normalizeOrbitDirection(sign * magnitude, $rotate.direction)
        if (direction === $rotate.direction) {
            return
        }

        $rotate.direction = direction

        if (persist) {
            void persistOrbitSettings($rotate.target, 'rotation', {direction})
        }
    }, [$rotate])

    const persistRPM = useCallback((event) => {
        const value = Number(event.target.value)
        void persistOrbitSettings(rotate.target, 'rotation', {rpm: value})
    }, [rotate.target])

    const toggleDirection = useCallback((event) => {
        event?.stopPropagation?.()
        const direction = Number($rotate.direction) < 0 ? 1 : -1
        $rotate.direction = direction
        void persistOrbitSettings(rotate.target, 'rotation', {direction})
    }, [$rotate, rotate.target])

    useEffect(() => {
        if (!rotate.running || panorama.active) {
            return
        }

        const handleKeyDown = (event) => {
            if (event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) {
                return
            }

            const directionSign = event.ctrlKey ? 0 : orbitDirectionKeyboardSign(event)
            if (directionSign !== 0) {
                event.preventDefault()
                event.stopPropagation()
                event.stopImmediatePropagation?.()
                if (!event.repeat) {
                    setRotationDirectionSign(directionSign, true)
                }
                return
            }

            const direction = orbitRPMKeyboardDirection(event)
            if (direction === 0) {
                return
            }

            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()
            setRotationRPM($rotate.rpm + direction * ORBIT_RPM_STEP, true)
        }

        window.addEventListener('keydown', handleKeyDown, {capture: true})

        return () => window.removeEventListener('keydown', handleKeyDown, {capture: true})
    }, [$rotate, panorama.active, rotate.running, setRotationDirectionSign, setRotationRPM])

    const directionIsAntiClockwise = rotate.direction < 0
    const directionTooltip = directionIsAntiClockwise ? 'Anti-clockwise' : 'Clockwise'
    const directionIcon = directionIsAntiClockwise ? 'arrow-rotate-right' : 'arrow-rotate-left'
    const directionAnimation = directionIsAntiClockwise ? 'spin' : 'spin-reverse'
    const directionAnimationStyle = {'--animation-duration': `${30 / normalizeOrbitRPM(rotate.rpm)}s`}
    const rpmGaugeIcon = getOrbitRPMGaugeIcon(rotate.rpm)

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
                    <div className="orbit-widget-header orbit-widget-header-end">
                        <WaTooltip for="rotation-direction-toggle" placement="top">
                            {directionTooltip}
                        </WaTooltip>
                        <WaButton
                            id="rotation-direction-toggle"
                            aria-label={directionTooltip}
                            appearance="outlined"
                            className="orbit-widget-header-button orbit-direction-button lgs-widget-no-drag"
                            size="s"
                            variant="brand"
                            onClick={toggleDirection}
                            onPointerDownCapture={blockWidgetDrag}
                        >
                            <WaIcon
                                name={directionIcon}
                                animation={directionAnimation}
                                variant="regular"
                                style={directionAnimationStyle}
                            />
                        </WaButton>
                    </div>

                    <div className="panorama-widget-body rotation-widget-body">
                        <div className="panorama-widget-slider">
                            <span className="panorama-widget-slider-label">
                                <WaIcon name={rpmGaugeIcon} variant="regular" label="RPM"/>
                            </span>
                            <WaSlider
                                aria-label="RPM"
                                className="panorama-widget-range lgs-widget-no-drag"
                                orientation="vertical"
                                size="s"
                                min={ORBIT_RPM_MIN}
                                max={ORBIT_RPM_MAX}
                                step={ORBIT_RPM_STEP}
                                value={rotate.rpm}
                                onInput={updateRPM}
                                onChange={persistRPM}
                            />
                            <strong>{rotate.rpm.toFixed(1)}</strong>
                        </div>
                    </div>

                    <div className="orbit-widget-footer orbit-widget-footer-centered">
                        <WaButton
                            aria-label="Stop rotation"
                            appearance="outlined"
                            className="orbit-widget-footer-button orbit-widget-stop-button lgs-widget-no-drag"
                            size="s"
                            variant="brand"
                            onClick={stopRotation}
                            onPointerDownCapture={blockWidgetDrag}
                        >
                            <WaIcon name="xmark" variant="regular"/>
                        </WaButton>
                    </div>
                </WaCard>
            </Widget>
        </div>
    )
})
