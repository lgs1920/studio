/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackEditorButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-02
 * Last modified: 2025-07-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faRegularRouteCirclePlus }              from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { JOURNEY_EDITOR_DRAWER, REMOVE_JOURNEY_IN_TOOLBAR } from '@Core/constants'
import { faRoute } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip }           from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                           from 'valtio'

/**
 * A memoized React component for toggling the journey editor or loader.
 * @param {Object} props - Component props (currently unused)
 * @returns {JSX.Element} The rendered TrackEditorButton component
 */
export const TrackEditorButton = memo(() => {
    // Granular snapshots to minimize re-renders
    const {toolBar} = useSnapshot(lgs.settings.ui.menu)
    // Derive boolean to avoid reactivity to nested theJourney properties
    const hasJourney = useSnapshot(lgs.stores.main).theJourney !== null

    // Stable references to store objects
    const journeyLoaderStore = useMemo(() => lgs.stores.ui.mainUI.journeyLoader, [])
    const mainUI = useMemo(() => lgs.stores.ui.mainUI, [])

    /**
     * Memoized icon name based on journey existence.
     * @type {string}
     */
    const iconName = useMemo(() => {
        // Fallback to 0 if lgs.journeys is undefined or null
        const journeyCount = lgs.journeys?.size ?? 0
        return FA2SL.set(journeyCount ? faRoute : faRegularRouteCirclePlus)
    }, [lgs.journeys?.size])

    /**
     * Memoized tooltip placement based on toolbar settings.
     * @type {string}
     */
    const tooltipPlacement = useMemo(() => {
        return toolBar.fromStart ? 'right' : 'left'
    }, [toolBar.fromStart])

    /**
     * Toggles the journey editor or loader based on journey existence.
     * @function
     */
    const openEditorOrLoader = useCallback(() => {
        if (!hasJourney) {
            journeyLoaderStore.visible = true
            return
        }
        __.ui.drawerManager.toggle(JOURNEY_EDITOR_DRAWER)
    }, [hasJourney, journeyLoaderStore])

    // Manage remove journey dialog state (if needed)
    useEffect(() => {
        mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)
        // Cleanup to ensure consistent state
        return () => {
            mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)
        }
    }, [mainUI])

    return (
        <SlTooltip hoist placement={tooltipPlacement} content={hasJourney ? 'Edit the Journey' : 'Add a journey'}>
            <SlButton size="small" className="square-button" onClick={openEditorOrLoader}>
                <SlIcon slot="prefix" library="fa" name={iconName}/>
            </SlButton>
        </SlTooltip>
    )
})