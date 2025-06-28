/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-28
 * Last modified: 2025-06-28
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FAButton } from '@Components/FAButton'
import { MapPOIEditFilter } from '@Components/MainUI/MapPOI/MapPOIEditFilter'
import { MapPOIEditSettings } from '@Components/MainUI/MapPOI/MapPOIEditSettings'
import { MapPOIEditToggleFilter } from '@Components/MainUI/MapPOI/MapPOIEditToggleFilter'
import { MapPOIList }         from '@Components/MainUI/MapPOI/MapPOIList'
import {
    useConfirm,
}                   from '@Components/Modals/ConfirmUI'
import {
    ToggleStateIcon,
}                   from '@Components/ToggleStateIcon'
import {
    CURRENT_JOURNEY, JOURNEY_EDITOR_DRAWER,
    ORIGIN_STORE, POI_STANDARD_TYPE, POIS_EDITOR_DRAWER, REFRESH_DRAWING, REMOVE_JOURNEY_IN_EDIT, SIMULATE_ALTITUDE,
    UPDATE_JOURNEY_SILENTLY,
} from '@Core/constants'
import {
    ElevationServer,
}                   from '@Core/Elevation/ElevationServer'
import {
    Journey,
}                   from '@Core/Journey'
import {
    RemoveJourney,
}                   from '@Editor/journey/RemoveJourney'
import {
    TrackData,
}                   from '@Editor/track/TrackData'
import {
    TrackFlagsSettings,
}                   from '@Editor/track/TrackFlagsSettings'
import {
    TrackPoints,
}                   from '@Editor/track/TrackPoints'
import {
    TrackStyleSettings,
}                   from '@Editor/track/TrackStyleSettings'
import {
    Utils,
}                   from '@Editor/Utils'
import {
    faArrowRotateRight, faCircleDot, faCrosshairsSimple, faDownload, faLocationDot, faLocationDotSlash,
    faPaintbrushPencil, faRectangleList,
}                   from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon, SlIconButton, SlInput, SlProgressBar, SlTab, SlTabGroup, SlTabPanel, SlTextarea, SlTooltip,
}                   from '@shoelace-style/shoelace/dist/react'
import {
    FEATURE_MULTILINE_STRING, FEATURE_POINT, TrackUtils,
}                   from '@Utils/cesium/TrackUtils'
import {
    FA2SL,
}                   from '@Utils/FA2SL'
import {
    UIToast,
}                   from '@Utils/UIToast'
import classNames   from 'classnames'
import parse        from 'html-react-parser'
import React, {
    useEffect, useMemo, useRef, useState,
} from 'react'
import {
    sprintf,
}                   from 'sprintf-js'
import {
    useSnapshot,
}                   from 'valtio'
import {
    SelectElevationSource,
}                   from '../../MainUI/SelectElevationSource'
import {
    JourneyData,
}                   from './JourneyData'

