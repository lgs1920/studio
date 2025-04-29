/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackFlagsSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-04-29
 * Last modified: 2025-04-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { ToggleStateIcon }                                   from '@Components/ToggleStateIcon'
import { POI_CATEGORY_ICONS, POI_FLAG_START, POI_FLAG_STOP } from '@Core/constants'
import { faLocationPin, faLocationPinSlash }                 from '@fortawesome/pro-solid-svg-icons'
import { SlTooltip }                         from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                        from '@Utils/cesium/TrackUtils'
import { useEffect, useMemo, useState } from 'react'
import { sprintf }                      from 'sprintf-js'
import { snapshot, useSnapshot }        from 'valtio'

export const TrackFlagsSettings = (props) => {
    // Reactive snapshot of the journey editor proxy
    const $editor = lgs.stores.journeyEditor
    const editor = useSnapshot($editor)
    const $list = lgs.stores.main.components.pois.list
    const list = useSnapshot($list)

    // State management for POIs and loading
    const [startPOI, setStartPOI] = useState(null)
    const [stopPOI, setStopPOI] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    // Validate and initialize track if not exists
    if (!editor.track) {
        TrackUtils.setTheTrack(false)
    }

    // Visibility text for start flag
    const textVisibilityStartFlag = useMemo(() => {
        // Dynamically generate tooltip text based on current visibility
        return startPOI
               ? sprintf('%s Stop Flag', startPOI.visible ? 'Hide' : 'Show')
               : 'Start Flag'
    }, [startPOI?.visible])

    // Visibility text for stop flag
    const textVisibilityStopFlag = useMemo(() => {
        // Dynamically generate tooltip text based on current visibility
        return stopPOI
               ? sprintf('%s Start Flag', stopPOI.visible ? 'Hide' : 'Show')
               : 'Stop Flag'
    }, [stopPOI?.visible])

    // Initialize  POIs on component mount
    useEffect(() => {

        // Retrieve start and stop flag IDs
        const startFlagId = editor.track.flags?.start
        const stopFlagId = editor.track.flags?.stop

        // Load start POI if exists
        if (startFlagId) {
            setStartPOI(list.get(startFlagId))
        }
        // Load stop POI if exists
        if (stopFlagId) {
            setStopPOI(list.get(stopFlagId))
        }

    }, [snapshot($list), editor.track.visibility, editor.track?.flags?.start, editor.track?.flags?.stop])

    // Toggle visibility for start flag
    const setStartFlagVisibility = async (visibility) => {
        const poi = __.ui.poiManager.list.get(editor.track.flags.start)
        if (poi) {
            Object.assign(poi, {visible: visibility})
            setStartPOI(poi)
            await poi.persistToDatabase()
        }
    }

    // Toggle visibility for stop flag
    const setStopFlagVisibility = async (visibility) => {
        const poi = __.ui.poiManager.list.get(editor.track.flags.stop)
        if (poi) {
            Object.assign(poi, {visible: visibility})
            setStopPOI(poi)
            await poi.persistToDatabase()
        }
    }

    const theStartIcon = Object.values(POI_CATEGORY_ICONS.get(POI_FLAG_START))[0]
    const theEndIcon = Object.values(POI_CATEGORY_ICONS.get(POI_FLAG_STOP))[0]
    // Render flag visibility toggles
    return (
        <div>
            {startPOI && (
                <SlTooltip hoist content={textVisibilityStartFlag} placement={props.tooltip}>
                    <ToggleStateIcon
                        onChange={setStartFlagVisibility}
                        className={'flag-visibility'}
                        icons={{shown: theStartIcon, hidden: theStartIcon}}
                        style={{color: startPOI.bgColor ?? lgs.settings.journey.pois.start.color}}
                        initial={startPOI.visible}
                    />
                </SlTooltip>
            )}
            {stopPOI && (
                <SlTooltip hoist content={textVisibilityStopFlag} placement={props.tooltip}>
                    <ToggleStateIcon
                        onChange={setStopFlagVisibility}
                        className={'flag-visibility'}
                        icons={{shown: theEndIcon, hidden: theEndIcon}}
                        style={{color: stopPOI.bgColor ?? lgs.settings.journey.pois.stop.color}}
                        initial={stopPOI.visible}
                    />
                </SlTooltip>
            )}
        </div>
    )
}