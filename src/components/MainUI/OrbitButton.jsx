/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: OrbitButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-01-29
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_MAP_POINT, CURRENT_POI }           from '@Core/constants'
import { MapTarget }                               from '@Core/MapTarget'
import { getOrbitSettings, setOrbitStoreSettings } from '@Core/OrbitSettings'
import { getMainSceneCameraPivot }                  from '@Core/ui/MainSceneCameraPivot'
import { UI_ACTIONS }                              from '@Core/ui/metadata/uiActionCatalog'
import { WaButton, WaIcon, WaTooltip } from '@awesome.me/webawesome/dist/react'
import { Cartographic, Math as CesiumMath } from 'cesium'
import { memo, useCallback }                       from 'react'
import { useSnapshot } from 'valtio'

/** @constant {string} FOCUS_TARGET - Target identifier for camera focus */
const FOCUS_TARGET = 'target'
const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const normalizedFocusPoint = point => {
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)
    const pointHeight = finiteNumber(point?.height)
    const simulatedHeight = finiteNumber(point?.simulatedHeight)
    const height = simulatedHeight ?? pointHeight

    if ([longitude, latitude, height].some(value => value === null)) {
        return null
    }

    const normalizedPoint = {
        ...point,
        longitude,
        latitude,
        height: pointHeight ?? height,
    }

    if (simulatedHeight !== null) {
        normalizedPoint.simulatedHeight = simulatedHeight
    }
    else {
        delete normalizedPoint.simulatedHeight
    }

    return normalizedPoint
}

const selectedPivotTarget = () => {
    const scene = lgs.scene ?? lgs.viewer?.scene
    const camera = lgs.camera ?? lgs.viewer?.camera
    const pivot = getMainSceneCameraPivot(scene, camera)
    const cartographic = pivot ? Cartographic.fromCartesian(pivot) : null
    if (!cartographic) return null

    const longitude = CesiumMath.toDegrees(cartographic.longitude)
    const latitude = CesiumMath.toDegrees(cartographic.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

    const height = __.ui.sceneManager?.noRelief?.() ? 0 : cartographic.height
    const id = `${CURRENT_MAP_POINT}:${longitude.toFixed(6)}:${latitude.toFixed(6)}`
    const point = new MapTarget(CURRENT_MAP_POINT, {height, id, latitude, longitude})
    point.simulatedHeight = height
    point.title = 'Map pivot'
    return point
}

/**
 * A memoized React component for toggling map orbit around a target.
 * @param {Object} props - Component props
 * @param {string} [props.tooltip='top'] - Tooltip placement (e.g., 'top', 'bottom', 'left', 'right')
 * @returns {JSX.Element} The rendered OrbitButton component
 */
export const OrbitButton = memo(({tooltip = 'top'}) => {
    // Targeted snapshots to minimize re-renders
    const {rotate, panorama} = useSnapshot(lgs.stores.ui.mainUI)
    const replayState = useSnapshot(lgs.stores.replay)
    const {target, position} = useSnapshot(lgs.stores.main.components.camera)
    const orbitTarget = rotate.target
    const sceneTarget = __.ui.sceneManager.target
    const replayActive = replayState.active || replayState.playing || replayState.paused
    const orbitAllowedByJourneyReplay = !replayActive && replayState.orbitAllowed !== false
    const disableOrbitStart = !orbitAllowedByJourneyReplay && !rotate.running && !panorama.active

    /**
     * Toggles map orbit and updates POI animation state if applicable.
     * @async
     * @function
     * @returns {Promise<void>}
     */
    const handleOrbit = useCallback(async () => {
        const focusTarget = sceneTarget?.element ? sceneTarget : null
        const poiFocusTarget = focusTarget?.element === CURRENT_POI
            ? focusTarget
            : target?.element === CURRENT_POI ? target : null
        const poi = poiFocusTarget
                    ? lgs.stores.main.components.pois.list.get(poiFocusTarget.slug ?? poiFocusTarget.id)
                    : null

        try {
            if (panorama.active) {
                lgs.stores.ui.mainUI.panorama.active = false
                lgs.stores.ui.mainUI.panorama.target = false
                if (poi && poi.animated) {
                    poi.animated = false
                }
                return
            }

            if (rotate.running) {
                await __.ui.cameraManager.stopRotate()
                if (poi && poi.animated) {
                    poi.animated = false
                }
                return
            }

            const pivotTarget = poiFocusTarget ? null : selectedPivotTarget()
            const orbitFocusTarget = poiFocusTarget ?? pivotTarget ?? focusTarget
            const focusPoint = normalizedFocusPoint(poiFocusTarget)
                ?? normalizedFocusPoint(pivotTarget)
                ?? normalizedFocusPoint(target)
                ?? normalizedFocusPoint(focusTarget)
                ?? normalizedFocusPoint(orbitTarget)
            if (!focusPoint) {
                console.warn('Cannot start map orbit without a valid target', {target, sceneTarget, orbitTarget})
                return
            }

            const orbitSettings = getOrbitSettings(orbitFocusTarget ?? focusPoint, 'rotation', lgs.stores.ui.mainUI.rotate)
            setOrbitStoreSettings(lgs.stores.ui.mainUI.rotate, orbitSettings)
            await __.ui.sceneManager.focus(focusPoint, {
                direction: orbitSettings.direction,
                ...position,
                infinite:   true,
                preserveView: true,
                rotate:     true,
                flyingTime: 0,
                rpm:       orbitSettings.rpm,
                target:    orbitFocusTarget ?? FOCUS_TARGET,
            })
            if (poi && !poi.animated) {
                poi.animated = true
            }
        }
        catch (error) {
            console.error('Failed to toggle map orbit:', {error, target, rotate: rotate.running})
        }
    }, [panorama.active, rotate.running, orbitTarget, target, position, sceneTarget])

    return (<>
            <WaTooltip for="launch-orbit"
                       placement={tooltip}>{rotate.running || panorama.active ? UI_ACTIONS.stopOrbit.label : UI_ACTIONS.startOrbit.label}</WaTooltip>
            <WaButton
                className="square-button orbit-button"
                id="launch-orbit"
                onClick={handleOrbit}
                disabled={disableOrbitStart}
                variant={'brand'}
                appearance="Filled"
            >
                <WaIcon {...(rotate.running || panorama.active ? UI_ACTIONS.stopOrbit.icon : UI_ACTIONS.startOrbit.icon)}/>
            </WaButton>
        </>
    )
})
