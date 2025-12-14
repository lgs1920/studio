/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-14
 * Last modified: 2025-12-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { JOURNEY_WIDGETS, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import {
    WidgetDynamicRenderer,
}                                                              from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { faChartLine }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { TrackUtils }                  from '@Utils/cesium/TrackUtils'
import { FA2SL }                       from '@Utils/FA2SL'
import { useSnapshot }                 from 'valtio'
//read version


export const ProfileButton = (props) => {

    const $main = lgs.stores.main
    const $profile = $main.components.profile
    const main = useSnapshot($main)
    const profile = main.components.profile
    const widgetDynamicRenderer = new WidgetDynamicRenderer()

    const toggleProfileButton = (event) => {
        $profile.show = !$profile.show
        if ($profile.show) {
            addWidget(SCENE_WIDGETS, 'profile-widget')
        }
    }

    /**
     * Adds a new instance of a widget to the map by invoking the renderer.
     * Delegates to the WidgetDynamicRenderer singleton.
     *
     * @param {string} group - Group ID
     * @param {string} key - Widget ID (base key)
     * @param {Object} [props={}] - Additional props to pass to the widget (not used here, later)
     */
    const addWidget = (group, key, props = {}) => {
        widgetDynamicRenderer.renderWidget(group, key, {...props, widgetsBoard: SCENE_WIDGETS_BOARD})
    }

    TrackUtils.setProfileVisibility(lgs.theJourney)

    return (<>
        {main.canViewProfile &&
            <SlTooltip hoist placement={props.tooltip} content="Open the journey main">
                {<SlButton size={'small'} className={'square-button'} id={'open-the-main-panel'}
                           onClick={toggleProfileButton}
                           key={profile.key}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faChartLine)}></SlIcon>
                </SlButton>}
            </SlTooltip>
        }
    </>)
}
