import { DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE, SECOND } from '@Core/constants'
import { SlColorPicker, SlDivider, SlRange, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                                from '@Utils/cesium/TrackUtils'
import { useEffect, useRef, useState }               from 'react'
import { useSnapshot }                               from 'valtio'
import { Utils }                                        from '../Utils'

export const TrackStyleSettings = function TrackSettings() {

    const editorStore = lgs.theJourneyEditorProxy
    const [update, setUpdate] = useState(false)
    const [updateDone, setUpdateDone] = useState(false)

    const timeoutRef = useRef(null)

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
        if (!timeoutRef.current) {
            await Utils.updateTrack(DRAW_THEN_SAVE)
        }
    })

    const requestRender = () => {
        setUpdate(false)
        lgs.scene.requestRender()
        if (!timeoutRef.current) {
            timeoutRef.current = setTimeout(() => {
                lgs.scene.postUpdate.removeEventListener(requestRender)
                timeoutRef.current = null
            }, 0.2 * SECOND)
        }
    }

    const postRenderHandler = () => {
        setUpdate(false)
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
    }

    const handleCameraMove = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
        lgs.scene.postUpdate.removeEventListener(requestRender) // Retirer PostUpdate
        lgs.scene.camera.changed.removeEventListener(handleCameraMove) // Nettoyage
    }
    useEffect(() => {
        setUpdate(true)
        timeoutRef.current = null

        lgs.scene.postUpdate.addEventListener(requestRender)
        lgs.scene.camera.changed.addEventListener(handleCameraMove)

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
            lgs.scene.postUpdate.removeEventListener(requestRender)
            lgs.scene.camera.changed.removeEventListener(handleCameraMove)
            lgs.scene.postRender.removeEventListener(postRenderHandler)
        }
    }, [editorSnapshot.track.color, editorSnapshot.track.thickness])

    return (
        <div id="track-line-settings">
            <SlTooltip hoist content="Color">
                <SlColorPicker opacity
                               size={'small'}
                               label={'Color'}
                               value={editorSnapshot.track.color}
                               swatches={lgs.settings.getSwatches.list.join(';')}
                               onSlChange={setColor}
                    // onSlInput={setColor}
                               disabled={!editorSnapshot.track.visible}
                               noFormatToggle
                />
            </SlTooltip>
            <SlTooltip hoist content="Thickness">
                <SlRange min={1} max={10} step={1}
                         value={editorSnapshot.track.thickness}
                         onSlInput={setThickness}
                    //  onSlChange={setThickness}
                         disabled={!editorSnapshot.track.visible}
                         tooltip={'bottom'}
                         hoist
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