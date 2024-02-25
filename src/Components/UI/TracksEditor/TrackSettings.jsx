import {SlColorPicker, SlDivider, SlInput, SlRange, SlSwitch, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {snapshot, useSnapshot}                                           from 'valtio'
import {NO_DEM_SERVER, Track}                                            from '../../../classes/Track'
import {TracksEditorUtils}                                               from '../../../Utils/TracksEditorUtils'
import {DEMServerSelection}                                              from '../DEMServerSelection'

export const TrackSettings = function TrackSettings() {

    const storeEditor = vt3d.editorProxy
    const snapEditor = useSnapshot(storeEditor)

    /**
     * Change track Color
     *
     * @type {setColor}
     */
    const setColor = (event => {
        storeEditor.track.color = event.target.value
        vt3d.addTrack(Object.assign({}, storeEditor.track))
        rebuildTrack()
    })

    /**
     * Change Track Title
     *
     * The selection box is then synchronised
     *
     * @type {setTitle}
     */
    const setTitle = (event => {
        storeEditor.track.title = event.target.value
        TracksEditorUtils.reRenderTracksList()
        rebuildTrack()
    })

    /**
     * Change track thickness
     *
     * @type {setThickness}
     */
    const setThickness = (event => {
        storeEditor.track.thickness = event.target.value
        TracksEditorUtils.reRenderTrackSettings()
        rebuildTrack()
    })

    /**
     * Change track visibility
     *
     * @type {setThickness}
     */
    const setVisibility = (event => {
        storeEditor.track.visible = event.target.checked
        TracksEditorUtils.reRenderTrackSettings()
        rebuildTrack()

    })

    /**
     * Change DEM server
     *
     * @type {setDEMServer}
     */
    const setDEMServer = (event => {
        storeEditor.track.DEMServer = event.target.value
        TracksEditorUtils.reRenderTrackSettings()
        rebuildTrack()
    })


    /**
     * Re build the track object,
     * Re compute metricx //TODO voir one peut paseprendre le anciens(tant que DEM n'a pa change)
     *
     * @return {Track}
     */
    const rebuildTrack = () => {
        const tmp2 = snapshot(storeEditor.track)
        const track = new Track(tmp2.name, tmp2.type, tmp2.geoJson)
        track.computeAll()
        track.color = tmp2.color
        track.title = tmp2.title
        track.thickness = tmp2.thickness
        track.visible = tmp2.visible
        vt3d.addTrack(track)
        if (track.visible) {
            track.showAfterNewSettings()
        }
        return track
    }


    return (<>
        <div id="track-settings" key={vt3d.mainProxy.components.tracksEditor.trackSettingsKey}>
            {/* Change visible name (title) */}
            <SlInput label="Name:" value={snapEditor.track.title}
                     onSlChange={setTitle}/>

            {/* Add DEM server selection if we do not have height initially (ie in the track file) */
                !snapEditor.track.hasHeight && <DEMServerSelection
                    default={snapEditor.track?.DEMServer ?? NO_DEM_SERVER}
                    label={'Simulate Altitude:'}
                    onChange={setDEMServer}
                />}

            {/* Track line settings */}
            {/* <label><SlIcon library="fa" name={FA2SL.set(faPenPaintbrush)}></SlIcon>Line</label> */}
            <br/>
            <div id="track-line-settings">
                <SlTooltip content="Color">
                    <SlColorPicker opacity
                                   size={'small'}
                                   label={'Color'}
                                   value={snapEditor.track.color}
                                   swatches={vt3d.configuration.defaultTrackColors.join(';')}
                                   onSlChange={setColor}
                                   disabled={!snapEditor.track.visible}
                    />
                </SlTooltip>
                <SlTooltip content="Thickness (px)">
                    <SlRange min={1} max={10} step={1}
                             value={snapEditor.track.thickness}
                             style={{'--thumb-size': '1rem'}}
                             onSlChange={setThickness}
                             disabled={!snapEditor.track.visible}
                    />
                </SlTooltip>

                <SlDivider id="test-line" style={{
                    '--color': snapEditor.track.visible ? snapEditor.track.color : 'transparent',
                    '--width': `${snapEditor.track.thickness}px`,
                    '--spacing': 0,
                }}
                           disabled={!snapEditor.track.visible}
                />

                <SlSwitch size="small"
                          checked={snapEditor.track.visible}
                          style={{'--thumb-size': '1rem'}}
                          onSlChange={setVisibility}
                />
            </div>
        </div>

    </>)
}