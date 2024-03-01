import { faTrashCan }  from '@fortawesome/pro-regular-svg-icons'
import {
    SlCard, SlColorPicker, SlDivider, SlIcon, SlInput, SlProgressBar, SlRange, SlSwitch, SlTooltip,
}                      from '@shoelace-style/shoelace/dist/react'
import { useSnapshot } from 'valtio'
import {
    NO_DEM_SERVER, Track,
}                      from '../../../classes/Track'
import {
    TrackUtils,
}                      from '../../../Utils/cesium/TrackUtils'
import {
    FA2SL,
}                      from '../../../Utils/FA2SL'
import {
    TracksEditorUtils,
}                      from '../../../Utils/TracksEditorUtils'
import {
    DEMServerSelection,
}                      from '../DEMServerSelection'
import {
    useConfirm,
}                      from '../Modals/ConfirmUI'

export const TrackSettings = function TrackSettings() {

    const [ConfirmRemoveTrackDialog, confirmRemoveTrack] = useConfirm(
        'Remove Track',
        'Are you sure you want to remove this track ?',
    )

    const editorStore = vt3d.editorProxy
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Change track Color
     *
     * @type {setColor}
     */
    const setColor = (async event => {
        editorStore.track.color = event.target.value
        TracksEditorUtils.reRenderTracksList()
        await rebuildTrack()
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
        const newTitle = Track.unicTitle(title)
        editorStore.track.title = newTitle
        await rebuildTrack()

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
        await rebuildTrack()

    })

    /**
     * Change track visibility
     *
     * @type {setThickness}
     */
    const setVisibility = (async event => {
        editorStore.track.visible = event.target.checked
        TracksEditorUtils.reRenderTrackSettings()
        await rebuildTrack()
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
    })

    /**
     * Remove track
     */
    const removeTrack = async () => {
        const confirmation = await confirmRemoveTrack()
        if (confirmation) {
            const store = vt3d.mainProxy.components.tracksEditor
            const track = editorStore.track.slug
            const index = store.list.findIndex((list) => list === track)
            if (index >= 0) {
                // Delete from store
                store.list.splice(index, 1)
                // Delete from context
                vt3d.tracks.splice(index, 1)
            }
            vt3d.currentTrack = vt3d.getTrackBySlug(store.list[0])

            // If we have tracks, lets Dialog opened, else we close it
            if (vt3d.currentTrack !== undefined) {
                TracksEditorUtils.reRenderTracksList()
                TracksEditorUtils.reRenderTrackSettings()
            } else {
                vt3d.mainProxy.components.tracksEditor.visible = false
            }
            await rebuildTrack()


            //TODO remove track ongraph
        }
    }


    /**
     * Re build the track object,
     * Re compute metrix //TODO voir one peut paseprendre le anciens(tant que DEM n'a pa change)
     *
     * @return {Track}
     */
    const rebuildTrack = async () => {
        // unproxify
        const unproxyfied = JSON.parse(JSON.stringify(editorStore.track))
        // We clone but keep the same slug
        const track = Track.clone(unproxyfied, {
            slug: unproxyfied.slug,
            title: unproxyfied.title,
        })
        // get entityet voir ce qu'ilfaut faire

        const path = TrackUtils.getEntities(track.slug)

        await track.computeAll()
        track.addTipsMarkers()
        vt3d.saveTrack(track)

        vt3d.viewer.dataSources.removeAll()
        if (track.visible) {
            track.showAfterNewSettings()
        }
        return track
    }

    return (<>
        {editorSnapshot.track &&
            <SlCard id="track-settings" key={vt3d.mainProxy.components.tracksEditor.trackSettingsKey}>
                {/* Change visible name (title) */}
                <SlInput id="track-title" label="Title:" value={editorSnapshot.track.title}
                         onSlChange={setTitle}
                />

                {/* Add DEM server selection if we do not have height initially (ie in the track file) */
                    !editorSnapshot.track.hasHeight &&
                    <>
                        <DEMServerSelection
                            default={editorSnapshot.track?.DEMServer ?? NO_DEM_SERVER}
                            label={'Simulate Altitude:'}
                            onChange={setDEMServer}
                        />
                        {editorSnapshot.longTask && <SlProgressBar indeterminate/>}
                    </>
                }

                {/* Track line settings */}
                <div id="track-line-settings">
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
                              onSlChange={setVisibility}
                    />

                    <SlTooltip content={'Remove'}>
                        <a onClick={removeTrack}>
                            <SlIcon library="fa" name={FA2SL.set(faTrashCan)}/>
                        </a>
                    </SlTooltip>
                    <ConfirmRemoveTrackDialog/>
                </div>
            </SlCard>
        }
    </>)
}