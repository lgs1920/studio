/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayCameraJoystick.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-29
 * Last modified: 2026-10-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Widget} from '@Components/MainUI/widgets/Widget'
import {LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD} from '@Core/constants'
import {currentJourneyReplayCameraSettings, isJourneyReplayCameraActive} from '@Core/ui/replay/JourneyReplayRuntime'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {WaIcon} from '@awesome.me/webawesome/dist/react'
import {useCallback, useEffect, useRef, useState} from 'react'
import './replayCameraJoystick.css'

const CONFIG = {
    id: 'replay-camera-joystick-widget',
    type: LGS_WIDGET,
    widgetsBoard: SCENE_WIDGETS_BOARD,
    group: SCENE_WIDGETS,
    left: '90%',
    top: '55%',
    attachTo: 'right',
    margin: 24,
    draggable: true,
    canReduce: false,
    canLock: false,
    contextMenu: {canRemove: false},
    persist: false,
    transient: true,
    stopPropagation: true,
    resizable: false,
    scalable: false,
    rotatable: false,
    showControlBox: false,
    zIndex: 'var(--lgs-video-recording-settings-toolbar-zindex)',
}

/** Scale pointer-held joystick input into a gentler Replay camera adjustment rate. */
const JOYSTICK_POINTER_SENSITIVITY = 0.7

/** Limit full-deflection pitch adjustment to 22.5 degrees per second. */
const JOYSTICK_PITCH_DEGREES_PER_SECOND = 22.5

/** Check the live preparation state before every camera write, including queued input frames. */
const canAdjustCamera = () => {
    const video = globalThis.lgs?.stores?.ui?.video
    return video?.editing === true && !video.preRecording && !video.exporting
        && !video.snapshot && !video.finalizing
        && !isJourneyReplayCameraActive(globalThis.lgs?.stores?.replay)
}

/** Consume joystick input before the widget host or map handles it. */
const consumeInput = event => {
    event.preventDefault()
    event.stopPropagation()
}

/** Project the recessed thumb over the curved pad surface, shortening movement toward the rim. */
const thumbStyleFrom = ({x, y}) => {
    const radius = Math.hypot(x, y)
    const depth = Math.sqrt(Math.max(0, 1 - (radius * 0.8) ** 2))
    const normalX = radius > 0 ? x / radius : 0
    const normalY = radius > 0 ? y / radius : 0
    const a = 1 + (depth - 1) * normalX ** 2
    const b = (depth - 1) * normalX * normalY
    const d = 1 + (depth - 1) * normalY ** 2
    return {
        left: `${50 + x * 20}%`,
        top: `${50 + y * 20}%`,
        transform: `translate(-50%, -50%) matrix(${a}, ${b}, ${b}, ${d}, 0, 0)`,
    }
}

