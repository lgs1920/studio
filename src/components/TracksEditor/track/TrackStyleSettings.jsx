import { DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE }            from '@Core/LGS1920Context'
import { SlColorPicker, SlDivider, SlRange, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                                   from '@Utils/cesium/TrackUtils'
import { useSnapshot } from 'valtio'
import { Utils }       from '../Utils'

export const TrackStyleSettings = function TrackSettings() {

    const editorStore = lgs.theJourneyEditorProxy

    // If we're editing a single track journey, we need
    // to know the track
    if (editorStore.track === null || editorStore.track === undefined) {
        (async () => await TrackUtils.setTheTrack(false))()
    }
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Change track Color
     *
     * @param {CustomEvent} event
     *
     */
    const setColor = (async event => {
        editorStore.track.color = event.target.value
        editorStore.track.marker.foregroundColor = event.target.value
        await Utils.updateTrack(event.type === 'sl-input' ? DRAW_WITHOUT_SAVE : DRAW_THEN_SAVE)
        __.ui.profiler.updateColor()
        __.ui.wanderer.updateColor()
    })


    /**
     * Change track thickness
     *
     * @param {CustomEvent} event
     */
    const setThickness = (async event => {
        editorStore.track.thickness = event.target.value
        await Utils.updateTrack(event.type === 'sl-input' ? DRAW_WITHOUT_SAVE : DRAW_THEN_SAVE)
    })

    return (
        <div id="track-line-settings">
            <SlTooltip hoist content="Color">
                <SlColorPicker opacity
                               size={'small'}
                               label={'Color'}
                               value={editorSnapshot.track.color}
                               swatches={lgs.configuration.defaultTrackColors.join(';')}
                               onSlChange={setColor}
                               onSlInput={setColor}
                               disabled={!editorSnapshot.track.visible}
                               noFormatToggle
                />
            </SlTooltip>
            <SlTooltip hoist content="Thickness">
                <SlRange min={1} max={10} step={1}
                         value={editorSnapshot.track.thickness}
                         style={{'--thumb-size': '1rem'}}
                         onSlInput={setThickness}
                         onSlChange={setThickness}
                         disabled={!editorSnapshot.track.visible}
                         tooltip={'bottom'}
                />
            </SlTooltip>

            <SlDivider id="test-line" style={{
                '--color': editorSnapshot.track.visible ? editorSnapshot.track.color : 'transparent',
                '--width': `${editorSnapshot.track.thickness}px`,
                '--spacing': 0,
            }}
                       disabled={!editorSnapshot.track.visible}
            />
        </div>
    )

}