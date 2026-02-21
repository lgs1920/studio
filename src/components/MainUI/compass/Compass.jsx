/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Compass.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-21
 * Last modified: 2026-02-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CompassFull }  from '@Components/MainUI/compass/CompassFull'
import { CompassLight } from '@Components/MainUI/compass/CompassLight'

import { COMPASS_FULL, COMPASS_LIGHT } from '@Core/constants'
import { Math as CMath }               from 'cesium'
import classNames                      from 'classnames'
import { useEffect, useRef }           from 'react'
import { useSnapshot }                 from 'valtio'

/**
 * Compass component that synchronizes with the camera heading.
 */
export const Compass = ({fixed, colors = {}, inWidget = false, entity}) => {
    const _needle = useRef(null)
    const _compass = useRef(null)
    const _doubleTapTimeout = useRef(null)

    // Global configuration proxy
    const $globalCompass = lgs.settings.ui.compass

    // Widget configuration proxy (handle potential undefined entity)
    const $widgetConfig = lgs.settings.widgets['compass-widget'].configuration
    const $widgetElement = entity
                           ? ($widgetConfig.elements?.[entity] ?? $widgetConfig.user ?? $widgetConfig.default)
                           : ($widgetConfig.user ?? $widgetConfig.default)

    // Snapshots for reactivity
    const globalCompass = useSnapshot($globalCompass)
    const widgetElement = useSnapshot($widgetElement)

    // Select the source of truth based on the context
    // This ensures activeConfig is never null
    const activeConfig = inWidget ? widgetElement : globalCompass

    useEffect(() => {
        /**
         * Synchronizes the compass needle with the camera's heading.
         */
        const rotateCompass = () => {
            if (_needle.current) {
                const headingDegrees = -CMath.toDegrees(lgs.camera.heading) % 360
                _needle.current.style.transform = `rotate(${headingDegrees}deg)`
            }
        }

        /**
         * Resets camera heading to North (0°).
         */
        const resetToNorth = () => {
            if (__.ui.cameraManager.isRotating()) {
                return
            }

            const camera = lgs.mainProxy.components.camera
            camera.position.heading = CMath.toRadians(0)

            __.ui.sceneManager.focus(camera.target, {
                heading:    camera.position.heading,
                pitch:      camera.position.pitch,
                roll:       camera.position.roll,
                range:      camera.position.range,
                infinite:   true,
                rotate:     false,
                flyingTime: 0,
                target:     null,
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

        const compassElement = _compass.current
        if (compassElement) {
            compassElement.addEventListener('dblclick', resetToNorth)
            compassElement.addEventListener('touchend', handleDoubleTap)
        }

        if (!fixed) {
            lgs.camera.changed.addEventListener(rotateCompass)
            rotateCompass()
        }

        return () => {
            if (compassElement) {
                compassElement.removeEventListener('dblclick', resetToNorth)
                compassElement.removeEventListener('touchend', handleDoubleTap)
            }
            lgs.camera.changed.removeEventListener(rotateCompass)
        }
    }, [fixed])

    // Mode to class mapping
    const modeClasses = {
        [COMPASS_FULL]:  'mode-full',
        [COMPASS_LIGHT]: 'mode-light',
    }

    // Use currentMode from the selected active configuration
    const currentMode = activeConfig?.mode

    if (!currentMode) {
        return null
    }

    return (
        <div className={classNames('lgs-compass', modeClasses[currentMode])} ref={_compass}>
            {currentMode.toString() === COMPASS_FULL.toString() && (
                <CompassFull ref={_needle} colors={colors}/>
            )}
            {currentMode.toString() === COMPASS_LIGHT.toString() && (
                <CompassLight ref={_needle} colors={colors}/>
            )}
        </div>
    )
}