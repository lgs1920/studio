/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-12-13
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                                                       from '@Components/MainUI/widgets/Widget'
import {
    HOUR, JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD, VIDEO_WIDGETS_BOARD,
} from '@Core/constants'
import { isJourneyReplayBasicMode } from '@Core/ui/replay/ReplayUserModeConstants'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                                                                  from 'valtio'
import { ProfileChart }                                                                 from './ProfileChart'
import './style.css'

const PROFILE_WIDGET_CONTEXT_FALLBACK = {widgetEditor: false, widgetsBoard: ''}
const PROFILE_WIDGET_FREE_RATIO = {value: '0x0', aspectRatio: 0, locked: false}
const PROFILE_WIDGET_DEFAULT_DIMENSIONS = {width: 500, height: 200}
const PROFILE_WIDGET_DEFAULT_ASPECT_RATIO = PROFILE_WIDGET_DEFAULT_DIMENSIONS.width / PROFILE_WIDGET_DEFAULT_DIMENSIONS.height
const BASIC_REPLAY_PROFILE_MAX_WIDTH = 200
const BASIC_REPLAY_PROFILE_CROP_WIDTH_RATIO = 0.7

/**
 * The Profile Widget component displays the elevation profile chart and handles widget configuration.
 *
 * @param {Object} props - Component properties.
 * @param {string} props.id - Unique ID of the widget instance.
 * @param {Object} props.context - Widget rendering context.
 * @returns {JSX.Element | null}
 */
export const ProfileWidget = ({id, context, zIndex, widgetsBoard: persistedWidgetsBoard}) => {
    const contextState = useOptionalSnapshot(context, PROFILE_WIDGET_CONTEXT_FALLBACK)
    const journey = lgs.theJourney
    const journeySlug = journey?.slug ?? null
    const widgetsBoard = contextState.widgetsBoard || persistedWidgetsBoard || ''
    const replay = useSnapshot(lgs.stores.replay)
    const replaySettings = useSnapshot(lgs.settings.ui.replay)
    const basicReplayProfile = widgetsBoard === VIDEO_WIDGETS_BOARD
        && isJourneyReplayBasicMode({replay, settings: replaySettings})
    const [lastValidData, setLastValidData] = useState({journeySlug: null, data: null})

    /**
     * Proxy and Snapshot for the profile component state.
     */
    const $profile = lgs.stores.main.components.profile
    const profile = useSnapshot($profile)

    /**
     * Proxy and Snapshot for the unit system.
     */
    const $unitStore = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitStore)
    const widgetListSnapshot = useSnapshot(lgs.stores.ui.widget.list)

    /**
     * State for the container element where the widget should attach.
     */
    const container = useMemo(() => __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard) ?? lgs.canvas, [widgetsBoard])
    const profileDimensions = useMemo(() => {
        if (!basicReplayProfile) {
            return PROFILE_WIDGET_DEFAULT_DIMENSIONS
        }

        const boundsWidth = Number(container?.getBoundingClientRect?.().width)
        const layoutWidth = Number(container?.clientWidth)
        const cropWidth = layoutWidth > 0 ? layoutWidth : boundsWidth
        const width = cropWidth > 0
            ? Math.min(BASIC_REPLAY_PROFILE_MAX_WIDTH, cropWidth * BASIC_REPLAY_PROFILE_CROP_WIDTH_RATIO)
            : BASIC_REPLAY_PROFILE_MAX_WIDTH

        return {
            width,
            height: width / PROFILE_WIDGET_DEFAULT_ASPECT_RATIO,
        }
    }, [basicReplayProfile, container])

    /**
     * Sets the visibility state within the global profiler utility once on mount.
     */
    useEffect(() => {
        __.ui.profiler?.setVisibility()
    }, [])

    /**
     * Prepares and memoizes the data required for the profile chart.
     */
    const currentData = useMemo(() => {
        if (!journey) {
            return null
        }

        const preparedData = __.ui.profiler?.prepareData()
        return preparedData
               ? {
                ...preparedData,
                hasElevation: preparedData.dataset?.length > 0,
            }
               : null
    }, [journey, profile.key, unitStore.current])
    const data = currentData?.hasElevation
                 ? currentData
                 : (lastValidData.journeySlug === journeySlug ? lastValidData.data : null)
    useEffect(() => {
        const schedule = typeof queueMicrotask === 'function'
                         ? queueMicrotask
                         : callback => Promise.resolve().then(callback)

        if (currentData?.hasElevation) {
            if (lastValidData.journeySlug !== journeySlug || lastValidData.data !== currentData) {
                schedule(() => setLastValidData({
                                                    journeySlug,
                                                    data: currentData,
                                                }))
            }
            return
        }

        if (lastValidData.journeySlug !== journeySlug) {
            schedule(() => setLastValidData({
                                                journeySlug,
                                                data: null,
                                            }))
        }
    }, [currentData, journeySlug, lastValidData.data, lastValidData.journeySlug])
    const hasAltitudeData = useMemo(() => {
        return data?.dataset?.some(dataset => Array.isArray(dataset.source) && dataset.source.length > 0) ?? false
    }, [data])
    const isLocked = Boolean(
        widgetListSnapshot.get(id)?.locked
        ?? __.ui.widgetManager.getWidgetConfig(id)?.locked,
    )

    /**
     * Memoizes the configuration object for the Widget component.
     */
    const config = useMemo(() => {
        return {
            container:   container,
            contextMenu: {
                canReset:    !basicReplayProfile,
                canEdit:     !basicReplayProfile,
                canRemove:   !basicReplayProfile,
                canPosition: true,
                canSnapshot: true,
                canDetach:   !basicReplayProfile,
            },
            top:         basicReplayProfile ? '0px' : '100%',
            left:        basicReplayProfile ? '100%' : '0px',
            type:        LGS_VISUAL_WIDGET,
            group:        widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
            attachTo:    basicReplayProfile ? 'top-right' : 'bottom',
            positionKey: basicReplayProfile ? 'video-basic-profile-top-right-v2' : undefined,
            margin:      basicReplayProfile ? (lgs.gutter?.s ?? 8) : undefined,
            width:       profileDimensions.width,
            height:      profileDimensions.height,
            ratio:       PROFILE_WIDGET_FREE_RATIO,
            constrainResizeToContent: false,
            resizable:   true,
            scalable:    false,
            id,
            min:         {width: Math.min(150, profileDimensions.width)},
            max:         {width: 900},
            persist:         true,
            transient:       true,
            ttl:             HOUR,
            mandatory:       basicReplayProfile,
            canHide:         !basicReplayProfile,
            canLock:         !basicReplayProfile,
            stopPropagation: false,
            snap:        false,
            widgetsBoard: widgetsBoard,
            zIndex:      zIndex,
        }
    }, [basicReplayProfile, container, id, profileDimensions, widgetsBoard, zIndex])

    if (!journey || !widgetsBoard || Object.keys(config).length === 0 || !hasAltitudeData) {
        return null
    }

    return (
        <Widget isVisible={true} config={config} key={journey.slug}>
            {data &&
                <ProfileChart data={data}
                              id={id}
                              height="100%"
                              locked={isLocked}
                              basicReplayProfile={basicReplayProfile}
                              width="100%"
                />
            }
        </Widget>
    )
}
