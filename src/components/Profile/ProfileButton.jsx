/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-22
 * Last modified: 2025-12-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileButton.jsx
 *
 ******************************************************************************/

import { SCENE_WIDGETS, SCENE_WIDGETS_BOARD, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import {
    WidgetDynamicRenderer,
}                                                                    from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { faChartLine }                        from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip }        from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { TrackUtils }                         from '@Utils/cesium/TrackUtils'
import { FA2SL }                                                     from '@Utils/FA2SL'
import { useEffect, useState }                                       from 'react'
import { useSnapshot }                                               from 'valtio'

export const ProfileButton = (props) => {
    const $main = lgs.stores.main
    const $profile = $main.components.profile
    const main = useSnapshot($main)
    const profile = main.components.profile

    // Access the singleton correctly
    const renderer = WidgetDynamicRenderer.instance

    const WIDGET_KEY = 'profile-widget'
    const GROUP = SCENE_WIDGETS

    useEffect(() => {
        /**
         * Async wrapper to handle the promise from renderWidget
         */
        const handleWidgetState = async () => {
            // We have only one, search it !
            const existing = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
            if (!existing && profile.show) {
                // renderWidget returns the LazyComponent OR the ID
                // In your implementation, we need to track what was added to lgs.stores.ui.widget.list
                await addWidget(GROUP, WIDGET_KEY, {forceRefresh: true})
            }
            else {
                $profile.show = false
                if (existing) {
                    renderer.destroyWidget(existing)
                }
            }
        }

        handleWidgetState()
    }, [$profile.show])

    const toggleProfileButton = () => {
        const $tmp = !$profile.show
        $profile.show = $tmp

        if (!$profile.show && lgs.stores.ui.drawers.open === WIDGETS_EDITOR_DRAWER) {
            lgs.stores.ui.drawers.open = null
        }
    }

    const addWidget = async (group, key, options = {}) => {
        // renderWidget is async
        await renderer.renderWidget(group, key, {
            ...options,
            widgetsBoard: SCENE_WIDGETS_BOARD,
        })
    }

    TrackUtils.setProfileVisibility(lgs.theJourney)

    return (
        <>
            {main.canViewProfile && (
                <SlTooltip hoist placement={props.tooltip} content="Open the journey main">
                    <SlButton
                        size="small"
                        className="square-button"
                        id="open-the-main-panel"
                        onClick={toggleProfileButton}
                    >
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faChartLine)}/>
                    </SlButton>
                </SlTooltip>
            )}
        </>
    )
}