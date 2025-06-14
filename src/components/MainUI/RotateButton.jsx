/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RotateButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-14
 * Last modified: 2025-06-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { NONE, POI_STANDARD_TYPE } from '@Core/constants'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL.js'
import { faArrowRotateRight } from '@fortawesome/pro-regular-svg-icons'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot }                from 'valtio'

// Static icon name to avoid recalculation
const ICON_NAME = FA2SL.set(faArrowRotateRight)
const FOCUS_TARGET = 'target'

/**
 * A memoized React component for toggling map rotation around a target.
 * @param {Object} props - Component props
 * @param {string} [props.tooltip='top'] - Tooltip placement (e.g., 'top', 'bottom')
 * @returns {JSX.Element} The rendered component
 */
export const RotateButton = memo(({tooltip = 'top'}) => {
    // Targeted snapshots to minimize re-renders
    const {rotate} = useSnapshot(lgs.stores.main.components.mainUI)
    const {target, position} = useSnapshot(lgs.stores.main.components.camera)
    const {list, current} = useSnapshot(lgs.stores.main.components.pois)

    // Memoized scene target check
    const isPOITarget = useMemo(() => {
        return __.ui.sceneManager.target?.element === POI_STANDARD_TYPE
    }, [__.ui.sceneManager.target])

    /**
     * Toggles map rotation and updates POI animation state if applicable.
     * @returns {Promise<void>}
     */
    const handleRotation = useCallback(async () => {
        const poi = isPOITarget && current ? list.get(current) : null

        try {
            if (rotate.running) {
                await __.ui.cameraManager.stopRotate()
                if (poi && poi.animated !== false) {
                    poi.animated = false
                }
            }
            else {
                await __.ui.sceneManager.focus(target, {
                    heading:    position.heading,
                    pitch:      position.pitch,
                    roll:       position.roll,
                    range:      position.range,
                    infinite:   true,
                    rotate:     true,
                    flyingTime: 0,
                    target:     FOCUS_TARGET,
                })
                if (poi && poi.animated !== true) {
                    poi.animated = true
                }
            }
        }
        catch (error) {
            console.error('Failed to toggle map rotation:', error)
        }
    }, [rotate.running, target, position, current, isPOITarget, list])

    return (
        <SlTooltip hoist placement={tooltip} content={rotate.running ? 'Stop Map Rotation' : 'Start Map Rotation'}>
            <SlButton
                size="small"
                className="square-button"
                id="launch-rotation"
                onClick={handleRotation}
                loading={rotate.running}
            >
                <SlIcon slot="prefix" library="fa" name={ICON_NAME}/>
            </SlButton>
        </SlTooltip>
    )
})