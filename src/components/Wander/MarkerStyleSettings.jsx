import { DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE }            from '@Core/LGS1920Context'
import { SlColorPicker, SlDivider, SlRange, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                                   from '@Utils/cesium/TrackUtils'
import { useSnapshot } from 'valtio'

export const MarkerStyleSettings = function MarkerSettings() {

    const editorStore = lgs.theJourneyEditorProxy

    // If we're editing a single track journey, we need
    // to know the track
    if (editorStore.track === null || editorStore.track === undefined) {
        (async () => await TrackUtils.setTheTrack(false))()
    }
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Change Marker Color
     *
     * @param {CustomEvent} event
     *
     */
    const setColor = (async event => {
        editorStore.journey.marker.color = event.target.value
        __.ui.profiler.updateColor()
    })


    /**
     * Change Marker thickness
     *
     * @param {CustomEvent} event
     */
    const setThickness = (async event => {
        editorStore.journey.marker.thickness = event.target.value
    })

    return (
        <div id="Marker-line-settings">
            <SlTooltip hoist content="Color">
                <SlColorPicker hoist opacity
                               size={'small'}
                               label={'Color'}
                               value={editorStore?.journey?.marker?.color ?? ''}
                               swatches={lgs.configuration.colorSwatches.join(';')}
                               onSlChange={setColor}
                               onSlInput={setColor}
                             //  disabled={!editorSnapshot.track.visible}
                               noFormatToggle
                               inline={false}
                />
            </SlTooltip>
            <SlTooltip hoist content="Thickness">
                <SlRange min={1} max={10} step={1}
                         value={editorSnapshot.editorStore?.journey?.marker?.thickness}
                         style={{'--thumb-size': '1rem'}}
                         onSlInput={setThickness}
                         onSlChange={setThickness}
                        // disabled={!editorSnapshot.track.visible}
                         tooltip={'bottom'}
                />
            </SlTooltip>

            {/* TODO add a pseudo marker to see the change */}
        </div>
    )

}