/** Render a transient, spring-centered zoom/pitch control during idle Replay preparation. */
export const ReplayCameraJoystick = () => {
    const video = useOptionalSnapshot(lgs.stores.ui.video)
    const replay = useOptionalSnapshot(lgs.stores.replay)
    const journeySlug = useProxyValue(lgs.stores.main, main => main.theJourney?.slug ?? null, null)
    const _gesture = useRef(null)
    const _frame = useRef(null)
    const _pad = useRef(null)
    const _canvas = useRef(null)
    const _scene = useRef(null)
    const _visualPosition = useRef({x: 0, y: 0})
    const [stick, setStick] = useState({x: 0, y: 0})
    const [action, setAction] = useState({x: 0, y: 0})
    const [sceneReady, setSceneReady] = useState(false)
    const available = video.editing === true && !video.preRecording && !video.exporting
        && !video.snapshot && !video.finalizing && !isJourneyReplayCameraActive(replay)
        && Boolean(journeySlug)

    /** Stop queued input and release capture on release, cancellation, blur, or scene replacement. */
    const stop = useCallback(() => {
        const gesture = _gesture.current
        _gesture.current = null
        if (_frame.current !== null) cancelAnimationFrame(_frame.current)
        _frame.current = null
        if (gesture?.target.hasPointerCapture?.(gesture.pointerId)) {
            gesture.target.releasePointerCapture(gesture.pointerId)
        }
        setStick({x: 0, y: 0})
        setAction({x: 0, y: 0})
    }, [])

    /** Merge only height and pitch, preserving azimuth and the selected altitude mode. */
    const adjust = useCallback((x, y, scale = 1) => {
        if (!canAdjustCamera()) return
        const current = currentJourneyReplayCameraSettings()
        const altitude = Math.max(10, Math.min(100000, current.altitude * Math.exp(-x * scale)))
        const pitch = Math.max(-89, Math.min(-5, current.pitch - y * JOYSTICK_PITCH_DEGREES_PER_SECOND * scale))
        if (altitude !== current.altitude || pitch !== current.pitch) {
            globalThis.__?.ui?.replay?.updatePreparationCamera?.(
                {altitude, pitch},
                {preserveCameraRange: true},
            )
        }
    }, [])

    /** Apply held deflection at an elapsed-time rate until release or a lifecycle change. */
    const applyHeld = useCallback(timestamp => {
        if (_frame.current !== null) cancelAnimationFrame(_frame.current)
        _frame.current = null
        const gesture = _gesture.current
        if (!gesture) return
        if (!canAdjustCamera()) {
            stop()
            return
        }
        const x = gesture.axis === 'vertical' ? 0 : gesture.x
        const y = gesture.axis === 'horizontal' ? 0 : gesture.y
        if (x === 0 && y === 0) {
            gesture.lastFrameTime = null
            return
        }
        const currentTime = Number.isFinite(timestamp) ? timestamp : null
        // Bound a resumed frame so browser suspension cannot produce a camera jump.
        const elapsedSeconds = currentTime === null || gesture.lastFrameTime === null
            ? 1 / 60
            : Math.max(0, Math.min(0.1, (currentTime - gesture.lastFrameTime) / 1000))
        gesture.lastFrameTime = currentTime
        adjust(x, y, elapsedSeconds * JOYSTICK_POINTER_SENSITIVITY)
        if (_gesture.current === gesture) _frame.current = requestAnimationFrame(gesture.applyHeld)
    }, [adjust, stop])

    /** Move the projected thumb and use its deflection as the held camera adjustment rate. */
    const move = useCallback(event => {
        const gesture = _gesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        consumeInput(event)
        const radius = Math.max(1, Math.min(gesture.rect.width, gesture.rect.height) * 0.2)
        let deltaClientX = event.clientX - gesture.clientX
        let deltaClientY = event.clientY - gesture.clientY
        if (event.ctrlKey) {
            gesture.constraintOrigin ??= {x: gesture.clientX, y: gesture.clientY}
            if (!gesture.axis) {
                const travelX = event.clientX - gesture.constraintOrigin.x
                const travelY = event.clientY - gesture.constraintOrigin.y
                // Wait for a deliberate movement, then retain that axis until Ctrl is released.
                if (Math.max(Math.abs(travelX), Math.abs(travelY)) >= 3) {
                    gesture.axis = Math.abs(travelX) >= Math.abs(travelY) ? 'horizontal' : 'vertical'
                    deltaClientX = travelX
                    deltaClientY = travelY
                }
                else {
                    deltaClientX = 0
                    deltaClientY = 0
                }
            }
        }
        else {
            gesture.axis = null
            gesture.constraintOrigin = null
        }
        gesture.clientX = event.clientX
        gesture.clientY = event.clientY
        if (gesture.axis === 'horizontal') deltaClientY = 0
        if (gesture.axis === 'vertical') deltaClientX = 0
        let nextX = gesture.x + deltaClientX / radius
        let nextY = gesture.y + deltaClientY / radius
        if (gesture.axis === 'horizontal') {
            const limit = Math.sqrt(Math.max(0, 1 - gesture.y ** 2))
            nextX = Math.max(-limit, Math.min(limit, nextX))
        }
        else if (gesture.axis === 'vertical') {
            const limit = Math.sqrt(Math.max(0, 1 - gesture.x ** 2))
            nextY = Math.max(-limit, Math.min(limit, nextY))
        }
        else {
            const scale = Math.max(1, Math.hypot(nextX, nextY))
            nextX /= scale
            nextY /= scale
        }
        gesture.x = nextX
        gesture.y = nextY
        setStick({x: gesture.x, y: gesture.y})
        const x = gesture.axis === 'vertical' ? 0 : nextX
        const y = gesture.axis === 'horizontal' ? 0 : nextY
        setAction({x, y})
        if (x !== 0 || y !== 0) {
            if (_frame.current === null) _frame.current = requestAnimationFrame(gesture.applyHeld)
        }
        else {
            if (_frame.current !== null) cancelAnimationFrame(_frame.current)
            _frame.current = null
            gesture.lastFrameTime = null
        }
    }, [])

    /** Capture the thumb only, leaving the hemisphere surface available to the widget host's drag. */
    const start = useCallback(event => {
        if (event.button !== 0 || _gesture.current || !canAdjustCamera()
            || !event.target.closest?.('.replay-camera-joystick-thumb')) return
        consumeInput(event)
        const target = event.currentTarget
        target.focus({preventScroll: true})
        _gesture.current = {
            target, pointerId: event.pointerId, rect: target.getBoundingClientRect(),
            x: stick.x, y: stick.y, lastFrameTime: null, applyHeld,
            clientX: event.clientX, clientY: event.clientY, axis: null, constraintOrigin: null,
        }
        target.setPointerCapture?.(event.pointerId)
    }, [applyHeld, stick.x, stick.y])

    /** End only the pointer gesture owned by this joystick. */
    const end = useCallback(event => {
        if (_gesture.current?.pointerId !== event.pointerId) return
        consumeInput(event)
        if (event.type === 'pointerup' && _gesture.current.lastFrameTime === null) applyHeld()
        stop()
    }, [applyHeld, stop])

    /** Keep focus-scoped keyboard axes available without visible direction buttons. */
    const keyDown = useCallback(event => {
        const direction = {
            ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        }[event.key]
        if (event.key === 'Escape') {
            consumeInput(event)
            stop()
            return
        }
        if (!direction) return
        consumeInput(event)
        setStick({x: direction[0], y: direction[1]})
        setAction({x: direction[0], y: direction[1]})
        adjust(direction[0], direction[1], 0.1)
    }, [adjust, stop])

    /** Return the thumb to center when a keyboard adjustment ends. */
    const keyUp = useCallback(event => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
        consumeInput(event)
        setStick({x: 0, y: 0})
        setAction({x: 0, y: 0})
    }, [])

    const handleSceneContextLost = useCallback(() => setSceneReady(false), [])
    const handleSceneContextRestored = useCallback(() => setSceneReady(true), [])

    useEffect(() => {
        window.addEventListener('blur', stop)
        return () => {
            window.removeEventListener('blur', stop)
            stop()
        }
    }, [available, journeySlug, replay.userMode, stop])

    useEffect(() => {
        const canvasElement = _canvas.current
        const padElement = _pad.current
        if (!available || !canvasElement || !padElement) return
        setSceneReady(false)
        let cancelled = false
        let joystickScene
        import('./ReplayCameraJoystickScene').then(({createReplayCameraJoystickScene}) => {
            if (cancelled) return
            try {
                joystickScene = createReplayCameraJoystickScene({
                    canvas: canvasElement,
                    padElement,
                    onContextLost: handleSceneContextLost,
                    onContextRestored: handleSceneContextRestored,
                })
                _scene.current = joystickScene
                joystickScene.setPosition(_visualPosition.current)
                setSceneReady(true)
            }
            catch (error) {
                console.warn('Replay camera joystick could not initialize its Three.js surface', error)
            }
        }).catch(error => {
            if (!cancelled) console.warn('Replay camera joystick could not load its Three.js surface', error)
        })
        return () => {
            cancelled = true
            joystickScene?.dispose()
            if (_scene.current === joystickScene) _scene.current = null
            setSceneReady(false)
        }
    }, [available, handleSceneContextLost, handleSceneContextRestored])

    useEffect(() => {
        _visualPosition.current = stick
        _scene.current?.setPosition(stick)
    }, [stick])

    if (!available) return null

    return (
        <Widget isVisible config={CONFIG} className="replay-camera-joystick-shell">
            <div className="replay-camera-joystick">
                <div ref={_pad} className={`replay-camera-joystick-pad lgs-card wa-theme-lgs1920-on-map${sceneReady ? ' is-threejs-ready' : ''}`}
                     role="group" tabIndex={0}
                     aria-label="Drag up or down to adjust pitch, and left or right to zoom" aria-roledescription="joystick"
                     onKeyDown={keyDown} onKeyUp={keyUp} onBlur={stop}
                     onPointerDown={start} onPointerMove={move} onPointerUp={end}
                     onPointerCancel={end} onLostPointerCapture={stop} onContextMenu={consumeInput}
                     onWheel={consumeInput}>
                    <canvas ref={_canvas} className="replay-camera-joystick-canvas" aria-hidden="true"/>
                    <span className="replay-camera-joystick-thumb lgs-card wa-theme-lgs1920-on-map lgs-widget-no-drag"
                          aria-hidden="true" style={thumbStyleFrom(stick)}/>
                    {action.y !== 0 && <WaIcon className={`replay-camera-joystick-action ${action.y < 0 ? 'action-top' : 'action-bottom'}`}
                        name={action.y < 0 ? 'arrow-up' : 'arrow-down'} aria-hidden="true"/>}
                    {action.x !== 0 && <WaIcon className={`replay-camera-joystick-action ${action.x < 0 ? 'action-left' : 'action-right'}`}
                        name={action.x < 0 ? 'magnifying-glass-minus' : 'magnifying-glass-plus'} aria-hidden="true"/>}
                </div>
            </div>
        </Widget>
    )
}
