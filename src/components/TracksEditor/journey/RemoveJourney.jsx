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
    const distance = __.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-s'))
    const tooltip = props?.tooltip ?? 'top'
    const settings = useSnapshot(lgs.settings.ui.menu)
    const placement = props.placement ?? (settings.toolBar.fromStart ? 'top-end' : 'top-start')


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
            tooltipElement.current.hide()
        }
    }

    /**
     * Remove journey
     */
    const removeJourney = async () => {

        hideRemoveDialog()

        const mainStore = lgs.mainProxy
        const journey = editorStore.journey.slug
        const removed = lgs.getJourneyBySlug(journey)
        // get Journey index
        const index = mainStore.components.journeyEditor.list.findIndex((list) => list === journey)

        /**
         * Do some cleaning
         */
        if (index >= 0) {
            // In store
            mainStore.components.journeyEditor.list.splice(index, 1)
            // In context
            lgs.journeys.delete(editorStore.journey.slug)

            const dataSources = TrackUtils.getDataSourcesByName(editorStore.journey.slug)
            dataSources.forEach(dataSource => {
                lgs.viewer.dataSources.remove(dataSource)
            })
        }

        // Stop wanderer
        __.ui.wanderer.stop()

        // Remove journey in DB
        await editorStore.journey.removeFromDB()

        /**
         * If we have some other journeys, we'll take the first and render the editor.
         * Otherwise we close the editing.
         */
        let text = ''
        if (mainStore.components.journeyEditor.list.length >= 1) {
            // New current is the first.
            lgs.theJourney = lgs.getJourneyBySlug(mainStore.components.journeyEditor.list[0])
            lgs.theJourney.focus()
            lgs.theTrack = lgs.theJourney.tracks.values().next().value
            lgs.theTrack.addToEditor()
            Utils.renderJourneysList()
            // Sync Profile
            __.ui.profiler.draw()
        }
        else {
            lgs.theJourney = null
            lgs.theTrack = null
            lgs.cleanEditor()
            text = 'There are no other journeys available!'
            mainStore.canViewJourneyData = false
            __.ui.drawerManager.close()
            mainStore.components.profile.show = false
            mainStore.canViewProfile = false
        }

        // Let's inform the user
        UIToast.success({
                            caption: `${removed.title}</strong>`,
                            text:    `Removed successfully!<br>${text}`,
                        })

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

                    <SlButton ref={removeButton} size={'small'} className={'square-icon'}
                              onClick={toggleRemoveDialog}
                    >
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}/>
                    </SlButton>
                }

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


            </SlTooltip>
        </>
    )
}