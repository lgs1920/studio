/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackEditorButton.jsx
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

import { JOURNEY_EDITOR_DRAWER, REMOVE_JOURNEY_IN_TOOLBAR } from '@Core/constants'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
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
        return journeyCount ? 'route' : 'regular-route-circle-plus'
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

    return (<>
            <WaTooltip for="open-journey-editor"
                       placement={tooltipPlacement}>{hasJourney ? 'Edit the Journey' : 'Add a journey'}</WaTooltip>
            <WaButton id="open-journey-editor"
                      className="square-button"
                      onClick={openEditorOrLoader}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon name="route-circle-plus" variant="regular"/>
            </WaButton>
        </>
    )
})