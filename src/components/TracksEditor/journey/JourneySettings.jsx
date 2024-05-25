import { useConfirm }      from '@Components/Modals/ConfirmUI'
import { ToggleStateIcon } from '@Components/ToggleStateIcon'
import { NO_DEM_SERVER }   from '@Core/Journey'
import { TrackData }       from '@Editor/track/TrackData'
import {
    TrackFlagsSettings,
}                          from '@Editor/track/TrackFlagsSettings'
import { TrackPoints }     from '@Editor/track/TrackPoints'
import {
    TrackStyleSettings,
}                          from '@Editor/track/TrackStyleSettings'
import { Utils }           from '@Editor/Utils'
import {
    faCircleDot, faDownload, faLocationDot, faLocationDotSlash, faPaintbrushPencil, faRectangleList, faTelescope,
    faTrashCan,
}                          from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon, SlInput, SlTab, SlTabGroup, SlTabPanel, SlTextarea, SlTooltip,
}                          from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }      from '@Utils/cesium/TrackUtils'
import { FA2SL }           from '@Utils/FA2SL'
import { UIToast }         from '@Utils/UIToast'
import { sprintf }         from 'sprintf-js'
import { useSnapshot }     from 'valtio'
import { JourneyData }     from './JourneyData'
import { JourneyPOIs }     from './JourneyPOIs'

export const UPDATE_JOURNEY_THEN_DRAW = 1
export const UPDATE_JOURNEY_SILENTLY = 2
export const REMOVE_JOURNEY = 3

