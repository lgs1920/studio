/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotateButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-26
 * Last modified: 2026-04-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_POI }                             from '@Core/constants'
import { getOrbitSettings, setOrbitStoreSettings } from '@Core/OrbitSettings'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback }                       from 'react'
import { useSnapshot } from 'valtio'

/** @constant {string} FOCUS_TARGET - Target identifier for camera focus */
const FOCUS_TARGET = 'target'
/** @constant {string} TOOLTIP_STOP - Tooltip text when rotation is active */
const TOOLTIP_STOP = 'Stop Map Rotation'
/** @constant {string} TOOLTIP_START - Tooltip text when rotation is inactive */
const TOOLTIP_START = 'Start Map Rotation'

/**
 * A memoized React component for toggling map rotation around a target.
 * @param {Object} props - Component props
 * @param {string} [props.tooltip='top'] - Tooltip placement (e.g., 'top', 'bottom', 'left', 'right')
 * @returns {JSX.Element} The rendered RotateButton component
 */
export const RotateButton = memo(({tooltip = 'top'}) => {
    // Targeted snapshots to minimize re-renders
    const {rotate, panorama} = useSnapshot(lgs.stores.ui.mainUI)
    const {target, position} = useSnapshot(lgs.stores.main.components.camera)
    const sceneTarget = __.ui.sceneManager.target

    /**
     * Toggles map rotation and updates POI animation state if applicable.
     * @async
     * @function
     * @returns {Promise<void>}
     */
    const handleRotation = useCallback(async () => {
        const focusTarget = sceneTarget?.element ? sceneTarget : null
        const poi = focusTarget?.element === CURRENT_POI
                    ? lgs.stores.main.components.pois.list.get(focusTarget.slug ?? focusTarget.id)
                    : null
        const rotationSettings = getOrbitSettings(focusTarget, 'rotation')

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

            setOrbitStoreSettings(lgs.stores.ui.mainUI.rotate, rotationSettings)
            await __.ui.sceneManager.focus(target, {
                direction: rotationSettings.direction,
                ...position,
                infinite:   true,
                rotate:     true,
                flyingTime: 0,
                rpm:       rotationSettings.rpm,
                target:    focusTarget ?? FOCUS_TARGET,
            })
            if (poi && !poi.animated) {
                poi.animated = true
            }
        }
        catch (error) {
            console.error('Failed to toggle map rotation:', {error, target, rotate: rotate.running})
        }
    }, [panorama.active, rotate.running, target, position, sceneTarget])

    return (<>
            <WaTooltip for="launch-rotation"
                       placement={tooltip}>{rotate.running || panorama.active ? TOOLTIP_STOP : TOOLTIP_START}</WaTooltip>
            <WaButton
                className="square-button rotation-button"
                id="launch-rotation"
                onClick={handleRotation}
                variant={'brand'}
                appearance="Filled"
            >
                <WaIcon name="arrows-rotate" animation={rotate.running || panorama.active ? 'spin' : 'none'}
                        variant="regular"/>
            </WaButton>
        </>
    )
})
