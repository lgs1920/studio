import { faTrashCan }    from '@fortawesome/pro-regular-svg-icons'
import { faLocationDot } from '@fortawesome/pro-solid-svg-icons'

import {
    SlCard, SlColorPicker, SlDivider, SlIcon, SlInput, SlProgressBar, SlRange, SlSwitch, SlTooltip,
}                               from '@shoelace-style/shoelace/dist/react'
import { useSnapshot }          from 'valtio'
import { POI }                  from '../../../classes/POI'
import { NO_DEM_SERVER, Track } from '../../../classes/Track'
import { TrackUtils }           from '../../../Utils/cesium/TrackUtils'
import { FA2SL }                from '../../../Utils/FA2SL'
import { TracksEditorUtils }    from '../../../Utils/TracksEditorUtils'
import { UINotifier }           from '../../../Utils/UINotifier'
import { useConfirm }           from '../Modals/ConfirmUI'
import { DEMServerSelection }   from '../VT3D_UI/DEMServerSelection'

export const TrackSettings = function TrackSettings() {

    const UPDATE_TRACK_THEN_DRAW = 1
    const UPDATE_TRACK_SILENTLY = 2
    const REMOVE_TRACK = 3

    const editorStore = vt3d.trackEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    let dataSource = vt3d.viewer.dataSources.getByName(editorStore.track.slug)[0]

    /**
     * Remove track confirmation
     */
    const [ConfirmRemoveTrackDialog, confirmRemoveTrack] = useConfirm(`Remove "${editorSnapshot.track.title}" ?`, 'Are you sure you want to remove this track ?')

    /**
     * Change track Color
     *
     * @type {setColor}
     */
    const setColor = (async event => {
        editorStore.track.color = event.target.value
        TracksEditorUtils.reRenderTracksList()
        await rebuildTrack(UPDATE_TRACK_THEN_DRAW)
    })

    /**
     * Change Track Title
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
            field.value = editorStore.track.title
            return
        }
        // Let's check if the next title has not been already used for
        // another track.
        editorStore.track.title = Track.defineUnicTitle(title)
        await rebuildTrack(UPDATE_TRACK_SILENTLY)

        TracksEditorUtils.reRenderTracksList()
    })

    /**
     * Change track thickness
     *
     * @type {setThickness}
     */
    const setThickness = (async event => {
        editorStore.track.thickness = event.target.value
        TracksEditorUtils.reRenderTrackSettings()
        await rebuildTrack(UPDATE_TRACK_THEN_DRAW)
    })

    /**
     * Change track visibility
     *
     * @type {setThickness}
     */
    const setTrackVisibility = (async event => {
        //save state
        editorStore.track.visible = event.target.checked

        // Change track visibility by changing it for each entity
        if (event.target.checked) {
            // We show all tracks and created markers Except for start and stop,
            // for which the pre-masking status is maintained.
            dataSource.entities.values.forEach(entity => {
                if (entity.id.startsWith('marker')) {
                    if (entity.id.endsWith('start')) {
                        entity.show = marker.snap('start').visible
                    } else if (entity.id.endsWith('stop')) {
                        entity.show = marker.snap('stop').visible
                    } else {
                        entity.show = true
                    }
                } else if (!entity.billboard) {
                    // Only tracks, not legacy markers
                    entity.show = true
                }
            })
        } else {
            // We hide all tracks and markers
            dataSource.entities.values.forEach(entity => {
                entity.show = event.target.checked
            })
        }
        await rebuildTrack(UPDATE_TRACK_SILENTLY)

        TracksEditorUtils.reRenderTrackSettings()
        TracksEditorUtils.reRenderTracksList()

    })

    /**
     * Select the right marker whatever markers ie Array or Map
     *
     */
    const marker = {
        snap: (type) => {
            if (!(editorSnapshot.track.markers instanceof Map)) {
                for (const marker of editorSnapshot.track.markers) {
                    if (marker.slug === type) {
                        return POI.clone(marker)
                    }
                }
            }
            return editorSnapshot.track.markers.get(type)
        }, store: (type) => {
            if (editorStore.track.markers instanceof Map) {
                return editorStore.track.markers.get(type)
            }
            const marker = editorStore.track.markers.filter(m => m.slug === type)
            if (marker.length > 0) {
                return marker[0]
            }
            return null
        },
    }

    /**
     * Change marker visibility
     *
     * @type {setMarkerVisibility}
     */
    const setMarkerVisibility = (async event => {
        // Which marker ?
        const type = event.target.id.endsWith('start') ? 'start' : 'stop'
        const poi = marker.store(type)


        // Save state
        marker.store(type).visible = event.target.checked

        // Toggle marker visibility
        dataSource.entities.values.forEach(entity => {
            if (entity.id.endsWith(type)) {
                entity.show = event.target.checked
            }
        })
        // As there's no rebuild, let's save to DB now
        await rebuildTrack(UPDATE_TRACK_SILENTLY)
    })

    /**
     * Change DEM server
     *
     * @type {setDEMServer}
     */
    const setDEMServer = (async event => {
        editorStore.track.DEMServer = event.target.value
        editorStore.longTask = editorStore.track.DEMServer !== NO_DEM_SERVER
        TracksEditorUtils.reRenderTrackSettings()
        // await vt3d.currentTrack.computeAll()
        // // Then we redraw the currentTrack
        // await vt3d.currentTrack.showAfterHeightSimulation()

        await rebuildTrack(UPDATE_TRACK_THEN_DRAW)
    })

    /**
     * Remove track
     */
    const removeTrack = async () => {

        const confirmation = await confirmRemoveTrack()

        if (confirmation) {
            const mainStore = vt3d.mainProxy.components.tracksEditor
            const track = editorStore.track.slug
            const removed = vt3d.getTrackBySlug(track)
            // get Track index
            const index = mainStore.list.findIndex((list) => list === track)

            /**
             * Do some cleaning
             */
            if (index >= 0) {
                // In store
                mainStore.list.splice(index, 1)
                // In context
                vt3d.tracks.delete(editorStore.track.slug)
                // In canvas, ie remove the tracks and all markers
                // But sometimes we loose dataSource TODO why ?
                if (dataSource === undefined) {
                    dataSource = vt3d.viewer.dataSources.getByName(editorStore.track.slug)[0]
                }
                vt3d.viewer.dataSources.remove(dataSource)


            }

            // Remove track in DB
            await editorStore.track.removeFromDB()

            /**
             * If we have some other tracks, we'll take the first and render the editor.
             * Otherwise we close the editing.
             */
            let text = ''
            if (mainStore.list.length >= 1) {
                // New current is the first.
                vt3d.currentTrack = vt3d.getTrackBySlug(mainStore.list[0])
                TrackUtils.focus(vt3d.currentTrack)
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
     * @return {Track}
     */
    const rebuildTrack = async (action) => {

        // unproxify
        const unproxyfied = JSON.parse(JSON.stringify(editorStore.track))

        // We clone but keep the same slug and markers
        const track = Track.clone(unproxyfied, {
            slug: editorStore.track.slug,
            markers: editorStore.track.markers,
        })
        await track.computeAll()
        vt3d.saveTrack(track)
        // save toDB
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
            <div id={`visibility-marker-${props.type}`}>
                <SlSwitch size="small"
                          checked={marker.snap(props.type)?.visible}
                          style={{'--thumb-size': '1rem'}}
                          onSlChange={setMarkerVisibility}
                          id={`switch-visibility-marker-${props.type}`}
                > <span style={{color: vt3d.configuration.track.markers[props.type].color}}>
                            <SlIcon library="fa"
                                    className={'fa-lg'}
                                    name={FA2SL.set(faLocationDot)}/>
                        </span>{props.label}</SlSwitch>
            </div>
        </>)
    }


    return (<>
        {editorSnapshot.track &&
            <SlCard id="track-settings" key={vt3d.mainProxy.components.tracksEditor.trackSettingsKey}>
                <div id={'track-line-settings-global'}>
                    {/* Change visible name (title) */}
                    <div>
                        <SlInput id="track-title" label="Title:" value={editorSnapshot.track.title}
                                 onSlChange={setTitle}
                        />
                    </div>

                    {/* Add DEM server selection if we do not have height initially (ie in the track file) */
                        !editorSnapshot.track.hasAltitude && <div>
                            <DEMServerSelection
                                default={editorSnapshot.track?.DEMServer ?? NO_DEM_SERVER}
                                label={'Simulate Altitude:'}
                                onChange={setDEMServer}
                            />
                            {editorSnapshot.longTask && <SlProgressBar indeterminate/>}
                        </div>}
                    {/* Track line settings */}
                    <div id="track-line-settings">
                        <div>
                            <SlTooltip content="Color">
                                <SlColorPicker opacity
                                               size={'small'}
                                               label={'Color'}
                                               value={editorSnapshot.track.color}
                                               swatches={vt3d.configuration.defaultTrackColors.join(';')}
                                               onSlChange={setColor}
                                               disabled={!editorSnapshot.track.visible}
                                />
                            </SlTooltip>
                            <SlTooltip content="Thickness">
                                <SlRange min={1} max={10} step={1}
                                         value={editorSnapshot.track.thickness}
                                         style={{'--thumb-size': '1rem'}}
                                         onSlChange={setThickness}
                                         disabled={!editorSnapshot.track.visible}
                                />
                            </SlTooltip>

                            <SlDivider id="test-line" style={{
                                '--color': editorSnapshot.track.visible ? editorSnapshot.track.color : 'transparent',
                                '--width': `${editorSnapshot.track.thickness}px`,
                                '--spacing': 0,
                            }}
                                       disabled={!editorSnapshot.track.visible}
                            />

                            <SlSwitch size="small"
                                      checked={editorSnapshot.track.visible}
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
                        {editorSnapshot.track.visible &&
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