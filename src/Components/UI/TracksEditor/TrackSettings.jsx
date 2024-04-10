import { faTrashCan }    from '@fortawesome/pro-regular-svg-icons'
import { faLocationDot } from '@fortawesome/pro-solid-svg-icons'

import {
    SlCard, SlColorPicker, SlDivider, SlIcon, SlInput, SlProgressBar, SlRange, SlSwitch, SlTooltip,
}                        from '@shoelace-style/shoelace/dist/react'
import { useSnapshot }   from 'valtio'
import { NO_DEM_SERVER } from '../../../classes/Journey'

import { POI }                from '../../../classes/POI'
import { TrackUtils }         from '../../../Utils/cesium/TrackUtils'
import { FA2SL }              from '../../../Utils/FA2SL'
import { TracksEditorUtils }  from '../../../Utils/TracksEditorUtils'
import { UINotifier }         from '../../../Utils/UINotifier'
import { useConfirm }         from '../Modals/ConfirmUI'
import { DEMServerSelection } from '../VT3D_UI/DEMServerSelection'

export const TrackSettings = function TrackSettings() {

    const UPDATE_TRACK_THEN_DRAW = 1
    const UPDATE_TRACK_SILENTLY = 2
    const REMOVE_TRACK = 3

    const editorStore = vt3d.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    let dataSource = vt3d.viewer.dataSources.getByName(editorStore.journey.slug)[0]

    /**
     * Remove track confirmation
     */
    const [ConfirmRemoveTrackDialog, confirmRemoveTrack] = useConfirm(`Remove "${editorSnapshot.journey.title}" ?`, 'Are you sure you want to removeFromDB this track ?')

    /**
     * Change track Color
     *
     * @type {setColor}
     */
    const setColor = (async event => {
        editorStore.journey.color = event.target.value
        TracksEditorUtils.reRenderTracksList()
        await rebuildTrack(UPDATE_TRACK_THEN_DRAW)
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
            const field = document.getElementById('track-title')
            field.value = editorStore.journey.title
            return
        }
        // Let's check if the next title has not been already used for
        // another track.
        editorStore.journey.title = Journey.defineUnicTitle(title)
        await rebuildTrack(UPDATE_TRACK_SILENTLY)

        TracksEditorUtils.reRenderTracksList()
    })

    /**
     * Change track thickness
     *
     * @type {setThickness}
     */
    const setThickness = (async event => {
        editorStore.journey.thickness = event.target.value
        TracksEditorUtils.reRenderTrackSettings()
        await rebuildTrack(UPDATE_TRACK_THEN_DRAW)
    })

    /**
     * Change track visibility
     *
     * @type {setThickness}
     */
    const setTrackVisibility = (async event => {
        //saveToDB state
        editorStore.journey.visible = event.target.checked

        // Change track visibility by changing it for each entity
        if (event.target.checked) {
            // We show all tracks and created pois Except for start and stop,
            // for which the pre-masking status is maintained.
            dataSource.entities.values.forEach(entity => {
                if (entity.id.startsWith('poi')) {
                    if (entity.id.endsWith('start')) {
                        entity.show = poi.snap('start').visible
                    } else if (entity.id.endsWith('stop')) {
                        entity.show = poi.snap('stop').visible
                    } else {
                        entity.show = true
                    }
                } else if (!entity.billboard) {
                    // Only tracks, not legacy pois
                    entity.show = true
                }
            })
        } else {
            // We hide all tracks and pois
            dataSource.entities.values.forEach(entity => {
                entity.show = event.target.checked
            })
        }
        await rebuildTrack(UPDATE_TRACK_SILENTLY)

        TracksEditorUtils.reRenderTrackSettings()
        TracksEditorUtils.reRenderTracksList()

    })

    /**
     * Select the right poi whatever pois ie Array or Map
     *
     */
    const poi = {
        snap: (type) => {
            if (!(editorSnapshot.journey.pois instanceof Map)) {
                for (const poi of editorSnapshot.journey.pois) {
                    if (poi.slug === type) {
                        return POI.clone(poi)
                    }
                }
            }
            return editorSnapshot.journey.pois.get(type)
        }, store: (type) => {
            if (editorStore.journey.pois instanceof Map) {
                return editorStore.journey.pois.get(type)
            }
            const poi = editorStore.journey.pois.filter(m => m.slug === type)
            if (poi.length > 0) {
                return poi[0]
            }
            return null
        },
    }

    /**
     * Change poi visibility
     *
     * @type {setMarkerVisibility}
     */
    const setMarkerVisibility = (async event => {
        // Which poi ?
        const type = event.target.id.endsWith('start') ? 'start' : 'stop'
        const poi = poi.store(type)


        // Save state
        poi.store(type).visible = event.target.checked

        // Toggle poi visibility
        dataSource.entities.values.forEach(entity => {
            if (entity.id.endsWith(type)) {
                entity.show = event.target.checked
            }
        })
        // As there's no rebuild, let's saveToDB to DB now
        await rebuildTrack(UPDATE_TRACK_SILENTLY)
    })

    /**
     * Change DEM server
     *
     * @type {setDEMServer}
     */
    const setDEMServer = (async event => {
        editorStore.journey.DEMServer = event.target.value
        editorStore.longTask = editorStore.journey.DEMServer !== NO_DEM_SERVER
        TracksEditorUtils.reRenderTrackSettings()
        // await vt3d.theJourney.computeAll()
        // // Then we redraw the theJourney
        // await vt3d.theJourney.showAfterHeightSimulation()

        await rebuildTrack(UPDATE_TRACK_THEN_DRAW)
    })

    /**
     * Remove track
     */
    const removeTrack = async () => {

        const confirmation = await confirmRemoveTrack()

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

            // Remove track in DB
            await editorStore.journey.removeFromDB()

            /**
             * If we have some other tracks, we'll take the first and render the editor.
             * Otherwise we close the editing.
             */
            let text = ''
            if (mainStore.list.length >= 1) {
                // New current is the first.
                vt3d.theJourney = vt3d.getJourneyBySlug(mainStore.list[0])
                TrackUtils.focus(Array.from(vt3d.theJourney.tracks.values())[0])
                TracksEditorUtils.reRenderTracksList()
                TracksEditorUtils.reRenderTrackSettings()
            } else {
                text = 'There are no others available.'
                mainStore.usable = false
                mainStore.show = false

            }

            // Let's inform the user

            UINotifier.notifySuccess({
                caption: `<strong>${removed.title}</strong> removed !`, text: text,
            })

        }
    }


    /**
     * Re build the track object,
     * Re compute metrix //TODO voir one peut paseprendre le anciens(tant que DEM n'a pa change)
     *
     * @return {Journey}
     */
    const rebuildTrack = async (action) => {

        // unproxify
        const unproxyfied = JSON.parse(JSON.stringify(editorStore.journey))

        // We clone but keep the same slug and pois
        const track = Journey.clone(unproxyfied, {
            slug: editorStore.journey.slug,
            pois: editorStore.journey.pois,
        })
        await track.computeAll()
        vt3d.saveTrack(track)
        // saveToDB toDB
        await track.toDB()

        //  vt3d.viewer.dataSources.removeAll()
        if (action !== UPDATE_TRACK_SILENTLY) {
            await track.loadAfterNewSettings(action)
        } else {
            TrackUtils.focus(track)
        }
        return track
    }

    /**
     * Marker Visibility component
     * @param props
     *
     * @return {JSX.Element}
     *
     * @constructor
     */
    const MarkerVisibility = (props) => {

        return (<>
            <div id={`visibility-poi-${props.type}`}>
                <SlSwitch size="small"
                          checked={poi.snap(props.type)?.visible}
                          style={{'--thumb-size': '1rem'}}
                          onSlChange={setMarkerVisibility}
                          id={`switch-visibility-poi-${props.type}`}
                > <span style={{color: vt3d.configuration.journey.pois[props.type].color}}>
                            <SlIcon library="fa"
                                    className={'fa-lg'}
                                    name={FA2SL.set(faLocationDot)}/>
                        </span>{props.label}</SlSwitch>
            </div>
        </>)
    }


    return (<>
        {editorSnapshot.journey &&
            <SlCard id="track-settings" key={vt3d.mainProxy.components.journeyEditor.journeySettingsKey}>
                <div id={'track-line-settings-global'}>
                    {/* Change visible name (title) */}
                    <div>
                        <SlInput id="track-title" label="Title:" value={editorSnapshot.journey.title}
                                 onSlChange={setTitle}
                        />
                    </div>

                    {/* Add DEM server selection if we do not have height initially (ie in the track file) */
                        !editorSnapshot.journey.hasAltitude && <div>
                            <DEMServerSelection
                                default={editorSnapshot.journey?.DEMServer ?? NO_DEM_SERVER}
                                label={'Simulate Altitude:'}
                                onChange={setDEMServer}
                            />
                            {editorSnapshot.longTask && <SlProgressBar indeterminate/>}
                        </div>}
                    {/* Journey line settings */}
                    <div id="track-line-settings">
                        <div>
                            <SlTooltip content="Color">
                                <SlColorPicker opacity
                                               size={'small'}
                                               label={'Color'}
                                               value={editorSnapshot.journey.color}
                                               swatches={vt3d.configuration.defaultTrackColors.join(';')}
                                               onSlChange={setColor}
                                               disabled={!editorSnapshot.journey.visible}
                                />
                            </SlTooltip>
                            <SlTooltip content="Thickness">
                                <SlRange min={1} max={10} step={1}
                                         value={editorSnapshot.journey.thickness}
                                         style={{'--thumb-size': '1rem'}}
                                         onSlChange={setThickness}
                                         disabled={!editorSnapshot.journey.visible}
                                />
                            </SlTooltip>

                            <SlDivider id="test-line" style={{
                                '--color': editorSnapshot.journey.visible ? editorSnapshot.journey.color : 'transparent',
                                '--width': `${editorSnapshot.journey.thickness}px`,
                                '--spacing': 0,
                            }}
                                       disabled={!editorSnapshot.journey.visible}
                            />

                            <SlSwitch size="small"
                                      checked={editorSnapshot.journey.visible}
                                      style={{'--thumb-size': '1rem'}}
                                      onSlChange={setTrackVisibility}
                            />

                            <SlTooltip content={'Remove'}>
                                <a onClick={removeTrack}>
                                    <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                                </a>
                            </SlTooltip>

                            <ConfirmRemoveTrackDialog/>
                        </div>
                        {editorSnapshot.journey.visible &&
                            <div id={'track-tips'}>
                                <MarkerVisibility type={'start'} label={'Start'}/>
                                <MarkerVisibility type={'stop'} label={'Stop'}/>
                            </div>
                        }
                    </div>
                </div>
            </SlCard>}
    </>)
}