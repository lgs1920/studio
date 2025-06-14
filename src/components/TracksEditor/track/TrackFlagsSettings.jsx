/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackFlagsSettings.jsx
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

import { ToggleStateIcon }          from '@Components/ToggleStateIcon'
import { POI_CATEGORY_ICONS, POI_FLAG_START, POI_FLAG_STOP } from '@Core/constants'
import { SlTooltip }                from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }               from '@Utils/cesium/TrackUtils'
import { memo, useEffect, useMemo } from 'react'
import { sprintf }                  from 'sprintf-js'
import { useSnapshot }              from 'valtio'

// Static icons defined outside the component to avoid recalculation
const START_ICON = Object.values(POI_CATEGORY_ICONS.get(POI_FLAG_START))[0]
const STOP_ICON = Object.values(POI_CATEGORY_ICONS.get(POI_FLAG_STOP))[0]

/**
 * A memoized React component for toggling the visibility of start and stop flags in a journey track.
 * @param {Object} props - Component props
 * @param {string} props.tooltip - Tooltip placement (e.g., 'top', 'bottom')
 * @returns {JSX.Element} The rendered component
 */
export const TrackFlagsSettings = memo(({tooltip}) => {
    // Reactive snapshots limited to necessary properties
    const {track} = useSnapshot(lgs.stores.journeyEditor)
    const list = useSnapshot(lgs.stores.main.components.pois.list)

    // Initialize track if undefined
    useEffect(() => {
        if (!track) {
            TrackUtils.setTheTrack(false)
        }
    }, [track])

    // Derive POIs directly from snapshots
    const startPOI = track?.flags?.start ? list.get(track.flags.start) : null
    const stopPOI = track?.flags?.stop ? list.get(track.flags.stop) : null

    // Memoized tooltip text for start flag
    const textVisibilityStartFlag = useMemo(() => {
        return startPOI
               ? sprintf('%s Start Flag', startPOI.visible ? 'Hide' : 'Show')
               : 'Start Flag'
    }, [startPOI?.visible])

    // Memoized tooltip text for stop flag
    const textVisibilityStopFlag = useMemo(() => {
        return stopPOI
               ? sprintf('%s Stop Flag', stopPOI.visible ? 'Hide' : 'Show')
               : 'Stop Flag'
    }, [stopPOI?.visible])

    // Memoized styles to avoid recalculation
    const startStyle = useMemo(() => ({
        color: startPOI?.bgColor ?? lgs.settings.journey.pois.start.color,
    }), [startPOI?.bgColor])

    const stopStyle = useMemo(() => ({
        color: stopPOI?.bgColor ?? lgs.settings.journey.pois.stop.color,
    }), [stopPOI?.bgColor])

    /**
     * Toggles the visibility of the start flag and persists the change to the database.
     * @param {boolean} visibility - The new visibility state
     * @returns {Promise<void>}
     */
    const setStartFlagVisibility = async (visibility) => {
        if (!track?.flags?.start) {
            return
        }
        const poi = __.ui.poiManager.list.get(track.flags.start)
        if (poi && poi.visible !== visibility) {
            try {
                poi.visible = visibility
                await poi.persistToDatabase()
            }
            catch (error) {
                console.error('Failed to persist start POI:', error)
            }
        }
    }

    /**
     * Toggles the visibility of the stop flag and persists the change to the database.
     * @param {boolean} visibility - The new visibility state
     * @returns {Promise<void>}
     */
    const setStopFlagVisibility = async (visibility) => {
        if (!track?.flags?.stop) {
            return
        }
        const poi = __.ui.poiManager.list.get(track.flags.stop)
        if (poi && poi.visible !== visibility) {
            try {
                poi.visible = visibility
                await poi.persistToDatabase()
            }
            catch (error) {
                console.error('Failed to persist stop POI:', error)
            }
        }
    }

    return (
        <div>
            {startPOI && (
                <SlTooltip hoist content={textVisibilityStartFlag} placement={tooltip}>
                    <ToggleStateIcon
                        onChange={setStartFlagVisibility}
                        className="flag-visibility"
                        icons={{shown: START_ICON, hidden: START_ICON}}
                        style={startStyle}
                        initial={startPOI.visible}
                    />
                </SlTooltip>
            )}
            {stopPOI && (
                <SlTooltip hoist content={textVisibilityStopFlag} placement={tooltip}>
                    <ToggleStateIcon
                        onChange={setStopFlagVisibility}
                        className="flag-visibility"
                        icons={{shown: STOP_ICON, hidden: STOP_ICON}}
                        style={stopStyle}
                        initial={stopPOI.visible}
                    />
                </SlTooltip>
            )}
        </div>
    )
})