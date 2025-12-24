/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-24
 * Last modified: 2025-12-24
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

    const toggleProfileButton = async () => {
        // Chercher si le widget existe déjà
        const existing = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!existing) {
            // Cas 1 : Le widget n'existe pas → le créer et l'afficher
            await addWidget(GROUP, WIDGET_KEY, {forceRefresh: true})
            $profile.show = true
        }
        else {
            // Le widget existe
            const widgetElement = __.ui.widgetManager.getElementById(existing)
            const $restrictions = lgs.stores.ui.widget.restrictions

            // Vérifier si le widget est caché par le système vidéo
            const isHiddenByVideoSystem = $restrictions.has(existing)

            if (isHiddenByVideoSystem) {
                // Ne rien faire si le widget est caché par le système vidéo
                // (pendant un enregistrement par exemple)
                return
            }

            if (widgetElement && widgetElement.classList.contains('lgs-widget-hidden')) {
                // Cas 2 : Le widget existe mais est caché par l'utilisateur → l'afficher
                widgetElement.classList.remove('lgs-widget-hidden')
                $profile.show = true
            }
            else {
                // Cas 3 : Le widget existe et est affiché → le masquer
                if (widgetElement) {
                    widgetElement.classList.add('lgs-widget-hidden')
                }
                $profile.show = false

                // Fermer le drawer si ouvert
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