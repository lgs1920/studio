import { useConfirm }                                from '@Components/Modals/ConfirmUI'
import { Utils }                                     from '@Editor/Utils'
import { faTrashCan }                                from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlIconButton, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                                from '@Utils/cesium/TrackUtils'
import { FA2SL }                                     from '@Utils/FA2SL'
import { UIToast }                                   from '@Utils/UIToast'
import React                                         from 'react'
import { useSnapshot }                               from 'valtio'

export const RemoveJourney = (props) => {

    const editorStore = lgs.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Remove journey confirmation
     */
    const Question = () => {
        return (<>{'Are you sure you want to remove this journey ?'}</>)
    }
    const [ConfirmRemoveJourneyDialog, confirmRemoveJourney] = useConfirm(`Remove <strong>${editorSnapshot.journey.title}</strong> ?`, Question,
                                                                          {icon: faTrashCan, text: 'Remove'})

    /**
     * Remove journey
     */
    const removeJourney = async () => {

        const confirmation = await confirmRemoveJourney()

        if (confirmation) {
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
    }

    return (
        <>

            <SlTooltip hoist content={'Remove'}>
                {props.style !== 'button' &&
                    <SlIconButton onClick={removeJourney} library="fa" name={FA2SL.set(faTrashCan)}/>
                }
                {props.style === 'button' &&
                    <SlButton size={'small'} className={'square-icon'} onClick={removeJourney}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}/>
                    </SlButton>
                }
            </SlTooltip>

            <ConfirmRemoveJourneyDialog/>
        </>
    )
}