/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RemoveJourney.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-06
 * Last modified: 2026-04-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JOURNEY_WIDGETS }                              from '@Core/constants'
import { hasActiveRemoveJourneyDialog }                 from '@Core/events/shortcutBlockers'
import {
    WidgetDynamicRenderer,
}                                                       from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { Utils }                                        from '@Editor/Utils'
import { UIToast }                                      from '@Utils/UIToast'
import { WaButton, WaCard, WaIcon, WaPopup, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useState }             from 'react'
import { useSnapshot }                                  from 'valtio'

export const RemoveJourney = (props) => {
    const mainUI = lgs.stores.ui.mainUI
    const editorStore = lgs.theJourneyEditorProxy

    const settings = useSnapshot(lgs.settings.ui.menu)
    const placement = props.placement ?? (settings.toolBar.fromStart ? 'bottom-end' : 'bottom-start')
    const [dialog, setDialog] = useState(false)
    const dialogName = props?.name ?? 'remove-journey'
    const removeButtonId = `remove-journey-in-settings-${dialogName}`

    const hideRemoveDialog = useCallback(() => {
        setDialog(false)
    }, [])

    const toggleRemoveDialog = useCallback(() => {
        setDialog(open => !open)
    }, [])

    /**
     * Remove journey
     */
    const removeJourney = useCallback(async () => {

        hideRemoveDialog()

        const $store = lgs.stores.main

        const journey = lgs.getJourneyBySlug(editorStore.journey.slug)
        if (!journey) {
            return
        }
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
            __.ui.wander?.stop?.()
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
    }, [editorStore.journey.slug, hideRemoveDialog])

    useEffect(() => {
        mainUI.removeJourneyDialog.active.set(dialogName, dialog)

        return () => {
            mainUI.removeJourneyDialog.active.set(dialogName, false)
        }
    }, [dialog, dialogName, mainUI.removeJourneyDialog.active])

    useEffect(() => {
        if (!dialog) {
            return undefined
        }

        const handleConfirmShortcuts = event => {
            if (!hasActiveRemoveJourneyDialog()) {
                return
            }

            if (event.key !== 'Escape' && event.key !== 'Delete') {
                return
            }

            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()

            if (event.key === 'Escape') {
                hideRemoveDialog()
                return
            }

            void removeJourney()
        }

        window.addEventListener('keydown', handleConfirmShortcuts, true)
        return () => window.removeEventListener('keydown', handleConfirmShortcuts, true)
    }, [dialog, hideRemoveDialog, removeJourney])

    return (
        <>
            <WaTooltip placement="bottom" for={removeButtonId}>{'Remove journey'}</WaTooltip>
            <WaButton size="small"
                      id={removeButtonId}
                      variant="brand"
                      appearance="plain"
                      onClick={toggleRemoveDialog}>
                <WaIcon name="trash-can"/>
            </WaButton>


            <WaPopup anchor={removeButtonId}
                     active={dialog}
                     data-lgs-shortcut-blocker={dialog ? 'true' : undefined}
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
                            <WaButton variant="danger" appearance="filled-outlined" size={'small'}
                                      onClick={removeJourney}>
                                <WaIcon name="trash-can"/> {'Yes'}
                            </WaButton>
                        </div>
                    </div>
                </WaCard>
            </WaPopup>


        </>
    )
}
