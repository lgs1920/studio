/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyVisibilityButton.jsx
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

import { UPDATE_JOURNEY_SILENTLY }     from '@Core/constants'
import { Utils }                       from '@Editor/Utils'
import { faEye, faEyeSlash }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import React                           from 'react'
import { useSnapshot }                 from 'valtio'


export const JourneyVisibilityButton = (props) => {
    const placement = props.tooltip ?? 'top'
    const editorStore = lgs.theJourneyEditorProxy
    const snap = useSnapshot(editorStore)

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
                    {!snap.journey.visible &&
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faEye)}/>
                    }
                    {snap.journey.visible &&
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faEyeSlash)}/>
                    }
                </SlButton>
            </SlTooltip>
        </>
    )
}
