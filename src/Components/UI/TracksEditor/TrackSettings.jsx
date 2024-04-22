import { faMemoCircleInfo, faPenPaintbrush, faRectangleList } from '@fortawesome/pro-regular-svg-icons'
import { faLocationPin, faLocationPinSlash }                  from '@fortawesome/pro-solid-svg-icons'

import {
    SlColorPicker, SlDivider, SlIcon, SlInput, SlRange, SlTab, SlTabGroup, SlTabPanel, SlTextarea, SlTooltip,
}                                                   from '@shoelace-style/shoelace/dist/react'
import { useSnapshot }                              from 'valtio'
import { FLAG_START, FLAG_STOP, Journey, POI_FLAG } from '../../../classes/Journey'
import { Track }                                    from '../../../classes/Track'
import { FA2SL }                                    from '../../../Utils/FA2SL'
import { TracksEditorUtils }                        from '../../../Utils/TracksEditorUtils'
import { useConfirm }                               from '../Modals/ConfirmUI'
import { ToggleStateIcon }                          from '../ToggleStateIcon'

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
    const [ConfirmRemoveTrackDialog, confirmRemoveTrack] = useConfirm(`Remove "${editorSnapshot.journey.title}" ?`, 'Are you sure you want to remove this track ?')

    /**
     * Change track Color
     *
     * @type {setColor}
     */
    const setColor = (async event => {
        editorStore.track.color = event.target.value
        await updateTrack(UPDATE_TRACK_THEN_DRAW)
    })

    const setDescription = (async event => {
        const description = event.target.value
        // Title is empty, we force the former value
        if (description === '') {
            const field = document.getElementById('track-description')
            field.value = editorStore.track.description
            return
        }
        editorStore.track.description = description
        await updateTrack(UPDATE_TRACK_SILENTLY)
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

        editorStore.track.title = _.app.singleTitle(title, Array.from(editorStore.journey.tracks.values()).map(track => {
            return track.title
        }))

        await updateTrack(UPDATE_TRACK_SILENTLY)
        TracksEditorUtils.renderTracksList()
    })

    /**
     * Change track thickness
     *
     * @type {setThickness}
     */
    const setThickness = (async event => {
        editorStore.track.thickness = event.target.value
        if (event.type === 'sl-input') {
            return
        }
        await updateTrack(UPDATE_TRACK_THEN_DRAW)
        TracksEditorUtils.renderTrackSettings()
    })

    /**
     * Change track visibility
     *
     * @type {setThickness}
     */
    const setTrackVisibility = async visibility => {
        //saveToDB state
        editorStore.track.visible = visibility

        // Change track visibility by changing it for each entity
        if (visibility) {
            // We show all tracks and created pois Except for start and stop,
            // for which the pre-masking status is maintained.
            dataSource.entities.values.forEach(entity => {
                if (entity.id.startsWith(POI_FLAG)) {
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
                entity.show = false
            })
        }
        await updateTrack(UPDATE_TRACK_SILENTLY)
        TracksEditorUtils.renderTrackSettings()
    }

    const setStartFlagVisibility = (visibility) => {

    }

    const setStopFlagVisibility = (visibility => {

    })


    /**
     * Change poi visibility
     *
     * @type {setMarkerVisibility}
     */
    const setMarkerVisibility = (async event => {
        // Which poi ?
        const type = event.target.id.endsWith(FLAG_START) ? FLAG_START : FLAG_STOP

        // Save state
        poi.store(type).visible = event.target.checked

        // Toggle poi visibility
        dataSource.entities.values.forEach(entity => {
            if (entity.id.endsWith(type)) {
                entity.show = event.target.checked
            }
        })
        // As there's no rebuild, let's saveToDB to DB now
        await updateTrack(UPDATE_TRACK_SILENTLY)
        TracksEditorUtils.renderTrackSettings()

    })

    /**
     * Re build the track object,
     * Re compute metrix //TODO voir one peut paseprendre le anciens(tant que DEM n'a pa change)
     *
     * @return {Journey}
     */
    const updateTrack = async (action) => {

        // Update the journey
        editorStore.journey.tracks.set(editorStore.track.slug, editorStore.track)

        const journey = Journey.deserialize({object: Journey.unproxify(editorStore.journey)})
        const track = Track.deserialize({object: Track.unproxify(editorStore.track)})

        // Prepare to draw
        // await journey.computeAll()
        vt3d.saveJourney(journey)

        // saveToDB toDB
        await journey.saveToDB()

        // // Show the journey
        // journey.loadAfterNewSettings(action).then(() => {
        //     if (action !== UPDATE_TRACK_SILENTLY) {
        //         TrackUtils.focus(track)
        //     }
        // })
    }

    /**
     * Marker ToggleStateIcon component
     * @param props
     *
     * @return {JSX.Element}
     *
     * @constructor
     */
    const MarkerVisibility = (props) => {

        return (<>
            {/* <div id={`visibility-poi-${props.type}`}> */}
            {/*     <SlSwitch size="small" */}
            {/*               checked={poi.snap(props.type)?.visible} */}
            {/*               style={{'--thumb-size': '1rem'}} */}
            {/*               onSlChange={setMarkerVisibility} */}
            {/*               id={`switch-visibility-poi-${props.type}`} */}
            {/*     > <span style={{color: vt3d.configuration.journey.pois[props.type].color}}> */}
            {/*                 <SlIcon library="fa" */}
            {/*                         className={'fa-lg'} */}
            {/*                         name={FA2SL.set(faLocationDot)}/> */}
            {/*             </span>{props.label}</SlSwitch> */}
            {/* </div> */}
        </>)
    }

    const textVisibilityTrack = sprintf('%s Track', editorSnapshot.track.visible ? 'Hide' : 'Show')
    const textVisibilityStartFlag = 'test'//sprintf('%s Flag', editorSnapshot.track.flags.start.visibility ? 'Hide' :
                                          // 'Show')
    const textVisibilityStopFlag = 'test'//sprintf('%s Flag', editorSnapshot.track.flags.stop.visibility ? 'Hide' :
                                         // 'Show')
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
                                />
                            </SlTooltip>
                        </>}
                        {editorSnapshot.track.visible && <SlTabGroup id={'track-menu-panel'}>
                            <SlTab slot="nav" panel="style">
                                <SlIcon library="fa" name={FA2SL.set(faPenPaintbrush)}/>&nbsp;Style
                            </SlTab>
                            <SlTab slot="nav" panel="info">
                                <SlIcon library="fa" name={FA2SL.set(faMemoCircleInfo)}/>&nbsp;Data
                            </SlTab>
                            <SlTab slot="nav" panel="coordinates">
                                <SlIcon library="fa" name={FA2SL.set(faRectangleList)}/>&nbsp;Coords.
                            </SlTab>
                            {/**
                             * Style Tab Panel
                             */}
                            <SlTabPanel name="style">
                                {/* Journey line settings */}
                                <div id="track-line-settings">
                                    <SlTooltip content="Color">
                                        <SlColorPicker opacity
                                                       size={'small'}
                                                       label={'Color'}
                                                       value={editorSnapshot.journey.color}
                                                       swatches={vt3d.configuration.defaultTrackColors.join(';')}
                                                       onSlChange={setColor}
                                                       disabled={!editorSnapshot.journey.visible}
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
                                </div>
                            </SlTabPanel>
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
                                                 initial={false /* TODO editorStore.track.visible*/}/>
                            </SlTooltip>
                            <SlTooltip content={textVisibilityStopFlag}>
                                <ToggleStateIcon change={setStopFlagVisibility}
                                                 id={'stop-visibility'}
                                                 icons={{
                                                     shown: faLocationPin, hidden: faLocationPinSlash,
                                                 }}
                                                 style={{color: vt3d.configuration.journey.pois.stop.color}}
                                                 initial={false /* TODO editorStore.track.visible*/}/>
                            </SlTooltip>
                        </>}
                    </div>
                </div>


            </>}
        </>

    )
}