export const JourneySettings = function JourneySettings() {

    const $theJourneyEditor = lgs.stores.journeyEditor
    const theJourneyEditor = useSnapshot($theJourneyEditor)
    const former = $theJourneyEditor.journey.elevationServer
    const editorStore = useSnapshot(lgs.theJourneyEditorProxy)
    const $main = lgs.stores.main
    const main = useSnapshot($main, {sync: true})
    const $rotate = lgs.stores.main.components.mainUI.rotate
    const rotate = useSnapshot($rotate)
    const tabgroup = useRef(null)

    const autoRotate = useSnapshot(lgs.settings.ui.camera.start.rotate)
    let rotationAllowed = false
    const manualRotate = useRef(null)

    const POIS = 'pois'

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
            field.value = $theJourneyEditor.journey.description
            return
        }
        $theJourneyEditor.journey.description = description
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
            field.value = $theJourneyEditor.journey.title
            return
        }
        // title should not been already used for another journey.
        $theJourneyEditor.journey.title = $theJourneyEditor.journey.singleTitle(title)
        // If it is a mono track, we need to sync track title
        if (lgs.theJourney.hasOneTrack()) {
            const [slug, track] = lgs.theJourney.tracks.entries().next().value
            track.title = $theJourneyEditor.journey.title
            $theJourneyEditor.journey.tracks.set(slug, track)
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
        stopRotate()
        $theJourneyEditor.journey.visible = visibility
        lgs.theJourney.updateVisibility(visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }
    /**
     * Change POIs visibility
     *
     */
    const setAllPOIsVisibility = async visibility => {
        $theJourneyEditor.journey.POIsVisible = visibility
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
        $theJourneyEditor.journey.elevationServer = event.target.value

        $theJourneyEditor.longTask = $theJourneyEditor.journey.elevationServer !== ElevationServer.NONE

        // use an Elevation server
        const server = new ElevationServer($theJourneyEditor.journey.elevationServer)

        // Extract coordinates
        let allCoordinates = []
        // And Origin Data
        lgs.origin = JSON.parse(await lgs.db.lgs1920.get($theJourneyEditor.journey.slug, ORIGIN_STORE))

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
                $theJourneyEditor.longTask = false

                if (results.errors) {
                    // Failure notification
                    results.errors.forEach(error => console.error(error))

                    UIToast.error({
                                      caption: `An error occurred when calculating elevations`,
                                      text:    'Changes aborted! Check logs to see error details.',
                                      error:   results.errors,
                                  })
                    $theJourneyEditor.journey.elevationServer = former

                    return []
                }
                else {
                    // Success notification
                    UIToast.success({
                                        caption: `Elevation data have been modified`,
                                        text: `Source:${ElevationServer.getServer($theJourneyEditor.journey.elevationServer).label}`,
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
                    await theJourney.getPOIsFromGeoJson()
                    await theJourney.extractMetrics()
                    theJourney.addToContext()
                    await theJourney.persistToDatabase()

                    // Then we redraw the journey
                    await Utils.updateJourney(SIMULATE_ALTITUDE)

                    // And update editor
                    Utils.updateJourneyEditor(theJourney.slug, {})

                    // If the Profile UI is open, we re-sync it
                    __.ui.profiler.draw()


                }
                else {
                    // Changes are in error, we reset selection
                    $theJourneyEditor.journey.elevationServer = former
                }
            })

            .catch(error => {
                $theJourneyEditor.longTask = false
                $theJourneyEditor.journey.elevationServer = former
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
    const [ConfirmExportJourneyDialog, confirmExportJourney] = useConfirm(`Export <strong>${theJourneyEditor.journey.title}</strong> ?`, Message,
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

    const stopRotate = async () => {
        if ($rotate.running) {
            await __.ui.cameraManager.stopRotate()
        }
    }

    const forceRotate = async () => {
        rotationAllowed = !rotationAllowed
        await focusOnJourney()
    }

    const maybeRotate = async () => {
        if ($rotate.running) {
            rotationAllowed = false
            stopRotate()
            if ($rotate.target.element && $rotate.target.element === lgs.theJourney.element) {
                return
            }
        }

        rotationAllowed = autoRotate.journey
        await focusOnJourney()
    }

    /**
     * Focus on Journey
     */
    const focusOnJourney = async (event) => {
        if ($rotate.running) {
            await __.ui.cameraManager.stopRotate()
            if (rotate.target?.instanceOf(CURRENT_JOURNEY)) {
                return
            }
        }
        await setJourneyVisibility(true)
        lgs.theJourney.focus({
                                 resetCamera: true,
                                 action:      REFRESH_DRAWING,
                                 rotate: rotationAllowed || autoRotate.journey,
                             })
    }

    const textVisibilityJourney = sprintf('%s Journey', theJourneyEditor.journey.visible ? 'Hide' : 'Show')
    const textVisibilityPOIs = sprintf('%s POIs', theJourneyEditor.journey.allPOIs ? 'Hide' : 'Show')

    // Memoize serverList based on journey elevation properties
    const serverList = useMemo(() => {
        const list = []

        if (!theJourneyEditor.journey.hasElevation) {
            if (theJourneyEditor.journey?.elevationServer === ElevationServer.NONE) {
                list.push(ElevationServer.FAKE_SERVERS.get(ElevationServer.NONE))
            }
            else {
                list.push(ElevationServer.FAKE_SERVERS.get(ElevationServer.CLEAR))
            }
        }
        else {
            list.push(ElevationServer.FAKE_SERVERS.get(ElevationServer.CLEAR))
            list.push(ElevationServer.FAKE_SERVERS.get(ElevationServer.FILE_CONTENT))
        }

        return list.concat(Array.from(ElevationServer.SERVERS.values()))
    }, [theJourneyEditor.journey.hasElevation, theJourneyEditor.journey.elevationServer]);

    // Handle removeJourneyDialog.active state
    useEffect(() => {
        lgs.stores.main.components.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)

        // Cleanup (already present in original code)
        return () => {
            lgs.stores.main.components.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
        }
    }, []) // Empty dependency array ensures this runs only on mount/unmount

    useEffect(() => {
        return (() => {
            lgs.stores.main.components.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
        })
    }, [lgs.stores.main.components.mainUI.removeJourneyDialog.active])

    const initTab = (event) => {

        __.ui.drawerManager.tab = event.detail.name
        if (event.detail.name === POIS) {
            // We show the settings only when pois tab is open
            lgs.stores.journeyEditor.showPOIsFilter = event.type === 'sl-tab-show'
        }
        else {
            lgs.stores.journeyEditor.showPOIsFilter = false
        }
    }

    const isTabActive = (tab) => {
        return __.ui.drawerManager.tabActive(tab)
    }

    const DATA_PANEL = 'tab-data'
    const EDIT_PANEL = 'tab-edit'
    const POINTS_PANEL = 'tab-points'
    const POIS_PANEL = `tab-${POIS}`

    return (<>
        {theJourneyEditor.journey && main.drawers.open === JOURNEY_EDITOR_DRAWER &&

            <div id="journey-settings" key={lgs.stores.main.components.journeyEditor.keys.journey.settings}>
                <div className={'settings-panel'} id={'editor-journey-settings-panel'}>
                    <SlTabGroup className={'menu-panel'} ref={tabgroup}
                                onSlTabShow={initTab} onSlTabHide={initTab}>
                        <SlTab slot="nav" panel={DATA_PANEL} id="tab-journey-data"
                               active={isTabActive(DATA_PANEL)}>
                            <SlIcon library="fa" name={FA2SL.set(faRectangleList)}/>Data
                        </SlTab>
                        <SlTab slot="nav" panel={EDIT_PANEL} active={isTabActive(EDIT_PANEL)}>
                            <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/>Edit
                        </SlTab>
                        {/* {theJourneyEditor.journey.tracks.size === 1 && */}
                        {/*     <SlTab slot="nav" panel="POINTS_PANEL" active={isTabEactive(POINTS_PANEL)}> */}
                        {/*         <SlIcon library="fa" name={FA2SL.set(faCircleDot)}/>Points */}
                        {/*     </SlTab> */}
                        {/* } */}
                        <SlTab slot="nav" panel={POIS_PANEL} active={isTabActive(POIS_PANEL)}>
                            <SlIcon library="fa" name={FA2SL.set(faLocationDot)}/>POIs
                        </SlTab>

                        <MapPOIEditToggleFilter slot="nav" visible={theJourneyEditor.tabs.journey.pois}/>

                        {/**
                         * Data Tab Panel
                         */}
                        <SlTabPanel name={DATA_PANEL}>
                            {/* Add DEM instance selection if we do not have height initially (ie in the journey file) */}
                            <div className={'select-elevation-source'}>
                                <SelectElevationSource
                                    default={theJourneyEditor.journey?.elevationServer}
                                    label={'Elevation:'}
                                    onChange={computeElevation}
                                    servers={serverList}
                                />

                                {theJourneyEditor.longTask && <SlProgressBar indeterminate/>}

                            </div>
                            {theJourneyEditor.journey.tracks.size === 1 && <TrackData/>}
                            {theJourneyEditor.journey.tracks.size > 1 && <JourneyData/>}

                        </SlTabPanel>
                        {/**
                         * Edit  Tab Panel
                         */}
                        <SlTabPanel name={EDIT_PANEL}>
                            <div id={'journey-text-description'}>
                                {/* Change visible name (title) */}
                                <SlTooltip content={'Title'}>
                                    <SlInput id="journey-title"
                                             value={theJourneyEditor.journey.title}
                                             onSlChange={setTitle}
                                    />
                                </SlTooltip>

                                {/* Change description */}
                                <SlTooltip hoist content={'Description'}>
                                    <SlTextarea row={2}
                                                size={'small'}
                                                id={'journey-description'}
                                                value={parse(theJourneyEditor.journey.description)}
                                                onSlChange={setDescription}
                                                placeholder={'Journey description'}
                                    />
                                </SlTooltip>


                                { // if there only one track, the track style is here.
                                    theJourneyEditor.journey.tracks.size === 1 && <TrackStyleSettings/>
                                }

                            </div>
                        </SlTabPanel>
                        {/**
                         * POIs Tab Panel
                         */}
                        <SlTabPanel name={POIS_PANEL}>
                            <MapPOIEditFilter/>
                            <MapPOIEditSettings/>
                            <MapPOIList/>
                        </SlTabPanel>

                        {/**
                         * Points Tab Panel
                         */}
                        <SlTabPanel name={POINTS_PANEL}>
                            <TrackPoints/>
                        </SlTabPanel>
                    </SlTabGroup>


                    <div id="journey-visibility" className={'editor-vertical-menu'}>
                        <div>
                            {editorStore.journey?.visible &&
                                <>
                                    {!autoRotate.journey &&
                                        <SlTooltip hoist
                                                   content={rotate.running && rotate.target.instanceOf(CURRENT_JOURNEY) ? 'Stop rotation' : 'Start rotation'}
                                                   placement="left">
                                            <FAButton onClick={forceRotate}
                                                      ref={manualRotate}
                                                      icon={faArrowRotateRight}
                                                      className={classNames({'fa-spin': rotate.running && rotate.target?.instanceOf(CURRENT_JOURNEY)})}/>
                                        </SlTooltip>
                                    }

                                    <SlTooltip hoist
                                               content={rotate.running && rotate.target?.instanceOf(CURRENT_JOURNEY) ? 'Stop rotation' : 'Focus on journey'}
                                               placement="left">
                                        <FAButton onClick={maybeRotate}
                                                  icon={rotate.running && autoRotate.journey && (rotate.target?.instanceOf(CURRENT_JOURNEY)) ? faArrowRotateRight : faCrosshairsSimple}
                                                  className={classNames({'fa-spin': rotate.running && autoRotate.journey && rotate.target?.instanceOf(CURRENT_JOURNEY)})}/>
                                    </SlTooltip>
                                </>
                            }

                            <SlTooltip hoist content={textVisibilityJourney} placement="left">
                                <ToggleStateIcon onChange={setJourneyVisibility}
                                                 initial={editorStore?.journey?.visible}/>
                            </SlTooltip>
                        </div>
                        {theJourneyEditor.journey.pois.size > 1 &&
                                <SlTooltip hoist content={textVisibilityPOIs} placement="left">
                                    <ToggleStateIcon
                                        onChange={setAllPOIsVisibility}
                                        initial={theJourneyEditor.journey.POIsVisible}
                                        icons={{
                                            shown: faLocationDot, hidden: faLocationDotSlash,
                                        }}/>
                                </SlTooltip>
                            }

                        {theJourneyEditor.journey.tracks.size === 1 && theJourneyEditor.journey.visible &&
                            <TrackFlagsSettings tooltip="left"/>}

                        <div>
                        <SlTooltip hoist content={'Export'} placement="left">
                                <SlIconButton onClick={exportJourney} library="fa" name={FA2SL.set(faDownload)}/>
                        </SlTooltip>
                        <RemoveJourney tooltip="left-start" name={REMOVE_JOURNEY_IN_EDIT}/>

                        </div>
                    </div>
                </div>
                <ConfirmExportJourneyDialog/>

            </div>}
    </>)
}