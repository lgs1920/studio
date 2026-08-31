/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraAdjustmentOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-27
 * Last modified: 2026-08-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget } from '@Components/MainUI/widgets/Widget'
import { LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import {
    REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_POSITION_BEHIND,
    REPLAY_CAMERA_POSITION_SYSTEM,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { faAngle, faMagnifyingGlassLocation, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { foot, meter, UnitUtils } from '@Utils/UnitUtils'
import { cameraViewToSlippyLevel } from '@Utils/cesium/CameraLevel'
import { FA2SL } from '@Utils/FA2SL'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { Math as CesiumMath } from 'cesium'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

const CAMERA_ADJUSTMENT_WIDGET = 'camera-adjustment-widget'
const CAMERA_CHANGE_RETRY_DELAY = 100
const ADJUSTMENT_OVERLAY_DELAY = 2000
const DEFAULT_CAMERA_ADJUSTMENT_CONFIG = {
    attachTo: 'top',
    canReduce: false,
    contextMenu: {canRemove: false},
    draggable: true,
    dynamic: true,
    group: SCENE_WIDGETS,
    id: CAMERA_ADJUSTMENT_WIDGET,
    left: '50%',
    margin: 0,
    opacity: 1,
    persist: false,
    resizable: false,
    rotatable: false,
    scalable: false,
    snappable: true,
    stopPropagation: true,
    top: '10%',
    transient: true,
    type: LGS_WIDGET,
    widgetsBoard: SCENE_WIDGETS_BOARD,
    zIndex: 11950,
}

const DEFAULT_REPLAY_OVERLAY_STATE = {
    active:        false,
    paused:        false,
    playing:       false,
    recordingSync: false,
    camera:        {positionMode: REPLAY_CAMERA_POSITION_SYSTEM, headingOffset: 0},
}

const DEFAULT_VIDEO_OVERLAY_STATE = {
    editing:      false,
    preRecording: false,
}

const numericValueOf = value => {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : 0
}

const formatCameraAdjustmentValues = position => ({
    height: UnitUtils.formatMetric(numericValueOf(position?.height), {
        units: [meter, foot],
        precision: 0,
    }).full,
    pitch: `${Math.round(numericValueOf(position?.pitch))}°`,
    level: position?.level ?? null,
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
            pitch: CesiumMath.toDegrees(camera.pitch ?? 0),
            level: cameraViewToSlippyLevel(camera, lgs.scene ?? lgs.viewer?.scene, {
                imageryProvider: lgs.viewer?.imageryLayers?.get?.(0)?.imageryProvider,
                fallbackHeight: cartographic.height,
            }),
        },
    }
}

/**
 * Render the shared camera adjustment overlay used by orbit and panorama.
 *
 * @param {Object} props - Overlay properties.
 * @param {boolean} props.isVisible - Whether the widget is mounted.
 * @param {Object} props.config - Widget configuration.
 * @param {boolean} props.visible - Whether the overlay is displayed.
 * @param {Object} props.values - Camera adjustment values.
 * @param {boolean} [props.locked=false] - Whether the overlay is locked.
 * @param {Function} [props.onUnlock] - Unlock callback.
 * @param {Function} [props.onWheel] - Wheel callback.
 * @param {Function} [props.onDragStart] - Callback invoked when dragging starts.
 * @param {Function} [props.onDragEnd] - Callback invoked when dragging ends.
 * @returns {JSX.Element} Shared camera adjustment overlay.
 */
export const CameraAdjustmentOverlay = memo(({
    isVisible = true,
    config = DEFAULT_CAMERA_ADJUSTMENT_CONFIG,
    visible,
    values,
    locked = false,
    onUnlock,
    onWheel,
    onDragStart,
    onDragEnd,
}) => {
    const replay = useOptionalSnapshot(lgs.stores?.replay, DEFAULT_REPLAY_OVERLAY_STATE)
    const video = useOptionalSnapshot(lgs.stores?.ui?.video, DEFAULT_VIDEO_OVERLAY_STATE)
    const replayCamera = replay.camera ?? {}
    const hasReplayCameraAngle = video.editing === true
        && replayCamera.positionMode !== REPLAY_CAMERA_POSITION_SYSTEM
        && Number.isFinite(Number(replayCamera.headingOffset))
    const replayCameraDirection = replayCamera.positionMode === REPLAY_CAMERA_POSITION_AHEAD
        ? 'ahead'
        : replayCamera.positionMode === REPLAY_CAMERA_POSITION_BEHIND ? 'behind' : null
    const replayCameraChevron = replayCameraDirection === 'behind' ? 'caret-up' : 'caret-down'
    const cameraChangeTimer = useRef(null)
    const _dragging = useRef(false)
    const _child = useRef({})
    const lastCameraKey = useRef(null)
    const [cameraChange, setCameraChange] = useState(null)
    const widgetConfig = config ?? DEFAULT_CAMERA_ADJUSTMENT_CONFIG

    /**
     * Pauses the shared camera-change expiration while the widget is dragged.
     */
    const handleDragStart = useCallback(() => {
        _dragging.current = true
        if (cameraChangeTimer.current) {
            window.clearTimeout(cameraChangeTimer.current)
            cameraChangeTimer.current = null
        }
        onDragStart?.()
    }, [onDragStart])

    /**
     * Restarts the shared camera-change expiration after the widget is released.
     */
    const handleDragEnd = useCallback(() => {
        _dragging.current = false
        onDragEnd?.()
        if (!cameraChange) {
            return
        }
        if (cameraChangeTimer.current) {
            window.clearTimeout(cameraChangeTimer.current)
        }
        cameraChangeTimer.current = window.setTimeout(() => {
            setCameraChange(null)
            cameraChangeTimer.current = null
        }, ADJUSTMENT_OVERLAY_DELAY)
    }, [cameraChange, onDragEnd])

    useEffect(() => {
        _child.current.onDragStart = handleDragStart
        _child.current.onDragEnd = handleDragEnd
    }, [handleDragEnd, handleDragStart])

    useEffect(() => {
        if (widgetConfig.id !== CAMERA_ADJUSTMENT_WIDGET || !isVisible) {
            return undefined
        }

        let cancelled = false
        let retryTimer = null
        let removeChangedListener = null

        const handleCameraChange = () => {
            const snapshot = currentCameraMovementSnapshot()
            if (!snapshot || snapshot.key === lastCameraKey.current) {
                return
            }

            lastCameraKey.current = snapshot.key
            setCameraChange({values: formatCameraAdjustmentValues(snapshot.position)})

            if (cameraChangeTimer.current) {
                window.clearTimeout(cameraChangeTimer.current)
                cameraChangeTimer.current = null
            }
            if (_dragging.current) {
                return
            }
            cameraChangeTimer.current = window.setTimeout(() => {
                setCameraChange(null)
                cameraChangeTimer.current = null
            }, ADJUSTMENT_OVERLAY_DELAY)
        }

        const attachCameraListener = () => {
            if (cancelled) {
                return
            }
            if (!lgs.camera?.changed?.addEventListener) {
                retryTimer = window.setTimeout(attachCameraListener, CAMERA_CHANGE_RETRY_DELAY)
                return
            }

            lastCameraKey.current = currentCameraMovementSnapshot()?.key ?? null
            removeChangedListener = lgs.camera.changed.addEventListener(handleCameraChange)
        }

        attachCameraListener()

        return () => {
            cancelled = true
            removeChangedListener?.()
            if (retryTimer) {
                window.clearTimeout(retryTimer)
            }
            if (cameraChangeTimer.current) {
                window.clearTimeout(cameraChangeTimer.current)
                cameraChangeTimer.current = null
            }
        }
    }, [isVisible, widgetConfig])

    const displayedValues = cameraChange?.values ?? values ?? {height: '', level: null, pitch: ''}
    const displayedVisible = visible || cameraChange !== null

    return (
        <Widget
            isVisible={isVisible}
            config={widgetConfig}
            childRef={_child}
            className={`camera-adjustment-widget-shell${displayedVisible ? ' adjustment-visible' : ''}`}
        >
            <div className="camera-adjustment-overlay" onWheel={onWheel}>
                <span className="camera-adjustment-metric">
                    <sl-icon library="fa" name={FA2SL.set(faVideo)}/>
                    <strong>{displayedValues.height}</strong>
                </span>
                <span className="camera-adjustment-metric">
                    <sl-icon library="fa" name={FA2SL.set(faAngle)}/>
                    <strong>{displayedValues.pitch}</strong>
                </span>
                {displayedValues.level !== null && displayedValues.level !== undefined && (
                    <span className="camera-adjustment-metric">
                        <sl-icon library="fa" name={FA2SL.set(faMagnifyingGlassLocation)}/>
                        <strong>{displayedValues.level}</strong>
                    </span>
                )}
                {hasReplayCameraAngle && (
                    <span className="camera-adjustment-metric" aria-label="Replay camera angle">
                        <sl-icon library="fa" name={FA2SL.set(faVideo)}/>
                        <strong>{`${Math.round(-Number(replayCamera.headingOffset))}°`}</strong>
                        {replayCameraDirection && (
                            <WaIcon
                                className="camera-adjustment-angle-direction"
                                data-direction={replayCameraDirection}
                                name={replayCameraChevron}
                                variant="solid"
                            />
                        )}
                    </span>
                )}
                {locked && onUnlock && (
                    <button
                        type="button"
                        className="camera-adjustment-lock-control"
                        aria-label="Unlock camera adjustment widget"
                        onClick={onUnlock}
                        onPointerDown={event => event.stopPropagation()}
                    >
                        <WaIcon name="lock" variant="regular"/>
                    </button>
                )}
            </div>
        </Widget>
    )
})
