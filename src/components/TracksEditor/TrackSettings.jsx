import { ToggleStateIcon }                                                    from '@Components/ToggleStateIcon'
import { faRectangleList }                                                    from '@fortawesome/pro-regular-svg-icons'
import { faCircleDot, faLocationPin, faLocationPinSlash, faPaintbrushPencil } from '@fortawesome/pro-solid-svg-icons'

import {
    SlIcon, SlInput, SlTab, SlTabGroup, SlTabPanel, SlTextarea, SlTooltip,
}                                                       from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                                   from '@Utils/cesium/TrackUtils'
import { FA2SL }                                        from '@Utils/FA2SL'
import { TracksEditorUtils }                            from '@Utils/TracksEditorUtils'
import { useSnapshot }                                  from 'valtio'
import { DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE, JUST_SAVE } from '../../core/VT3D'
import { updateTrack }                                  from './tools'
import { TrackStyleSettings }                           from './TrackStyleSettings'

export const TrackSettings = function TrackSettings() {

    const editorStore = vt3d.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Change track Color
     *
     * @param {CustomEvent} event
     *
     */
    const setColor = (async event => {
        editorStore.track.color = event.target.value
        await updateTrack(event.type === 'sl-input' ? DRAW_WITHOUT_SAVE : DRAW_THEN_SAVE)
    })

    /**
     * Change the track description
     *
     * @param {CustomEvent} event
     *
     */
    const setDescription = (async event => {
        editorStore.track.description = event.target.value
        await updateTrack(JUST_SAVE)
    })

    /**
     * Change Track Title
     *
     * @param {CustomEvent} event
     */
    const setTitle = (async event => {
        const title = event.target.value
        // Title is empty, we force the former value
        if (title === '') {
            const field = document.getElementById('track-title')
            field.value = editorStore.track.title
            return
        }
        // Let's check if the next title has not been already used for another track.
        const titles = []
        editorStore.journey.tracks.forEach(track => {
            titles.push(track)
        })
        editorStore.track.title = _.app.singleTitle(title, titles)

        await updateTrack(JUST_SAVE)
        TracksEditorUtils.renderTracksList()
    })

    /**
     * Change track thickness
     *
     * @param {CustomEvent} event
     */
    const setThickness = (async event => {
        editorStore.track.thickness = event.target.value
        await updateTrack(event.type === 'sl-input' ? DRAW_WITHOUT_SAVE : DRAW_THEN_SAVE)
    })

    /**
     * Change track visibility
     *
     * @param {CustomEvent} event
     */
    const setTrackVisibility = async visibility => {
        //saveToDB state
        editorStore.track.visible = visibility
        TrackUtils.updateTrackVisibility(editorStore.journey, editorStore.track, visibility)
        await updateTrack(JUST_SAVE)
    }

    /**
     * Change Start flag visibility
     *
     * @param visibility
     *
     */
    const setStartFlagVisibility = async visibility => {
        editorStore.track.flags.start.visible = visibility
        TrackUtils.updateFlagsVisibility(editorStore.journey, editorStore.track, 'start', visibility)
        await updateTrack(JUST_SAVE)
    }

    /**
     *
     * Change Stop flag visibility
     *
     * @param visibility
     *
     */
    const setStopFlagVisibility = async visibility => {
        editorStore.track.flags.stop.visible = visibility
        TrackUtils.updateFlagsVisibility(editorStore.journey, editorStore.track, 'stop', visibility)
        await updateTrack(JUST_SAVE)
    }

    const textVisibilityTrack = sprintf('%s Track', editorSnapshot.track.visible ? 'Hide' : 'Show')
    const textVisibilityStartFlag = sprintf('%s Flag', editorStore.track?.flags?.start?.visible ? 'Hide' : 'Show')
    const textVisibilityStopFlag = sprintf('%s Flag', editorStore.track?.flags?.stop?.visible ? 'Hide' : 'Show')
    const severalTracks = editorStore.journey.tracks.size > 1

    return (<>
            {editorSnapshot.track && severalTracks && <>
                <div className={'settings-panel'} id={'editor-track-settings-panel'}
                     key={vt3d.mainProxy.components.journeyEditor.keys.journey.track}>
                    {editorSnapshot.track.visible && <SlTabGroup id={'track-menu-panel'} className={'menu-panel'}>
                        <SlTab slot="nav" panel="data">
                            <SlIcon library="fa" name={FA2SL.set(faRectangleList)}/>Data
                        </SlTab>
                        <SlTab slot="nav" panel="edit">
                            <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/>Edit
                        </SlTab>
                        <SlTab slot="nav" panel="points">
                            <SlIcon library="fa" name={FA2SL.set(faCircleDot)}/>Points
                        </SlTab>


                        {/**
                         * Data Tab Panel
                         */}
                        <SlTabPanel name="data">Not Yet !</SlTabPanel>

                        {/**
                         * Edit Tab Panel
                         */}
                        <SlTabPanel name="edit">
                            <div id={'track-text-description'}>
                                {severalTracks && <>
                                    {/* Change visible name (title) */}
                                    <SlTooltip content={'Title'}>
                                        <SlInput id="track-title"
                                                 value={editorSnapshot.track.title}
                                                 onSlChange={setTitle}
                                        />
                                    </SlTooltip>
                                    {/* Change description */}
                                    <SlTooltip content={'Description'}>
                                        <SlTextarea row={2}
                                                    size={'small'}
                                                    id="track-description"
                                                    value={editorSnapshot.track.description}
                                                    onSlChange={setDescription}
                                                    placeholder={'Track description'}
                                        />
                                    </SlTooltip>

                                </>}
                                {/* Track style */}
                                <TrackStyleSettings/>
                            </div>
                        </SlTabPanel>

                        {/**
                         * Points Tab Panel
                         */}
                        <SlTabPanel name="points">Not Yet!</SlTabPanel>

                    </SlTabGroup>}

                    <div id="track-visibility" className={'editor-vertical-menu'}>
                        {severalTracks && <SlTooltip content={textVisibilityTrack}>
                            <ToggleStateIcon change={setTrackVisibility} initial={editorSnapshot.track.visible}/>
                        </SlTooltip>}
                        {editorSnapshot.track.visible && <>
                            <SlTooltip content={textVisibilityStartFlag}>
                                <ToggleStateIcon change={setStartFlagVisibility}
                                                 id={'start-visibility'}
                                                 icons={{
                                                     shown: faLocationPin, hidden: faLocationPinSlash,
                                                 }}
                                                 style={{color: vt3d.configuration.journey.pois.start.color}}
                                                 initial={editorSnapshot?.track.flags.start.visible}/>
                            </SlTooltip>
                            <SlTooltip content={textVisibilityStopFlag}>
                                <ToggleStateIcon change={setStopFlagVisibility}
                                                 id={'stop-visibility'}
                                                 icons={{
                                                     shown: faLocationPin, hidden: faLocationPinSlash,
                                                 }}
                                                 style={{color: vt3d.configuration.journey.pois.stop.color}}
                                                 initial={editorSnapshot?.track.flags.stop.visible}/>
                            </SlTooltip>
                        </>}
                    </div>
                </div>
            </>}
        </>

    )
}