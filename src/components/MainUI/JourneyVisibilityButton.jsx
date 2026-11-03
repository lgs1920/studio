/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyVisibilityButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-02-08
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { UPDATE_JOURNEY_SILENTLY }     from '@Core/constants'
import { UI_ACTIONS }                  from '@Core/ui/metadata/uiActionCatalog'
import { Utils }                       from '@Editor/Utils'
import { SlButton, SlTooltip }         from '@shoelace-style/shoelace/dist/react'
import { WaIcon }                      from '@awesome.me/webawesome/dist/react'
import React                           from 'react'
import { useProxyValue }               from '@Utils/ValtioUtils'


export const JourneyVisibilityButton = (props) => {
    const placement = props.tooltip ?? 'top'
    const editorStore = lgs.theJourneyEditorProxy
    const journeyVisible = useProxyValue(editorStore, editor => editor?.journey?.visible !== false, false)

    const setJourneyVisibility = async () => {
        editorStore.journey.visible = !editorStore.journey.visible
        lgs.theJourney.updateVisibility(editorStore.journey.visible)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }
    return (
        <>
            <SlTooltip hoist placement={placement} content={' Journey'}>
                <SlButton size={'small'} className="square-button" id={'focus-on-current-journey'}
                          onClick={setJourneyVisibility}>
                    {!journeyVisible &&
                        <WaIcon slot="prefix" {...UI_ACTIONS.show.icon}/>
                    }
                    {journeyVisible &&
                        <WaIcon slot="prefix" {...UI_ACTIONS.hide.icon}/>
                    }
                </SlButton>
            </SlTooltip>
        </>
    )
}
