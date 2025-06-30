/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackEditorButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faRegularRouteCirclePlus }                         from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { JOURNEY_EDITOR_DRAWER, REMOVE_JOURNEY_IN_TOOLBAR } from '@Core/constants'
import { faRoute } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip }                      from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                            from '@Utils/FA2SL'
import { useEffect } from 'react'
import { useSnapshot }                                      from 'valtio'

export const TrackEditorButton = (props) => {

    const mainUI = lgs.stores.ui.mainUI
    const snap = useSnapshot(lgs.mainProxy)
    const settings = useSnapshot(lgs.settings.ui.menu)
    const journeyLoaderStore = lgs.stores.ui.mainUI.journeyLoader

    const openEditorOrLoader = () => {
        if (lgs.theJourney === null) {
            journeyLoaderStore.visible = true
        }
        else {
            __.ui.drawerManager.toggle(JOURNEY_EDITOR_DRAWER)
        }
    }

    useEffect(() => {
        mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)

        return () => {
            mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)
        }
    }, [])


    return (
                <SlTooltip hoist placement={settings.toolBar.fromStart ? 'right' : 'left'}
                           content={snap.theJourney ? 'Edit the Journey' : 'Add a journey'}>
                    <SlButton size={'small'} className={'square-button'} onClick={openEditorOrLoader}>
                        <SlIcon slot="prefix" library="fa"
                                name={FA2SL.set(lgs.journeys.size ? faRoute : faRegularRouteCirclePlus)}/>
                    </SlButton>
                </SlTooltip>
    )
}