import {faPenPaintbrush}                         from '@fortawesome/pro-regular-svg-icons'
import {SlColorPicker, SlIcon, SlInput, SlRange} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                              from 'react'
import {useSnapshot}                             from 'valtio'
import {NO_DEM_SERVER}                           from '../../../classes/Track'
import {FA2SL}                                   from '../../../Utils/FA2SL'
import {TracksEditorUtils}                       from '../../../Utils/TracksEditorUtils'
import {DEMServerSelection}                      from '../DEMServerSelection'

export const TrackSettings = forwardRef(function TrackSettings(props, ref) {

    const store = vt3d.mainProxy
    const snap = useSnapshot(store)

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
        TracksEditorUtils.reRenderTrackSettings()
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
        vt3d.addTrack(Object.assign({}, storeEditor.track))
    })

    /**
     * Change track thickness
     *
     * @type {setThickness}
     */
    const setThickness = (event => {
        storeEditor.track.thickness = event.target.value
        TracksEditorUtils.reRenderTrackSettings()
        vt3d.addTrack(Object.assign({}, storeEditor.track))
    })

    /**
     * CHange DEM server
     *
     * @type {setDEMServer}
     */
    const setDEMServer = (event => {
        storeEditor.track.DEMServer = event.target.value
        TracksEditorUtils.reRenderTrackSettings()
        const tmp = Object.assign({}, storeEditor.track)
        tmp.computeAll()
        console.log(tmp)
        vt3d.addTrack(tmp)
    })

    return (<>
        <div id="track-settings" key={vt3d.mainProxy.components.tracksEditor.trackSettingsKey}>
            {/* Change visible name (title) */}
            <SlInput label="Name:" value={snapEditor.track.title}
                     onSlChange={setTitle}/>

            {/* Add DEM server selectionif we do ot have height initially (ie in the file) */
                !snapEditor.track.hasHeight && <DEMServerSelection
                    default={snapEditor.track?.DEMServer ?? NO_DEM_SERVER}
                    label={'Simulate Altitude:'}
                    onChange={setDEMServer}
                />}

            {/* Track line settings */}
            <label><SlIcon library="fa" name={FA2SL.set(faPenPaintbrush)}></SlIcon>Line</label>
            <br/>
            <div id="track-line-settings">
                <SlColorPicker opacity
                               size={'small'}
                               label={'Color'}
                               value={snapEditor.track.color}
                               swatches={vt3d.configuration.defaultTrackColors.join(';')}
                               onSlChange={setColor}>
                </SlColorPicker>
                <SlRange label={'Thickness (px)'} min={1} max={10} step={1}
                         value={snapEditor.track.thickness}
                         onSlChange={setThickness}/>
            </div>
        </div>

    </>)
})