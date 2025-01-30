import { useConfirm } from '@Components/Modals/ConfirmUI'
import {
    ToggleStateIcon,
}                     from '@Components/ToggleStateIcon'
import {
    ORIGIN_STORE, REFRESH_DRAWING, REMOVE_JOURNEY_IN_EDIT, SIMULATE_ALTITUDE, UPDATE_JOURNEY_SILENTLY,
}                     from '@Core/constants'
import {
    ElevationServer,
}                     from '@Core/Elevation/ElevationServer'
import {
    Journey,
}                     from '@Core/Journey'
import {
    RemoveJourney,
}                     from '@Editor/journey/RemoveJourney'
import {
    TrackData,
}                     from '@Editor/track/TrackData'
import {
    TrackFlagsSettings,
}                     from '@Editor/track/TrackFlagsSettings'
import {
    TrackPoints,
}                     from '@Editor/track/TrackPoints'
import {
    TrackStyleSettings,
}                     from '@Editor/track/TrackStyleSettings'
import {
    Utils,
}                     from '@Editor/Utils'
import {
    faCircleDot, faCrosshairsSimple, faDownload, faLocationDot, faLocationDotSlash, faPaintbrushPencil, faRectangleList,
    faTelescope,
}                     from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon, SlIconButton, SlInput, SlProgressBar, SlTab, SlTabGroup, SlTabPanel, SlTextarea, SlTooltip,
}                     from '@shoelace-style/shoelace/dist/react'
import {
    FEATURE_MULTILINE_STRING, FEATURE_POINT, TrackUtils,
}                     from '@Utils/cesium/TrackUtils'
import {
    FA2SL,
}                     from '@Utils/FA2SL'
import {
    UIToast,
}                     from '@Utils/UIToast'
import parse          from 'html-react-parser'
import React, {
    useEffect,
}                     from 'react'
import {
    sprintf,
}                     from 'sprintf-js'
import {
    useSnapshot,
}                     from 'valtio'
import {
    SelectElevationSource,
}                     from '../../MainUI/SelectElevationSource'
import {
    JourneyData,
}                     from './JourneyData'
import {
    JourneyPOIs,
}                     from './JourneyPOIs'

