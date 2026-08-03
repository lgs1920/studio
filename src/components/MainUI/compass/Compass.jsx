/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Compass.jsx
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

import { CompassFull }  from '@Components/MainUI/compass/CompassFull'
import { CompassLight } from '@Components/MainUI/compass/CompassLight'
import { CompassFlat }  from '@Components/MainUI/compass/CompassFlat'
import { CompassModern }                            from '@Components/MainUI/compass/CompassModern'
import { resolveCompassWidgetDimensions }            from '@Components/MainUI/compass/CompassWidgetBounds'
import { COMPASS_FLAT, COMPASS_FULL, COMPASS_LIGHT, COMPASS_MODERN } from '@Core/constants'
import { Math as CMath }               from 'cesium'
import classNames                      from 'classnames'
import { colord }                                  from 'colord'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useSnapshot }                 from 'valtio'

/**
 * Compass component.
 * Synchronizes with the camera heading and resolves theme colors via global __ utility.
 */
export const Compass = ({fixed, inWidget = false, entity, syncBounds = true}) => {
    const _rotatingPart = useRef(null)
    const _compass = useRef(null)
    const _doubleTapTimeout = useRef(null)
    const _animationFrame = useRef(null)
    const _lastHeading = useRef(null)
    const _lastMode = useRef(null)

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

    const toCompassKebab = useCallback((str) => {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/\./g, '-').toLowerCase()
    }, [])

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
                const varName = `--lgs-compass-${toCompassKebab(path)}`
                const colorObj = colord(resolveColor(part.color))

                // If part.opacity is null/undefined, use the resolved color's native alpha
                vars[varName] = colorObj.alpha(part.opacity ?? colorObj.alpha()).toRgbString()
            }
        })
        return vars
    }, [activeConfig, toCompassKebab])

    /**
     * Synchronizes widget bounds after initial rendering or a compass mode change.
     *
     * @param {boolean} forceResize - Whether to measure the newly selected compass mode.
     */
    const syncWidgetBounds = useCallback((forceResize = false) => {
        if (!syncBounds || !inWidget || !entity || !_compass.current) {
            return
        }

        const widgetElement = __.ui.widgetManager.getElementById(entity) ?? _compass.current.closest('.lgs-widget')
        if (!widgetElement) {
            return
        }

        const elementId = __.ui.widgetManager.retrieveElementId(widgetElement) ?? entity
        const config = __.ui.widgetManager.getWidgetConfig(elementId)
        const moveable = __.ui.widgetManager.getMoveable(elementId)

        if (!config) {
            moveable?.current?.updateRect()
            return
        }

        const previousWidth = config.dimensions?.width || widgetElement.offsetWidth
        const previousHeight = config.dimensions?.height || widgetElement.offsetHeight
        const previousLeft = Number.isFinite(config.position?.left)
                             ? config.position.left
                             : parseFloat(widgetElement.style.left || '')
        const previousTop = Number.isFinite(config.position?.top)
                            ? config.position.top
                            : parseFloat(widgetElement.style.top || '')
        const centerX = Number.isFinite(previousLeft) ? previousLeft + previousWidth / 2 : null
        const centerY = Number.isFinite(previousTop) ? previousTop + previousHeight / 2 : null

        let nextWidth = config.dimensions?.width
        let nextHeight = config.dimensions?.height

        if (forceResize || !Number.isFinite(nextWidth) || nextWidth <= 0 || !Number.isFinite(nextHeight) || nextHeight <= 0) {
            widgetElement.style.width = ''
            widgetElement.style.height = ''

            const compassStyle = window.getComputedStyle(_compass.current)
            const styledWidth = parseFloat(compassStyle.width || '')
            const styledHeight = parseFloat(compassStyle.height || '')
            const compassRect = _compass.current.getBoundingClientRect()
            const dimensions = resolveCompassWidgetDimensions({
                config: config,
                forceResize: true,
                styledWidth: styledWidth,
                styledHeight: styledHeight,
                fallbackWidth: _compass.current.offsetWidth || compassRect.width,
                fallbackHeight: _compass.current.offsetHeight || compassRect.height,
            })
            nextWidth = dimensions.width
            nextHeight = dimensions.height
        }

        if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth <= 0 || nextHeight <= 0) {
            moveable?.current?.updateRect()
            return
        }

        const width = Math.round(nextWidth * 100) / 100
        const height = Math.round(nextHeight * 100) / 100
        const dimensionsChanged = Math.abs(previousWidth - width) > 0.5 || Math.abs(previousHeight - height) > 0.5
        config.dimensions = {width, height}
        widgetElement.style.width = `${width}px`
        widgetElement.style.height = `${height}px`

        if (centerX !== null && centerY !== null) {
            config.position = {
                left: centerX - width / 2,
                top:  centerY - height / 2,
            }

            const boundsContainer = config.boundsContainer ?? config.container
            const boundsRect = boundsContainer?.getBoundingClientRect?.()
            if (boundsRect) {
                config.position = __.ui.widgetManager.adaptPositionToContainer(config, boundsRect)
            }

            widgetElement.style.left = `${config.position.left}px`
            widgetElement.style.top = `${config.position.top}px`
        }

        const positionChanged = centerX !== null && centerY !== null &&
            (Math.abs((config.position?.left ?? previousLeft) - previousLeft) > 0.5 ||
             Math.abs((config.position?.top ?? previousTop) - previousTop) > 0.5)

        if (config.persist && config.runtimeReady && (dimensionsChanged || positionChanged)) {
            void __.ui.widgetManager.saveWidgetPosition(elementId, config)
        }

        moveable?.current?.updateRect()
    }, [entity, inWidget, syncBounds])

    useEffect(() => {
        const currentModeString = currentMode?.toString()
        const modeChanged = _lastMode.current !== null && _lastMode.current !== currentModeString
        _lastMode.current = currentModeString
        const hasVisualMode = currentModeString === COMPASS_FULL.toString() ||
            currentModeString === COMPASS_LIGHT.toString() ||
            currentModeString === COMPASS_MODERN.toString() ||
            currentModeString === COMPASS_FLAT.toString()
        if (!syncBounds || !inWidget || !hasVisualMode) {
            return
        }

        let firstFrame = null
        let secondFrame = null

        firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => syncWidgetBounds(modeChanged))
        })

        return () => {
            if (firstFrame !== null) {
                window.cancelAnimationFrame(firstFrame)
            }
            if (secondFrame !== null) {
                window.cancelAnimationFrame(secondFrame)
            }
        }
    }, [currentMode, inWidget, syncBounds, syncWidgetBounds])

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
                'mode-full':      currentMode.toString() === COMPASS_FULL.toString(),
                'mode-light':     currentMode.toString() === COMPASS_LIGHT.toString(),
                'mode-modern':    currentMode.toString() === COMPASS_MODERN.toString(),
                'mode-flat':      currentMode.toString() === COMPASS_FLAT.toString(),
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
            {currentMode.toString() === COMPASS_MODERN.toString() && (
                <CompassModern ref={_rotatingPart}/>
            )}
            {currentMode.toString() === COMPASS_FLAT.toString() && (
                <CompassFlat ref={_rotatingPart}/>
            )}
        </div>
    )
}
