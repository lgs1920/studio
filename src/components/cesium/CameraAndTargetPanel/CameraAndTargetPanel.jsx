/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraAndTargetPanel.jsx
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

import './style.css'
import { Widget }      from '@Components/MainUI/widgets/Widget'
import {
    CAMERA_INFORMATION_WIDGET, LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD,
}                      from '@Core/constants'
import { faAngle, faArrowsToCircle, faMountains, faVideo } from '@fortawesome/pro-regular-svg-icons'
import { CameraUtils }                                       from '@Utils/cesium/CameraUtils'
import { FA2SL }       from '@Utils/FA2SL'
import { foot, meter, UnitUtils }                            from '@Utils/UnitUtils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { snapshot, useSnapshot }                             from 'valtio'

const CAMERA_PANEL_UPDATE_DELAY = 250

const cloneCameraData = camera => ({
    position: {...(camera?.position ?? {})},
    target:   {...(camera?.target ?? {})},
})

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const targetHeightOf = target => target?.simulatedHeight ?? target?.height

const hasMapCoordinates = target => finiteNumber(target?.longitude) !== null
    && finiteNumber(target?.latitude) !== null
    && finiteNumber(targetHeightOf(target)) !== null

const currentContinuousTarget = () => {
    const panorama = lgs.stores.ui.mainUI.panorama
    if (panorama.active && hasMapCoordinates(panorama.target)) {
        return panorama.target
    }

    return hasMapCoordinates(lgs.stores.ui.mainUI.rotate.target)
           ? lgs.stores.ui.mainUI.rotate.target
           : lgs.stores.main.components.camera.target
}

const liveCameraOptions = continuousMove => {
    const target = currentContinuousTarget()
    return continuousMove && hasMapCoordinates(target)
           ? {skipTargetPick: true, target}
           : {}
}

/**
 * Renders one camera information line with the icon used by the previous banners.
 * @param {Object} props - Component props
 * @param {Object} props.icon - FontAwesome icon for the line
 * @param {React.ReactNode} props.children - Content to display inside the line
 * @param {Function} props.onDoubleClick - Handler for double-click event
 * @returns {JSX.Element} Camera information line
 */
const CameraDataLine = ({icon, children, onDoubleClick}) => (
    <div className="camera-information-line" onDoubleClick={onDoubleClick}>
        <sl-icon library="fa" name={FA2SL.set(icon)}/>
        <div className="camera-information-values">{children}</div>
    </div>
)

const valueOf = value => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsedValue = Number(value)
        return Number.isFinite(parsedValue) ? parsedValue : null
    }
    return null
}
const coordinateOf = value => {
    const numericValue = valueOf(value)
    return numericValue === null ? null : __.convert(numericValue).to(lgs.settings.coordinateSystem.current)
}

const normalizeAngle = value => {
    const numericValue = valueOf(value)
    if (numericValue === null) {
        return null
    }

    const normalizedValue = ((numericValue % 360) + 360) % 360
    return Object.is(normalizedValue, -0) ? 0 : normalizedValue
}

const metricOf = (value, {units, precision}) => {
    const numericValue = valueOf(value)
    if (numericValue === null) {
        return {value: '', unit: ''}
    }

    return UnitUtils.formatMetric(units === '°' ? normalizeAngle(numericValue) : numericValue, {units, precision})
}

const CameraMetric = ({bindLiveRef, metricKey, value, className, text, units, precision}) => {
    const metric = metricOf(value, {units, precision})
    const compactUnit = units === '°'

    return (
        <div className={`${className ?? ''} lgs-text-value`.trim()}>
            {text && <span className="lgs-nvu-text">{text}</span>}
            {compactUnit ? (
                <span className="camera-metric-compact-unit">
                    <span ref={bindLiveRef(`${metricKey}Value`)} className="lgs-nvu-value">{metric.value}</span>
                    <span ref={bindLiveRef(`${metricKey}Unit`)} className="lgs-nvu-unit">{metric.unit}</span>
                </span>
            ) : (
                 <>
                     <span ref={bindLiveRef(`${metricKey}Value`)} className="lgs-nvu-value">{metric.value}</span>
                     <span ref={bindLiveRef(`${metricKey}Unit`)} className="lgs-nvu-unit">{metric.unit}</span>
                 </>
             )}
        </div>
    )
}

/**
 * Displays camera and target information in a single draggable, non-resizable top-centered widget.
 * @returns {JSX.Element|null} Camera information widget
 */
