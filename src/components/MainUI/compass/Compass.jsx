/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Compass.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CompassFull }  from '@Components/MainUI/compass/CompassFull'
import { CompassLight } from '@Components/MainUI/compass/CompassLight'
import { COMPASS_FULL, COMPASS_LIGHT } from '@Core/constants'
import { Math as CMath }               from 'cesium'
import classNames                      from 'classnames'
import { colord }                                  from 'colord'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useSnapshot }                 from 'valtio'

/**
 * Compass component.
 * Synchronizes with the camera heading and resolves theme colors via global __ utility.
 */
export const Compass = ({fixed, inWidget = false, entity}) => {
    const _rotatingPart = useRef(null)
    const _compass = useRef(null)
    const _doubleTapTimeout = useRef(null)
    const _animationFrame = useRef(null)
    const _lastHeading = useRef(null)

    // Store Proxies
    const $globalCompass = lgs.settings.ui.compass
    const $widgetConfig = lgs.settings.widgets['compass-widget'].configuration

    // Snapshots
    const globalCompass = useSnapshot($globalCompass)
    const widgetConfig = useSnapshot($widgetConfig)

    // Configuration priority: entity-specific > user-defined > default
    const element = useMemo(() => {
        if (!entity) {
            return widgetConfig.user ?? widgetConfig.default
        }
        return widgetConfig.elements?.[entity] ?? widgetConfig.user ?? widgetConfig.default
    }, [entity, widgetConfig])

    const activeConfig = inWidget ? element : globalCompass
    const currentMode = activeConfig?.mode
    const baseTransform = useMemo(
        () => currentMode?.toString() === COMPASS_LIGHT.toString() ? 'scale(1.2)' : '',
        [currentMode],
    )

    /**
     * Resolves a CSS variable string to its computed value recursively.
     * Uses the global utility __.ui.css.getCSSVariable.
     */
    const resolveColor = (color) => {
        if (!color || typeof color !== 'string') {
            return color
        }
        let finalColor = color
        while (typeof finalColor === 'string' && finalColor.startsWith('--')) {
            const resolved = __.ui.css.getCSSVariable(finalColor)
            if (!resolved || resolved === finalColor) {
                break
            }
            finalColor = resolved
        }
        return finalColor
    }

    /**
     * Updates the rotation of the referenced element based on camera heading.
     */
    const updateRotation = useCallback(() => {
        const rotatingPart = _rotatingPart.current
        if (!rotatingPart) {
            return
        }

        const headingDegrees = ((-CMath.toDegrees(lgs.camera.heading) % 360) + 360) % 360
        if (_lastHeading.current === headingDegrees) {
            return
        }

        rotatingPart.style.transform = baseTransform
                                       ? `rotate(${headingDegrees}deg) ${baseTransform}`
                                       : `rotate(${headingDegrees}deg)`
        _lastHeading.current = headingDegrees
    }, [baseTransform])

    /**
     * Maps store configuration to CSS variables.
     * Preserves the original alpha of the resolved color if no store opacity is set.
     */
    const dynamicVars = useMemo(() => {
        const paths = [
            'background', 'overBackground', 'poles', 'text',
            'needle.north', 'needle.south', 'needle.center',
        ]
        const vars = {}

        paths.forEach(path => {
            const keys = path.split('.')
            let part = activeConfig
            for (const key of keys) {
                part = part?.[key]
            }

            if (part?.color) {
                const varName = `--lgs-compass-${path.replace(/\./g, '-')}`
                const colorObj = colord(resolveColor(part.color))

                // If part.opacity is null/undefined, use the resolved color's native alpha
                vars[varName] = colorObj.alpha(part.opacity ?? colorObj.alpha()).toRgbString()
            }
        })
        return vars
    }, [activeConfig])

    useEffect(() => {
        /**
         * Resets camera heading to North.
         */
        const resetToNorth = () => {
            if (__.ui.cameraManager.isRotating()) {
                return
            }
            const camera = lgs.stores.main.components.camera
            camera.position.heading = CMath.toRadians(0)
            __.ui.sceneManager.focus(camera.target, {
                heading:  0, pitch: camera.position.pitch, roll: 0, range: camera.position.range,
                infinite: true, rotate: false, flyingTime: 0, target: null,
            })
        }

        const handleDoubleTap = () => {
            if (_doubleTapTimeout.current) {
                clearTimeout(_doubleTapTimeout.current)
                _doubleTapTimeout.current = null
                resetToNorth()
            }
            else {
                _doubleTapTimeout.current = setTimeout(() => {
                    _doubleTapTimeout.current = null
                }, 300)
            }
        }

        const el = _compass.current
        if (el) {
            el.addEventListener('dblclick', resetToNorth)
            el.addEventListener('touchend', handleDoubleTap)
        }

        if (!fixed) {
            const tick = () => {
                updateRotation()
                _animationFrame.current = window.requestAnimationFrame(tick)
            }

            updateRotation()
            _animationFrame.current = window.requestAnimationFrame(tick)
        }

        return () => {
            if (el) {
                el.removeEventListener('dblclick', resetToNorth)
                el.removeEventListener('touchend', handleDoubleTap)
            }

            if (_animationFrame.current !== null) {
                window.cancelAnimationFrame(_animationFrame.current)
                _animationFrame.current = null
            }
        }
    }, [fixed, currentMode, updateRotation])

    // Post-render effect to maintain rotation during Valtio re-renders
    useEffect(() => {
        _lastHeading.current = null
        if (!fixed) {
            updateRotation()
        }
    }, [currentMode, fixed, updateRotation])

    if (!currentMode) {
        return null
    }

    return (
        <div
            className={classNames('lgs-compass', {
                'mode-full':  currentMode.toString() === COMPASS_FULL.toString(),
                'mode-light': currentMode.toString() === COMPASS_LIGHT.toString(),
            })}
            ref={_compass}
            style={dynamicVars}
        >
            {currentMode.toString() === COMPASS_FULL.toString() && (
                <CompassFull ref={_rotatingPart}/>
            )}
            {currentMode.toString() === COMPASS_LIGHT.toString() && (
                <CompassLight ref={_rotatingPart}/>
            )}
        </div>
    )
}
