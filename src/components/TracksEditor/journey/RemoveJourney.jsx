/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RemoveJourney.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-27
 * Last modified: 2026-03-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JOURNEY_WIDGETS }                              from '@Core/constants'
import {
    WidgetDynamicRenderer,
}                                                       from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { Utils }                                        from '@Editor/Utils'
import { UIToast }                                      from '@Utils/UIToast'
import { WaButton, WaCard, WaIcon, WaPopup, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useRef, useState }                      from 'react'
import { useSnapshot }                                  from 'valtio'

export const RemoveJourney = (props) => {
    const mainUI = lgs.stores.ui.mainUI
    const editorStore = lgs.theJourneyEditorProxy
    const snap = useSnapshot(mainUI)

    const removeButton = useRef(null)
    const tooltipElement = useRef(null)
    const tooltip = props?.tooltip ?? 'top-start'
    const settings = useSnapshot(lgs.settings.ui.menu)
    const placement = props.placement ?? (settings.toolBar.fromStart ? 'bottom-end' : 'bottom-start')
    const [dialog, setDialog] = useState(false)

    const hideRemoveDialog = () => {
        setDialog(false)
    }
    const toggleRemoveDialog = (event) => {
        setDialog(!dialog)
    }

    /**
     * Remove journey
     */
    const removeJourney = async () => {

        hideRemoveDialog()

        const $store = lgs.stores.main
        const $pois = $store.components.pois.list

        const journey = lgs.getJourneyBySlug(editorStore.journey.slug)
        // get Journey index
        const index = $store.components.journeyEditor.list.findIndex((list) => list === journey.slug)

        /**
         * Do some cleaning
         */
        if (index >= 0) {
            // clean journey store
            $store.components.journeyEditor.list.splice(index, 1)

            // Remove the journey and it's children
            journey.remove()

            //TODO add a REMOVE_JOURNEY event

            // Stop wanderer
            __.ui.wanderer.stop()
        }

        // Let's inform the user
        UIToast.success({
                            caption: journey.title,
                            text:    `Removed successfully!`,
                        })


        /**
         * If we have some other journeys, we'll take the first and render the editor.
         * Otherwise we close the editing.
         */
        let text = ''
        if ($store.components.journeyEditor.list.length >= 1) {
            // New current is the first.
            lgs.theJourney = lgs.getJourneyBySlug($store.components.journeyEditor.list[0])
            lgs.theJourney.focus({rotate: lgs.settings.ui.camera.start.rotate.journey})
            lgs.theTrack = lgs.theJourney.tracks.values().next().value
            lgs.theTrack.addToEditor()
            Utils.renderJourneysList()
            // Sync Profile
            __.ui.profiler.draw()
        }
        else {
            lgs.cleanContext()
            text = ''
            $store.canViewJourneyData = false
            __.ui.drawerManager.close()
            $store.components.profile.show = false
            $store.canViewProfile = false
            const journeyWidgets = __.ui.widgetCache.getAll({groups: [JOURNEY_WIDGETS]})
            if (journeyWidgets?.size) {
                const renderer = new WidgetDynamicRenderer()
                for (const [widgetId] of journeyWidgets) {
                    renderer.destroyWidget(widgetId)
                }
            }

            // Let's inform the user
            UIToast.warning({
                                caption: `No other journeys available`,
                                text:    `It's time to load a new one!`,
                            })
        }
    }

    return (
        <>
            <WaTooltip placement={tooltip} for={removeButton}
                       ref={tooltipElement}>{'Remove the current journey'}</WaTooltip>
            <WaButton ref={removeButton} variant="brand" appearance="plain"
                      onClick={toggleRemoveDialog}>
                <WaIcon name="trash-can"/>
            </WaButton>


            <WaPopup anchor={removeButton.current}
                     active={dialog}
                     hover-bridge="true" shift="true"
                     placement={placement}
                     distance={lgs.gutter.xs}
            >
                <WaCard className="lgs--popup-in-drawer lgs--popup-in-drawer-small lgs-slide-down">
                    {'Are you sure to remove this journey ?'}
                    <div slot="footer">
                        <div className="lgs--popup-in-drawer-footer">
                            <WaButton variant="neutral" appearance="outlined" size={'small'} onClick={hideRemoveDialog}>
                                <WaIcon name="xmark"/> {'No'}
                            </WaButton>
                            <WaButton variant="danger" appearance="" size={'small'} onClick={removeJourney}>
                                <WaIcon name="trash-can"/> {'Yes'}
                            </WaButton>
                        </div>
                    </div>
                </WaCard>
            </WaPopup>


        </>
    )
}
