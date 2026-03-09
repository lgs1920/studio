/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotateButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-09
 * Last modified: 2026-03-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NONE, POI_STANDARD_TYPE } from '@Core/constants'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }       from '@Utils/FA2SL.js'
import { faArrowRotateRight }          from '@fortawesome/pro-regular-svg-icons'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useMemo }  from 'react'
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
    const {rotate} = useSnapshot(lgs.stores.ui.mainUI)
    const {target, position} = useSnapshot(lgs.stores.main.components.camera)
    const {current} = useSnapshot(lgs.stores.main.components.pois)
    const sceneTarget = __.ui.sceneManager.target

    /**
     * Memoized check for whether the scene target is a POI.
     * @type {boolean}
     */
    const isPOITarget = useMemo(() => {
        return sceneTarget?.element === POI_STANDARD_TYPE
    }, [sceneTarget?.element])

    /**
     * Toggles map rotation and updates POI animation state if applicable.
     * @async
     * @function
     * @returns {Promise<void>}
     */
    const handleRotation = useCallback(async () => {
        const poi = isPOITarget && current ? lgs.stores.main.components.pois.list.get(current) : null

        try {
            if (rotate.running) {
                await __.ui.cameraManager.stopRotate()
                if (poi && poi.animated) {
                    poi.animated = false
                }
                return
            }

            await __.ui.sceneManager.focus(target, {
                ...position,
                infinite:   true,
                rotate:     true,
                flyingTime: 0,
                target:     FOCUS_TARGET,
            })
            if (poi && !poi.animated) {
                poi.animated = true
            }
        }
        catch (error) {
            console.error('Failed to toggle map rotation:', {error, target, rotate: rotate.running})
        }
    }, [rotate.running, target, position, current, isPOITarget])

    return (<>
            <WaTooltip for="launch-rotation"
                       placement={tooltip}>{rotate.running ? TOOLTIP_STOP : TOOLTIP_START}</WaTooltip>
            <WaButton
                className="square-button rotation-button"
                id="launch-rotation"
                onClick={handleRotation}
                variant={'brand'}
                appearance="Filled"
            >
                <WaIcon name="arrows-rotate" animation={rotate.running ? 'spin' : 'none'} variant="regular"/>
            </WaButton>
        </>
    )
})