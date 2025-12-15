/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-16
 * Last modified: 2025-12-16
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
import { useEffect } from 'react'
//read version


export const ProfileButton = (props) => {

    const $main = lgs.stores.main
    const $profile = $main.components.profile
    const main = useSnapshot($main)
    const profile = main.components.profile
    const widgetDynamicRenderer = new WidgetDynamicRenderer()
    const WIDGET_KEY = 'profile-widget'
    const GROUP = SCENE_WIDGETS

    // Restore widget on mount if profile.show is true
    useEffect(() => {
        if ($profile.show) {
            const $widget = lgs.stores.ui.widget
            const cache = __.ui.widgetCache.getAll()
            if (!cache.has(WIDGET_KEY, {group: GROUP})) {
                console.log('pas trouvé')
                return
            }
            console.log('trpouveé')

            if (existingWidgetId) {
                // Widget exists in cache, add it to render list
                $widget.list.set(existingWidgetId, {widgetsBoard: SCENE_WIDGETS_BOARD})
            }
            else {
                // Widget doesn't exist, create it
                widgetDynamicRenderer.renderWidget(GROUP, WIDGET_KEY, {
                    widgetsBoard: SCENE_WIDGETS_BOARD,
                })
            }
        }
    }, []) // Empty dependency array = run once on mount

    /**
     * Handles the click event on the Profile Button.
     * Toggles the $profile.show state and manages the widget instance.
     * @param {React.MouseEvent<HTMLButtonElement>} event - The click event.
     */
    const toggleProfileButton = (event) => {
        const nextShowState = !$profile.show
        $profile.show = nextShowState

        const $widget = lgs.stores.ui.widget

        if (nextShowState) {
            // Check if widget already exists in cache
            const cache = __.ui.widgetCache.getAll()
            let existingWidgetId = null
            for (const [widgetId, entry] of cache) {
                if (widgetId.startsWith(WIDGET_KEY) && entry.group === GROUP) {
                    existingWidgetId = widgetId
                    break
                }
            }

            if (existingWidgetId) {
                // Widget exists in cache, just add it back to the render list
                $widget.list.set(existingWidgetId, {widgetsBoard: SCENE_WIDGETS_BOARD})
            }
            else {
                // Widget doesn't exist, create it
                widgetDynamicRenderer.renderWidget(GROUP, WIDGET_KEY, {
                    widgetsBoard: SCENE_WIDGETS_BOARD,
                })
            }
        }
        else {
            // Hide the widget by removing it from the render list (but keep it in cache)
            const widgetId = Array.from($widget.list.keys()).find(id => id.startsWith(WIDGET_KEY))
            if (widgetId) {
                $widget.list.delete(widgetId)
            }
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