export const JourneySettings = function JourneySettings() {

    const editorStore = lgs.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)
    const former = editorStore.journey.elevationServer

    /**
     * Change journey description
     *
     * @type {(function(*): Promise<*>)|*}
     */
    const setDescription = async event => {
        const description = event.target.value
        // Title is empty, we force the former value
        if (description === '') {
            const field = document.getElementById('journey-description')
            field.value = editorStore.journey.description
            return
        }
        editorStore.journey.description = description
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
    }

    /**
     * Change Journey Title
     *
     * The selection box is then synchronised
     *
     * @type {setTitle}
     */
    const setTitle = async event => {
        const title = event.target.value
        // Title is empty, we force the former value
        if (title === '') {
            const field = document.getElementById('journey-title')
            field.value = editorStore.journey.title
            return
        }
        // title should not been already used for another journey.
        editorStore.journey.title = editorStore.journey.singleTitle(title)
        // If it is a mono track, we need to sync track title
        if (lgs.theJourney.hasOneTrack()) {
            const [slug, track] = lgs.theJourney.tracks.entries().next().value
            track.title = editorStore.journey.title
            editorStore.journey.tracks.set(slug, track)
            track.addToEditor()
            __.ui.profiler.updateTitle()

        }

        // Then use it
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneysList()
    }

    /**
     * Change journey visibility
     *
     */
    const setJourneyVisibility = async visibility => {
        editorStore.journey.visible = visibility
        lgs.theJourney.updateVisibility(visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }
    /**
     * Change POIs visibility
     *
     */
    const setAllPOIsVisibility = async visibility => {
        editorStore.journey.POIsVisible = visibility
        TrackUtils.updatePOIsVisibility(lgs.theJourney, visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    /**
     * Change Elevation instance
     *
     * @type {computeElevation}
     */
    const computeElevation = async event => {
        editorStore.journey.elevationServer = event.target.value

        editorStore.longTask = editorStore.journey.elevationServer !== ElevationServer.NONE

        // use an Elevation server
        const server = new ElevationServer(editorStore.journey.elevationServer)

        // Extract coordinates
        let allCoordinates = []
        // And Origin Data
        lgs.origin = JSON.parse(await lgs.db.lgs1920.get(editorStore.journey.slug, ORIGIN_STORE))

        let allOrigin = []

        lgs.theJourney.geoJson.features.forEach((feature, index) => {
            let coordinates = feature.geometry.coordinates
            let origin = lgs.origin.features[index].geometry.coordinates

            switch (feature.geometry.type) {
                case FEATURE_POINT:
                    // we do not have an array of array
                    coordinates = [coordinates]
                    break
                case FEATURE_MULTILINE_STRING:
                    // Easier to work with flatten array
                    coordinates = coordinates.flat()
                    origin = origin.flat()
                    break
            }

            coordinates.forEach((coordinate, index) => {
                allCoordinates.push([coordinate[0], coordinate[1]])
                allOrigin.push(origin[index])
            })
        })

        // Time to fetch
        server.getElevation(allCoordinates, allOrigin)
            .then(results => {

                // Suppress in progress notification
                editorStore.longTask = false

                if (results.errors) {
                    // Failure notification
                    results.errors.forEach(error => console.error(error))

                    UIToast.error({
                                      caption: `An error occurred when calculating elevations`,
                                      text:    'Changes aborted! Check logs to see error details.',
                                      error:   results.errors,
                                  })
                    editorStore.journey.elevationServer = former

                    return []
                }
                else {
                    // Success notification
                    UIToast.success({
                                        caption: `Elevation data have been modified`,
                                        text:    `Source:${ElevationServer.getServer(editorStore.journey.elevationServer).label}`,
                                    })
                    const coordinates = []
                    results.coordinates.forEach(coordinate => {
                        coordinates.push(coordinate)
                    })
                    return coordinates
                }
            })

            // Now manage and save new data
            .then(async coordinates => {
                if (coordinates.length > 0) {
                    const theJourney = Journey.deserialize({object: Journey.unproxify(lgs.theJourney)})
                    // Changes are OK, set data
                    let counter = 0

                    // coordinates is flat array, we need to slice it into chunks
                    // in order to realign data

                    theJourney.geoJson.features.forEach((feature, index, features) => {
                        let length = feature.geometry.coordinates.length
                        // We need to realign some types
                        switch (feature.geometry.type) {
                            case FEATURE_POINT:
                                // Need an array
                                feature.geometry.coordinates = [feature.geometry.coordinates[0]]
                                length = 1
                                break
                            case FEATURE_MULTILINE_STRING:
                                // Length is elements number, sub arrays included
                                length = feature.geometry.coordinates.flat().length
                                break
                        }

                        // Get the right part of coordinates
                        const chunk = coordinates.slice(counter, counter + length)
                        counter += length

                        switch (feature.geometry.type) {
                            case FEATURE_POINT:
                                // Realign data for Point: only an object
                                features[index].geometry.coordinates = chunk[0]
                                break
                            case FEATURE_MULTILINE_STRING: {
                                // Realign data for multi strings: slice it into segments
                                const tmp = features[index].geometry.coordinates
                                let subCounter = 0
                                tmp.forEach((segment, subIndex) => {
                                    features[index].geometry.coordinates[subIndex] = chunk.slice(subCounter, subCounter + tmp[subIndex].length)
                                    subCounter += tmp[subIndex].length
                                })
                                break
                            }
                            default:
                                features[index].geometry.coordinates = chunk
                        }
                    })

                    // Now we need to rebuild the data
                    theJourney.getTracksFromGeoJson(true)
                    theJourney.getPOIsFromGeoJson()
                    await theJourney.extractMetrics()
                    theJourney.addToContext()
                    theJourney.saveToDB()

                    // Then we redraw the journey
                    await Utils.updateJourney(SIMULATE_ALTITUDE)

                    // And update editor
                    Utils.updateJourneyEditor(theJourney.slug)

                    // If the Profile UI is open, we re-sync it
                    __.ui.profiler.draw()


                }
                else {
                    // Changes are in error, we reset selection
                    editorStore.journey.elevationServer = former
                }
            })

            .catch(error => {
                editorStore.longTask = false
                editorStore.journey.elevationServer = former
                // Failure notification
                console.error(error.errors ?? error)
                UIToast.error({
                                  caption: `An error occurred when calculating elevations`,
                                  text:    'Changes aborted! Check logs to see error details.',
                                  errors: error.errors ?? error,
                              })
            })


    }

    /**
     * Export journey confirmation
     */
    const Message = () => {
        return (<>{`'Not Yet. Sorry.'`}</>)
    }
    const [ConfirmExportJourneyDialog, confirmExportJourney] = useConfirm(`Export <strong>${editorSnapshot.journey.title}</strong> ?`, Message,
                                                                          // {
                                                                          //     text:'Export',
                                                                          //     icon:faDownload
                                                                          // }
    )

    /**
     * Export Journey
     */
    const exportJourney = async () => {
        const confirmation = await confirmExportJourney()
        if (confirmation) {
            // TODO
        }
    }

    /**
     * Focus on Journey
     */
    const focusOnJourney = async () => {
        await setJourneyVisibility(true)
        lgs.theJourney.focus({resetCamera: true, action: REFRESH_DRAWING})
    }

    const textVisibilityJourney = sprintf('%s Journey', editorSnapshot.journey.visible ? 'Hide' : 'Show')
    const textVisibilityPOIs = sprintf('%s POIs', editorSnapshot.journey.allPOIs ? 'Hide' : 'Show')

    let serverList = []

    if (!editorSnapshot.journey.hasElevation) {
        if (editorSnapshot.journey?.elevationServer === ElevationServer.NONE) {
            serverList.push(ElevationServer.FAKE_SERVERS.get(ElevationServer.NONE))
        }
        else {
            serverList.push(ElevationServer.FAKE_SERVERS.get(ElevationServer.CLEAR))
        }
    }
    else {
        serverList.push(ElevationServer.FAKE_SERVERS.get(ElevationServer.CLEAR))
        serverList.push(ElevationServer.FAKE_SERVERS.get(ElevationServer.FILE_CONTENT))
    }
    serverList = serverList.concat(Array.from(ElevationServer.SERVERS.values()))
    lgs.mainProxy.components.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)

    useEffect(() => {
        return (() => {
            lgs.mainProxy.components.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
        })
    }, [lgs.mainProxy.components.mainUI.removeJourneyDialog.active])

    return (<>
        {editorSnapshot.journey &&
            <div id="journey-settings" key={lgs.mainProxy.components.journeyEditor.keys.journey.settings}>
                <div className={'settings-panel'} id={'editor-journey-settings-panel'}>
                    <SlTabGroup className={'menu-panel'}>
                        <SlTab slot="nav" panel="data" id="tab-journey-data" active={editorSnapshot.tabs.journey.data}>
                            <SlIcon library="fa" name={FA2SL.set(faRectangleList)}/>Data
                        </SlTab>
                        <SlTab slot="nav" panel="edit" active={editorSnapshot.tabs.journey.edit}>
                            <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/>Edit
                        </SlTab>
                        {editorSnapshot.journey.tracks.size === 1 &&
                            <SlTab slot="nav" panel="points" active={editorSnapshot.tabs.journey.points}>
                                <SlIcon library="fa" name={FA2SL.set(faCircleDot)}/>Points
                            </SlTab>
                        }
                        <SlTab slot="nav" panel="pois" active={editorSnapshot.tabs.journey.pois}>
                            <SlIcon library="fa" name={FA2SL.set(faTelescope)}/>POIs
                        </SlTab>

                        {/**
                         * Data Tab Panel
                         */}
                        <SlTabPanel name="data">
                            {/* Add DEM instance selection if we do not have height initially (ie in the journey file) */}
                            <div className={'select-elevation-source'}>
                                <SelectElevationSource
                                    default={editorSnapshot.journey?.elevationServer}
                                    label={'Elevation:'}
                                    onChange={computeElevation}
                                    servers={serverList}
                                />

                                {editorSnapshot.longTask && <SlProgressBar indeterminate/>}

                            </div>
                            {editorSnapshot.journey.tracks.size === 1 && <TrackData/>}
                            {editorSnapshot.journey.tracks.size > 1 && <JourneyData/>}

                        </SlTabPanel>
                        {/**
                         * Edit  Tab Panel
                         */}
                        <SlTabPanel name="edit">
                            <div id={'journey-text-description'}>
                                {/* Change visible name (title) */}
                                <SlTooltip content={'Title'}>
                                    <SlInput id="journey-title"
                                             value={editorSnapshot.journey.title}
                                             onSlChange={setTitle}
                                    />
                                </SlTooltip>

                                {/* Change description */}
                                <SlTooltip hoist content={'Description'}>
                                    <SlTextarea row={2}
                                                size={'small'}
                                                id={'journey-description'}
                                                value={parse(editorSnapshot.journey.description)}
                                                onSlChange={setDescription}
                                                placeholder={'Journey description'}
                                    />
                                </SlTooltip>


                                { // if there only one track, the track style is here.
                                    editorSnapshot.journey.tracks.size === 1 && <TrackStyleSettings/>
                                }

                            </div>
                        </SlTabPanel>
                        {/**
                         * POIs Tab Panel
                         */}
                        <SlTabPanel name="pois">
                            <JourneyPOIs/>
                        </SlTabPanel>

                        {/**
                         * Points Tab Panel
                         */}
                        <SlTabPanel name="points">
                            <TrackPoints/>
                        </SlTabPanel>
                    </SlTabGroup>


                    <div id="journey-visibility" className={'editor-vertical-menu'}>
                        <span>
                        <SlTooltip hoist content={'Focus on journey'}>
                                <SlIconButton onClick={focusOnJourney} library="fa"
                                              name={FA2SL.set(faCrosshairsSimple)}/>
                        </SlTooltip>
                        <SlTooltip hoist content={textVisibilityJourney}>
                            <ToggleStateIcon change={setJourneyVisibility}
                                             initial={editorSnapshot.journey.visible}/>
                        </SlTooltip>
                            {editorSnapshot.journey.pois.size > 1 &&
                                <SlTooltip hoist content={textVisibilityPOIs}>
                                    <ToggleStateIcon
                                        change={setAllPOIsVisibility}
                                        initial={editorSnapshot.journey.POIsVisible}
                                        icons={{
                                            shown: faLocationDot, hidden: faLocationDotSlash,
                                        }}/>
                                </SlTooltip>
                            }

                            {editorSnapshot.journey.tracks.size === 1 && <TrackFlagsSettings/>}
                        </span>

                        <span>
                        <SlTooltip hoist content={'Export'}>
                                <SlIconButton onClick={exportJourney} library="fa" name={FA2SL.set(faDownload)}/>
                        </SlTooltip>
                        <RemoveJourney placement={'left'} name={REMOVE_JOURNEY_IN_EDIT}/>

                        </span>
                    </div>
                </div>
                <ConfirmExportJourneyDialog/>

            </div>}
    </>)
}