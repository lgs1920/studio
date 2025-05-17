/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RemoveJourney.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-17
 * Last modified: 2025-05-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Utils }                                              from '@Editor/Utils'
import { faTrashCan }                                         from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlIconButton, SlPopup, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                                         from '@Utils/cesium/TrackUtils'
import { FA2SL }                                              from '@Utils/FA2SL'
import { UIToast }                                            from '@Utils/UIToast'
import React, { useEffect, useRef }                           from 'react'
import { useSnapshot }                                        from 'valtio'

export const RemoveJourney = (props) => {

    const editorStore = lgs.theJourneyEditorProxy
    const mainUI = lgs.mainProxy.components.mainUI
    const snap = useSnapshot(mainUI)

    const removeButton = useRef(null)
    const tooltipElement = useRef(null)
    const distance = 0
    const tooltip = props?.tooltip ?? 'top-start'
    const settings = useSnapshot(lgs.settings.ui.menu)
    const placement = props.placement ?? (settings.toolBar.fromStart ? 'top-start' : 'top-end')


    const hideRemoveDialog = () => {
        mainUI.removeJourneyDialog.active.set(props.name, false)
        // clearTimeout(timer)
    }
    const toggleRemoveDialog = (event) => {
        if (mainUI.removeJourneyDialog.active.get(props.name)) {
            hideRemoveDialog()
        }
        else {
            mainUI.removeJourneyDialog.active.set(props.name, true)
            tooltipElement.hide()
        }
    }

    /**
     * Remove journey
     */
    const removeJourney = async () => {

        hideRemoveDialog()

        const $store = lgs.mainProxy
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

            // Let's inform the user
            UIToast.warning({
                                caption: `No other journeys available`,
                                text:    `It's time to load a new one!`,
                            })
        }
    }


    useEffect(() => {
        mainUI.removeJourneyDialog.active.set(props.name, false)
        return () => {
            mainUI.removeJourneyDialog.active.set(props.name, false)
        }
    }, [])
    return (
        <>

            <SlTooltip hoist content={'Remove the current journey'} placement={tooltip} ref={tooltipElement}>
                {props.style !== 'button' &&
                    <SlIconButton ref={removeButton}
                                  onClick={toggleRemoveDialog}
                                  library="fa" name={FA2SL.set(faTrashCan)}/>
                }
                {props.style === 'button' &&

                    <SlButton ref={removeButton} size={'small'} className={'square-button'}
                              onClick={toggleRemoveDialog}
                    >
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}/>
                    </SlButton>
                }
            </SlTooltip>
                <SlPopup anchor={removeButton.current}
                         active={snap.removeJourneyDialog.active.get(props.name)}
                         hover-bridge="true" shift="true"
                         placement={placement}
                         distance={distance}
                >
                    <div className="lgs-one-line-card lgs-mini-remove-dialog">
                        {'Remove this journey ?'}
                        <SlButton variant="danger" size={'small'} onClick={removeJourney}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}/> {'Yes'}
                        </SlButton>
                    </div>
                </SlPopup>


        </>
    )
}