export const JourneySettings = function JourneySettings() {

    const editorStore = lgs.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Change journey description
     *
     * @type {(function(*): Promise<*>)|*}
     */
    const setDescription = (async event => {
        const description = event.target.value
        // Title is empty, we force the former value
        if (description === '') {
            const field = document.getElementById('journey-description')
            field.value = editorStore.journey.description
            return
        }
        editorStore.journey.description = description
        await Utils.Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
    })

    /**
     * Change Journey Title
     *
     * The selection box is then synchronised
     *
     * @type {setTitle}
     */
    const setTitle = (async event => {
        const title = event.target.value
        // Title is empty, we force the former value
        if (title === '') {
            const field = document.getElementById('journey-title')
            field.value = editorStore.journey.title
            return
        }
        // title should not been already used for another journey.
        editorStore.journey.title = editorStore.journey.singleTitle(title)
        // Then use it
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneysList()
    })

    /**
     * Change journey visibility
     *
     */
    const setJourneyVisibility = (async visibility => {
        editorStore.journey.visible = visibility
        lgs.theJourney.updateVisibility(visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    })
    /**
     * Change POIs visibility
     *
     */
    const setAllPOIsVisibility = (async visibility => {
        editorStore.journey.POIsVisible = visibility
        TrackUtils.updatePOIsVisibility(lgs.theJourney, visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    })

    /**
     * Change DEM server
     *
     * @type {setDEMServer}
     */
    const setDEMServer = (async event => {
        editorStore.journey.DEMServer = event.target.value
        editorStore.longTask = editorStore.journey.DEMServer !== NO_DEM_SERVER
        Utils.renderJourneySettings()
        // await lgs.theJourney.computeAll()
        // // Then we redraw the theJourney
        // await lgs.theJourney.showAfterHeightSimulation()

        await Utils.updateJourney(UPDATE_JOURNEY_THEN_DRAW)
    })
    /**
     * Export journey confirmation
     */
    const [ConfirmExportJourneyDialog, confirmExportJourney] = useConfirm(`Export "${editorSnapshot.journey.title}" ?`, 'Not Yet. Sorry.')

    /**
     * Export Journey
     */
    const exportJourney = async () => {
        const confirmation = await confirmExportJourney()
        if (confirmation) {
            // TODO
        }
    }
    /**
     * Remove journey confirmation
     */
    const [ConfirmRemoveJourneyDialog, confirmRemoveJourney] = useConfirm(`Remove "${editorSnapshot.journey.title}" ?`, 'Are you sure you want to remove this journey ?')

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
            } else {
                lgs.theJourney = null
                lgs.cleanEditor()
                text = 'There are no others available.'
                mainStore.canViewJourneyData = false
                mainStore.components.journeyEditor.show = false
                mainStore.components.profile.show = false
                mainStore.canViewProfile = false
            }

            // Let's inform the user

            UIToast.success({
                caption: `${removed.title}</strong>`,
                text: `removed successfully!<br>${text}`,
            })

        }
    }

    const textVisibilityJourney = sprintf('%s Journey', editorSnapshot.journey.visible ? 'Hide' : 'Show')
    const textVisibilityPOIs = sprintf('%s POIs', editorSnapshot.journey.allPOIs ? 'Hide' : 'Show')

    return (<>
        {editorSnapshot.journey &&
            <div id="journey-settings" key={lgs.mainProxy.components.journeyEditor.keys.journey.journey}>
                <div className={'settings-panel'} id={'editor-journey-settings-panel'}>
                    <SlTabGroup className={'menu-panel'}>
                        <SlTab slot="nav" panel="data" id="tab-journey-data" active={editorSnapshot.tabs.journey.data}>
                            <SlIcon library="fa" name={FA2SL.set(faRectangleList)}/>Data
                        </SlTab>
                        <SlTab slot="nav" panel="edit" active={editorSnapshot.tabs.journey.edit}>
                            <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/>Edit
                        </SlTab>
                        {editorSnapshot.journey.tracks.size === 1 &&
                            <SlTab slot="nav" panel="points" active={editorSnapshot.tabs.journey.points}>
                                <SlIcon library="fa" name={FA2SL.set(faCircleDot)}/>Points
                            </SlTab>
                        }
                        <SlTab slot="nav" panel="pois" active={editorSnapshot.tabs.journey.pois}>
                            <SlIcon library="fa" name={FA2SL.set(faTelescope)}/>POIs
                        </SlTab>

                        {/**
                         * Data Tab Panel
                         */}
                        <SlTabPanel name="data">
                            {editorSnapshot.journey.tracks.size === 1 && <TrackData/>}
                            {editorSnapshot.journey.tracks.size > 1 && <JourneyData/>}

                        </SlTabPanel>
                        {/**
                         * Edit  Tab Panel
                         */}
                        <SlTabPanel name="edit">
                            <div id={'journey-text-description'}>
                                {/* Change visible name (title) */}
                                <SlTooltip content={'Title'}>
                                    <SlInput id="journey-title"
                                             value={editorSnapshot.journey.title}
                                             onSlChange={setTitle}
                                    />
                                </SlTooltip>

                                {/* Change description */}
                                <SlTooltip content={'Description'}>
                                    <SlTextarea row={2}
                                                size={'small'}
                                                id={'journey-description'}
                                                value={editorSnapshot.journey.description}
                                                onSlChange={setDescription}
                                                placeholder={'Journey description'}

                                    />
                                </SlTooltip>


                                { // if there only one track, the track style is here.
                                    editorSnapshot.journey.tracks.size === 1 && <TrackStyleSettings/>
                                }

                            </div>
                        </SlTabPanel>
                        {/**
                         * POIs Tab Panel
                         */}
                        <SlTabPanel name="pois">
                            <JourneyPOIs/>
                        </SlTabPanel>

                        {/**
                         * Points Tab Panel
                         */}
                        <SlTabPanel name="points">
                            <TrackPoints/>
                        </SlTabPanel>
                    </SlTabGroup>


                    <div id="journey-visibility" className={'editor-vertical-menu'}>
                        <span>
                        <SlTooltip content={textVisibilityJourney}>
                            <ToggleStateIcon change={setJourneyVisibility}
                                             initial={editorSnapshot.journey.visible}/>
                        </SlTooltip>
                            {editorSnapshot.journey.pois.size > 1 &&
                                <SlTooltip content={textVisibilityPOIs}>
                                    <ToggleStateIcon
                                        change={setAllPOIsVisibility}
                                        initial={editorSnapshot.journey.POIsVisible}
                                        icons={{
                                            shown: faLocationDot, hidden: faLocationDotSlash,
                                        }}/>
                                </SlTooltip>
                            }

                            {editorSnapshot.journey.tracks.size === 1 && <TrackFlagsSettings/>}
                        </span>

                        <span>
                        <SlTooltip content={'Export'}>
                            <a onClick={exportJourney}>
                                <SlIcon library="fa" name={FA2SL.set(faDownload)}/>
                            </a>
                        </SlTooltip>
                        <SlTooltip content={'Remove'}>
                            <a onClick={removeJourney}>
                                <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                            </a>
                        </SlTooltip>
                        </span>
                    </div>
                </div>

                {/* Add DEM server selection if we do not have height initially (ie in the journey file) */}
                {/* <div> */}
                {/*     <DEMServerSelection */}
                {/*         default={editorSnapshot.journey?.DEMServer ?? NO_DEM_SERVER} */}
                {/*         label={'Elevation:'} */}
                {/*         onChange={setDEMServer} */}
                {/*     /> */}
                {/*     {editorSnapshot.longTask && <SlProgressBar indeterminate/>} */}
                {/* </div> */}
                {/* Journey line settings */}


                <ConfirmRemoveJourneyDialog/>
                <ConfirmExportJourneyDialog/>

            </div>}
    </>)
}