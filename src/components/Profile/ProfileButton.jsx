/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
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
import './style.css'
import { TrackUtils }                  from '@Utils/cesium/TrackUtils'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
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

    const ensureProfileWidget = async () => {
        let existing = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!existing) {
            await addWidget(GROUP, WIDGET_KEY, {forceRefresh: true})
            existing = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
        }
        else if (!__.ui.widgetManager.getElementById(existing)) {
            await addWidget(GROUP, existing, {forceRefresh: true})
        }

        if (existing) {
            __.ui.widgetManager.getElementById(existing)?.classList.remove('lgs-widget-hidden')
        }

        return existing
    }

    const toggleProfileButton = async () => {
        let existing = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!existing) {
            await ensureProfileWidget()
            $profile.show = true
        }
        else {
            const widgetElement = __.ui.widgetManager.getElementById(existing)
            const $restrictions = lgs.stores.ui.widget.restrictions

            const isHiddenByVideoSystem = $restrictions.has(existing)

            if (isHiddenByVideoSystem) {
                return
            }

            if (!widgetElement) {
                await ensureProfileWidget()
                $profile.show = true
            }
            else if (widgetElement.classList.contains('lgs-widget-hidden')) {
                widgetElement.classList.remove('lgs-widget-hidden')
                $profile.show = true
            }
            else {
                if (widgetElement) {
                    widgetElement.classList.add('lgs-widget-hidden')
                }
                $profile.show = false

                if (lgs.stores.ui.drawers.open === WIDGETS_EDITOR_DRAWER) {
                    lgs.stores.ui.drawers.open = null
                }
            }
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
                <>
                    <WaTooltip for="open-the-main-panel"
                               placement={props.tooltip}>{'Open the journey Profile'}</WaTooltip>
                    <WaButton
                        className="square-button"
                        id="open-the-main-panel"
                        onClick={toggleProfileButton}
                        variant={'brand'}
                        appearance="Filled"
                    >
                        <WaIcon name="chart-line" variant="regular"/>
                    </WaButton>
                </>
            )}
        </>
    )
}
