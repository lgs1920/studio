import { faDownload, faLocationDot, faLocationDotSlash, faTrashCan } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlInput, SlTextarea, SlTooltip }                    from '@shoelace-style/shoelace/dist/react'
import { sprintf }                                                   from 'sprintf-js'
import { useSnapshot }                                               from 'valtio'
import { Journey, NO_DEM_SERVER }                                    from '../../../core/Journey'
import { TrackUtils }                                                from '../../../Utils/cesium/TrackUtils'
//import { JourneyUtils }        from '../../../Utils/cesium/JourneyUtils'
import { FA2SL }                                                     from '../../../Utils/FA2SL'
import { TracksEditorUtils }                                         from '../../../Utils/TracksEditorUtils'
//import { TracksEditorUtils } from '../../../Utils/TracksEditorUtils'
import { UIToast }                                                   from '../../../Utils/UIToast'
import { useConfirm }                                                from '../Modals/ConfirmUI'
import { ToggleStateIcon }                                           from '../ToggleStateIcon'

export const UPDATE_JOURNEY_THEN_DRAW = 1
export const UPDATE_JOURNEY_SILENTLY = 2
export const REMOVE_JOURNEY = 3

export const JourneySettings = function JourneySettings() {


    const editorStore = vt3d.theJourneyEditorProxy
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
        await updateJourney(UPDATE_JOURNEY_SILENTLY)
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
        await updateJourney(UPDATE_JOURNEY_SILENTLY)
        TracksEditorUtils.renderJourneysList()
    })

    /**
     * Change journey visibility
     *
     */
    const setJourneyVisibility = (async visibility => {
        editorStore.journey.visible = visibility
        vt3d.theJourney.updateVisibility(visibility)
        await updateJourney(UPDATE_JOURNEY_SILENTLY)
        TracksEditorUtils.renderJourneySettings()
    })
    /**
     * Change POIs visibility
     *
     */
    const setAllPOIsVisibility = (async visibility => {
        editorStore.journey.POIsVisible = visibility
        TrackUtils.updatePOIsVisibility(vt3d.theJourney, visibility)
        await updateJourney(UPDATE_JOURNEY_SILENTLY)
        TracksEditorUtils.renderJourneySettings()
    })

    /**
     * Change DEM server
     *
     * @type {setDEMServer}
     */
    const setDEMServer = (async event => {
        editorStore.journey.DEMServer = event.target.value
        editorStore.longTask = editorStore.journey.DEMServer !== NO_DEM_SERVER
        TracksEditorUtils.renderJourneySettings()
        // await vt3d.theJourney.computeAll()
        // // Then we redraw the theJourney
        // await vt3d.theJourney.showAfterHeightSimulation()

        await updateJourney(UPDATE_JOURNEY_THEN_DRAW)
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
            const mainStore = vt3d.mainProxy.components.journeyEditor
            const journey = editorStore.journey.slug
            const removed = vt3d.getJourneyBySlug(journey)
            // get Journey index
            const index = mainStore.list.findIndex((list) => list === journey)

            /**
             * Do some cleaning
             */
            if (index >= 0) {
                // In store
                mainStore.list.splice(index, 1)
                // In context
                vt3d.journeys.delete(editorStore.journey.slug)

                const dataSources = TrackUtils.getDataSourcesByName(editorStore.journey.slug)
                dataSources.forEach(dataSource => {
                    vt3d.viewer.dataSources.remove(dataSource)
                })
            }

            // Remove journey in DB
            await editorStore.journey.removeFromDB()

            /**
             * If we have some other journeys, we'll take the first and render the editor.
             * Otherwise we close the editing.
             */
            let text = ''
            if (mainStore.list.length >= 1) {
                // New current is the first.
                vt3d.theJourney = vt3d.getJourneyBySlug(mainStore.list[0])
                vt3d.theJourney.focus()
                TracksEditorUtils.renderJourneysList()
                TracksEditorUtils.renderJourneySettings()
            } else {
                vt3d.theJourney = null
                vt3d.cleanEditor()
                text = 'There are no others available.'
                mainStore.usable = false
                mainStore.show = false

            }

            // Let's inform the user

            UIToast.notifySuccess({
                caption: `<strong>${removed.title}</strong> removed !`, text: text,
            })

        }
    }

    const textVisibilityJourney = sprintf('%s Journey', editorSnapshot.journey.visible ? 'Hide' : 'Show')
    const textVisibilityPOIs = sprintf('%s POIs', editorSnapshot.journey.allPOIs ? 'Hide' : 'Show')


    /**
     * Re build the journey object,
     * Re compute metrix //TODO voir one peut paseprendre le anciens(tant que DEM n'a pa change)
     *
     * @param {Number} action
     * @return {Journey}
     */
    const updateJourney = async action => {

        const journey = Journey.deserialize({object: Journey.unproxify(editorStore.journey)})
        await journey.computeAll()
        vt3d.saveJourney(journey)
        // saveToDB toDB
        await journey.saveToDB()

        if (action !== UPDATE_JOURNEY_SILENTLY) {
            await journey.draw({action: action})
        } else {
            journey.focus()
        }
        return journey
    }

    const severalPOIs = (editorStore.journey.pois.size) > 1
    return (<>
        {editorSnapshot.journey &&
            <div id="journey-settings" key={vt3d.mainProxy.components.journeyEditor.keys.journey.journey}>
                <div id={'editor-journey-settings-panel'}>
                    <div id={'journey-text-description'}>
                        {/* Change visible name (title) */}
                        <SlTooltip content={'Title'}>
                            <SlInput id="journey-title" value={editorSnapshot.journey.title}
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
                            />
                        </SlTooltip>
                    </div>
                    <div id="journey-visibility" className={'editor-vertical-menu'}>
                        <span>
                        <SlTooltip content={textVisibilityJourney}>
                            <ToggleStateIcon change={setJourneyVisibility}
                                             initial={editorSnapshot.journey.visible}/>
                        </SlTooltip>
                            {severalPOIs &&
                                <SlTooltip content={textVisibilityPOIs}>
                                    <ToggleStateIcon
                                        change={setAllPOIsVisibility}
                                        initial={editorStore.journey.POIsVisible}
                                        icons={{
                                            shown: faLocationDot, hidden: faLocationDotSlash,
                                        }}/>
                                </SlTooltip>
                            }
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