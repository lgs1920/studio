import { faMemoCircleInfo, faRectangleList } from '@fortawesome/pro-regular-svg-icons'
import { faLocationPin, faLocationPinSlash } from '@fortawesome/pro-solid-svg-icons'

import {
    SlColorPicker, SlDivider, SlIcon, SlInput, SlRange, SlTab, SlTabGroup, SlTabPanel, SlTextarea, SlTooltip,
}                                        from '@shoelace-style/shoelace/dist/react'
import { useSnapshot }                   from 'valtio'
import { Journey, NO_FOCUS, RE_LOADING } from '../../../core/Journey'
import { Track }                         from '../../../core/Track'
import { TrackUtils }                    from '../../../Utils/cesium/TrackUtils'
import { FA2SL }                         from '../../../Utils/FA2SL'
import { TracksEditorUtils }             from '../../../Utils/TracksEditorUtils'
import { ToggleStateIcon }               from '../ToggleStateIcon'

export const TrackSettings = function TrackSettings() {

    const DRAW_THEN_SAVE = 1
    const DRAW_WITHOUT_SAVE = 2
    const JUST_SAVE = 3

    const editorStore = vt3d.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    let dataSource = vt3d.viewer.dataSources.getByName(editorStore.journey.slug)[0]

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

    /**
     * Re build the track object,
     * Re compute metrix //TODO voir one peut paseprendre le anciens(tant que DEM n'a pa change)
     *
     * @return {Journey}
     */
    const updateTrack = async (action) => {

        // Update the track
        editorStore.journey.tracks.set(editorStore.track.slug, editorStore.track)
        const journey = Journey.deserialize({object: Journey.unproxify(editorStore.journey)})
        const track = Track.deserialize({object: Track.unproxify(editorStore.track)})
        // await journey.computeAll()

        if (action === DRAW_THEN_SAVE || action === JUST_SAVE) {
            vt3d.saveJourney(journey)
            // saveToDB toDB
            await journey.saveToDB()
        }

        if (action === DRAW_WITHOUT_SAVE || action === DRAW_THEN_SAVE) {
            await track.draw({action: RE_LOADING, mode: NO_FOCUS})
        }

    }

    /**
     * Track Style sub-component
     *
     * @return {JSX.Element}
     * @constructor
     */
    const Style = () => {
        return (<div id="track-line-settings">
            <SlTooltip content="Color">
                <SlColorPicker opacity
                               size={'small'}
                               label={'Color'}
                               value={editorSnapshot.track.color}
                               swatches={vt3d.configuration.defaultTrackColors.join(';')}
                               onSlChange={setColor}
                               onSlInput={setColor}
                               disabled={!editorSnapshot.track.visible}
                               noFormatToggle
                />
            </SlTooltip>
            <SlTooltip content="Thickness">
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
        </div>)
    }

    const textVisibilityTrack = sprintf('%s Track', editorSnapshot.track.visible ? 'Hide' : 'Show')
    const textVisibilityStartFlag = sprintf('%s Flag', editorStore.track?.flags?.start?.visible ? 'Hide' : 'Show')
    const textVisibilityStopFlag = sprintf('%s Flag', editorStore.track?.flags?.stop?.visible ? 'Hide' : 'Show')
    const severalTracks = editorStore.journey.tracks.size > 1

    return (<>
            {editorSnapshot.track && <>
                <div id={'editor-track-settings-panel'}
                     key={vt3d.mainProxy.components.journeyEditor.keys.journey.track}>

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
                        <Style/>

                        {editorSnapshot.track.visible && <SlTabGroup id={'track-menu-panel'}>
                            <SlTab slot="nav" panel="info">
                                <SlIcon library="fa" name={FA2SL.set(faMemoCircleInfo)}/>&nbsp;Data
                            </SlTab>
                            <SlTab slot="nav" panel="coordinates">
                                <SlIcon library="fa" name={FA2SL.set(faRectangleList)}/>&nbsp;Coords.
                            </SlTab>

                            {/**
                             * Edit Data Tab Panel
                             */}
                            <SlTabPanel name="info">Not Yet !</SlTabPanel>

                            {/**
                             * Edit Coordinates Tab Panel
                             */}
                            <SlTabPanel name="coordinates">Not Yet!</SlTabPanel>

                        </SlTabGroup>}
                    </div>
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