export const CameraAndTargetPanel = () => {
    const storeCamera = useSnapshot(lgs.stores.main.components.camera)
    const $ui = lgs.settings.ui
    const ui = useSnapshot($ui)
    useSnapshot(lgs.settings.unitSystem)
    useSnapshot(lgs.settings.coordinateSystem)
    const rotate = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const panorama = useSnapshot(lgs.stores.ui.mainUI.panorama)
    const is2D = __.ui.sceneManager.is2D
    const liveRefs = useRef({})
    const updateTimer = useRef(null)
    const updateInProgress = useRef(false)
    const updateFrame = useRef(null)
    const [camera, setCamera] = useState(() => cloneCameraData(snapshot(lgs.stores.main.components.camera)))
    const continuousMove = rotate.running || panorama.active

    const config = useMemo(() => {
        return {
            attachTo:        'top',
            contextMenu:     {
                canRemove: true,
            },
            draggable:       true,
            dynamic:         true,
            group:           SCENE_WIDGETS,
            id:              CAMERA_INFORMATION_WIDGET,
            left:            '50%',
            margin: lgs.gutter.xs,
            persist:         false,
            resizable:       false,
            rotatable:       false,
            scalable:        false,
            showControlBox:  false,
            snappable:       false,
            stopPropagation: true,
            top:             '0px',
            type:            LGS_WIDGET,
            widgetsBoard:    SCENE_WIDGETS_BOARD,
            zIndex:          12000,
        }
    }, [])

    const hasSelectedInformation = ui.camera.showPosition || ui.camera.showHPR || ui.camera.showTargetPosition

    const bindLiveRef = useCallback((key) => (element) => {
        if (element) {
            liveRefs.current[key] = element
        }
        else {
            delete liveRefs.current[key]
        }
    }, [])

    const updateText = useCallback((key, value) => {
        const element = liveRefs.current[key]
        if (element) {
            element.textContent = value ?? ''
        }
    }, [])

    const updateMetric = useCallback((key, value, options) => {
        const metric = metricOf(value, options)
        updateText(`${key}Value`, metric.value)
        updateText(`${key}Unit`, metric.unit)
    }, [updateText])

    const applyLiveCameraData = useCallback((nextCamera) => {
        updateText('targetLatitude', coordinateOf(nextCamera.target?.latitude))
        updateText('targetLongitude', coordinateOf(nextCamera.target?.longitude))
        updateText('positionLatitude', coordinateOf(nextCamera.position?.latitude))
        updateText('positionLongitude', coordinateOf(nextCamera.position?.longitude))

        updateMetric('targetHeight', nextCamera.target?.height, {units: [meter, foot], precision: 0})
        updateMetric('targetPositionHeight', nextCamera.position?.height, {units: [meter, foot], precision: 0})
        updateMetric('positionHeight', nextCamera.position?.height, {units: [meter, foot], precision: 0})
        updateMetric('heading', nextCamera.position?.heading, {units: '°', precision: 0})
        updateMetric('pitch', nextCamera.position?.pitch, {units: '°', precision: 0})
        updateMetric('roll', nextCamera.position?.roll, {units: '°', precision: 0})
    }, [updateMetric, updateText])

    const commitCameraData = useCallback((nextCamera) => {
        const clonedCamera = cloneCameraData(nextCamera)
        setCamera(clonedCamera)
        applyLiveCameraData(clonedCamera)
    }, [applyLiveCameraData])

    const updateLiveCamera = useCallback(async () => {
        if (!hasSelectedInformation || !lgs.camera || updateInProgress.current) {
            return
        }

        updateInProgress.current = true

        try {
            const nextCamera = await CameraUtils.updatePositionInformation(null, liveCameraOptions(continuousMove))

            if (nextCamera) {
                commitCameraData(nextCamera)
            }
        }
        finally {
            updateInProgress.current = false
        }
    }, [commitCameraData, continuousMove, hasSelectedInformation])

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (!continuousMove) {
                setCamera(cloneCameraData(storeCamera))
            }
        }, 0)

        return () => window.clearTimeout(timeout)
    }, [continuousMove, storeCamera])

    useEffect(() => {
        if (!hasSelectedInformation || !continuousMove || !lgs.camera) {
            return
        }

        let cancelled = false

        const tick = async () => {
            if (cancelled) {
                return
            }

            await updateLiveCamera()

            if (!cancelled) {
                updateTimer.current = window.setTimeout(tick, CAMERA_PANEL_UPDATE_DELAY)
            }
        }

        void tick()

        return () => {
            cancelled = true
            if (updateTimer.current) {
                window.clearTimeout(updateTimer.current)
                updateTimer.current = null
            }
        }
    }, [continuousMove, hasSelectedInformation, updateLiveCamera])

    useEffect(() => {
        if (!hasSelectedInformation || continuousMove) {
            return undefined
        }

        let cancelled = false
        let retryTimer = null
        let removeChangedListener = null

        const clearFrame = () => {
            if (updateFrame.current !== null) {
                window.cancelAnimationFrame(updateFrame.current)
                updateFrame.current = null
            }
        }

        const scheduleUpdate = () => {
            if (cancelled || updateFrame.current !== null) {
                return
            }

            updateFrame.current = window.requestAnimationFrame(() => {
                updateFrame.current = null
                if (!cancelled) {
                    void updateLiveCamera()
                }
            })
        }

        const attachCameraListener = () => {
            if (cancelled) {
                return
            }

            if (!lgs.camera?.changed) {
                retryTimer = window.setTimeout(attachCameraListener, CAMERA_PANEL_UPDATE_DELAY)
                return
            }

            scheduleUpdate()
            removeChangedListener = lgs.camera.changed.addEventListener(scheduleUpdate)
        }

        attachCameraListener()

        return () => {
            cancelled = true
            removeChangedListener?.()
            if (retryTimer) {
                window.clearTimeout(retryTimer)
            }
            clearFrame()
        }
    }, [continuousMove, hasSelectedInformation, updateLiveCamera])

    const targetLatitude = coordinateOf(camera.target?.latitude)
    const targetLongitude = coordinateOf(camera.target?.longitude)
    const targetHeight = valueOf(camera.target?.height)
    const positionLatitude = coordinateOf(camera.position?.latitude)
    const positionLongitude = coordinateOf(camera.position?.longitude)
    const positionHeight = valueOf(camera.position?.height)
    const heading = valueOf(camera.position?.heading)
    const pitch = valueOf(camera.position?.pitch)
    const roll = valueOf(camera.position?.roll)
    const hasTargetPosition = targetLatitude !== null && targetLongitude !== null
    const hasCameraPosition = positionLatitude !== null && positionLongitude !== null
    const hasCameraHPR = heading !== null || pitch !== null || roll !== null

    const showTargetPosition = ui.camera.showTargetPosition && hasTargetPosition && !__.ui.cameraManager.lookingAtTheSky(camera.target)
    const showCameraPosition = !is2D && ui.camera.showPosition && hasCameraPosition
    const showCameraHPR = !is2D && ui.camera.showHPR && hasCameraHPR
    const hasRenderableInformation = showTargetPosition || showCameraPosition || showCameraHPR

    if (!hasSelectedInformation || !hasRenderableInformation) {
        return null
    }

    return (
        <Widget isVisible={true} config={config} className="camera-information-widget-shell">
            <div id="camera-information-widget" className="camera-information-panel lgs-card wa-theme-lgs1920-on-map">
                {showTargetPosition && (
                    <CameraDataLine
                        icon={faArrowsToCircle}
                        onDoubleClick={() => ($ui.camera.showTargetPosition = false)}
                    >
                        <>
                            <span ref={bindLiveRef('targetLatitude')}>{targetLatitude ?? ''}</span>
                            {', '}
                            <span ref={bindLiveRef('targetLongitude')}>{targetLongitude ?? ''}</span>
                            {targetHeight !== null && (
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faMountains)}/>
                                    <CameraMetric
                                        bindLiveRef={bindLiveRef}
                                        metricKey="targetHeight"
                                        value={targetHeight}
                                        className="camera-altitude"
                                        units={[meter, foot]}
                                        precision={0}
                                    />
                                </>
                            )}
                            {is2D && positionHeight !== null && (
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faVideo)}/>
                                    <CameraMetric
                                        bindLiveRef={bindLiveRef}
                                        metricKey="targetPositionHeight"
                                        value={positionHeight}
                                        className="camera-altitude"
                                        units={[meter, foot]}
                                        precision={0}
                                    />
                                </>
                            )}
                        </>
                    </CameraDataLine>
                )}

                {showCameraPosition && (
                    <CameraDataLine
                        icon={faVideo}
                        onDoubleClick={() => ($ui.camera.showPosition = false)}
                    >
                        <>
                            <span ref={bindLiveRef('positionLatitude')}>{positionLatitude ?? ''}</span>
                            {', '}
                            <span ref={bindLiveRef('positionLongitude')}>{positionLongitude ?? ''}</span>
                            {positionHeight !== null && (
                                <>
                                    <sl-icon library="fa" name={FA2SL.set(faMountains)}/>
                                    <CameraMetric
                                        bindLiveRef={bindLiveRef}
                                        metricKey="positionHeight"
                                        value={positionHeight}
                                        className="camera-altitude"
                                        units={[meter, foot]}
                                        precision={0}
                                    />
                                </>
                            )}
                        </>
                    </CameraDataLine>
                )}

                {showCameraHPR && (
                    <CameraDataLine
                        icon={faAngle}
                        onDoubleClick={() => ($ui.camera.showHPR = false)}
                    >
                        <>
                            {heading !== null && (
                                <CameraMetric
                                    bindLiveRef={bindLiveRef}
                                    metricKey="heading"
                                    value={heading}
                                    className="camera-heading"
                                    text="Heading:"
                                    units="°"
                                    precision={0}
                                />
                            )}
                            {pitch !== null && (
                                <CameraMetric
                                    bindLiveRef={bindLiveRef}
                                    metricKey="pitch"
                                    value={pitch}
                                    className="camera-pitch"
                                    text="Pitch:"
                                    units="°"
                                    precision={0}
                                />
                            )}
                            {roll !== null && (
                                <CameraMetric
                                    bindLiveRef={bindLiveRef}
                                    metricKey="roll"
                                    value={roll}
                                    className="camera-roll"
                                    text="Roll:"
                                    units="°"
                                    precision={0}
                                />
                            )}
                        </>
                    </CameraDataLine>
                )}
            </div>
        </Widget>
    )
}
