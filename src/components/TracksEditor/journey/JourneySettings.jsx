/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-02
 * Last modified: 2025-07-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import React, { Fragment, useEffect, useMemo, useRef } from 'react'
import {
    debounce,
}                                                      from 'lodash'
import {
    useSnapshot,
}                                                      from 'valtio'
import {
    sprintf,
}                                                      from 'sprintf-js'
import classNames                                      from 'classnames'
import parse                                           from 'html-react-parser'
import {
    FAButton,
}                                                      from '@Components/FAButton'
import {
    LGSScrollbars,
}                                                      from '@Components/MainUI/LGSScrollbars'
import {
    MapPOIEditFilter,
}                                                      from '@Components/MainUI/MapPOI/MapPOIEditFilter'
import {
    MapPOIEditSettings,
}                                                      from '@Components/MainUI/MapPOI/MapPOIEditSettings'
import {
    MapPOIEditToggleFilter,
}                                                      from '@Components/MainUI/MapPOI/MapPOIEditToggleFilter'
import {
    MapPOIList,
}                                                      from '@Components/MainUI/MapPOI/MapPOIList'
import {
    useConfirm,
}                                                      from '@Components/Modals/ConfirmUI'
import {
    ToggleStateIcon,
}                                                      from '@Components/ToggleStateIcon'
import {
    CURRENT_JOURNEY,
    JOURNEY_EDITOR_DRAWER,
    ORIGIN_STORE,
    REFRESH_DRAWING,
    REMOVE_JOURNEY_IN_EDIT,
    SIMULATE_ALTITUDE,
    UPDATE_JOURNEY_SILENTLY,
} from '@Core/constants'
import {
    ElevationServer,
}                                                      from '@Core/Elevation/ElevationServer'
import {
    Journey,
}                                                      from '@Core/Journey'
import {
    RemoveJourney,
}                                                      from '@Editor/journey/RemoveJourney'
import {
    TrackData,
}                                                      from '@Editor/track/TrackData'
import {
    TrackFlagsSettings,
}                                                      from '@Editor/track/TrackFlagsSettings'
import {
    TrackPoints,
}                                                      from '@Editor/track/TrackPoints'
import {
    TrackStyleSettings,
}                                                      from '@Editor/track/TrackStyleSettings'
import {
    Utils,
}                                                      from '@Editor/Utils'
import {
    faArrowRotateRight, faCrosshairsSimple, faDownload, faLocationDot, faLocationDotSlash, faPaintbrushPencil,
    faRectangleList,
}                                                      from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon, SlIconButton, SlInput, SlProgressBar, SlTab, SlTabGroup, SlTabPanel, SlTooltip, SlTextarea,
}                                                      from '@shoelace-style/shoelace/dist/react'
import {
    FEATURE_MULTILINE_STRING, FEATURE_POINT, TrackUtils,
}                                                      from '@Utils/cesium/TrackUtils'
import {
    FA2SL,
}                                                      from '@Utils/FA2SL'
import {
    UIToast,
}                                                      from '@Utils/UIToast'
import {
    SelectElevationSource,
}                                                      from '../../MainUI/SelectElevationSource'
import {
    JourneyData,
}                                                      from './JourneyData'

const PANELS = {
    DATA: 'tab-data',
    EDIT: 'tab-edit',
    POINTS: 'tab-points',
    POIS: 'tab-pois',
}

const {DATA, EDIT, POINTS, POIS} = PANELS

const DataTabPanel = ({journey, isProcessing, serverList, onElevationChange}) => (
    <SlTabPanel name={DATA}>
        <div className="select-elevation-source">
            <SelectElevationSource default={journey.elevationServer} label="Elevation:" onChange={onElevationChange}
                                   servers={serverList}/>
            {isProcessing && <SlProgressBar indeterminate/>}
        </div>
        {journey.tracks.size === 1 ? <TrackData/> : <JourneyData/>}
    </SlTabPanel>
)

const EditTabPanel = ({journey, onTitleChange, onDescriptionChange}) => (
    <SlTabPanel name={EDIT}>
        <div id="journey-text-description">
            <SlTooltip content="Title">
                <SlInput id="journey-title" aria-label="Journey Title" value={journey.title}
                         onSlChange={onTitleChange}/>
            </SlTooltip>
            <SlTooltip hoist content="Description">
                <SlTextarea
                    row={2}
                    size="small"
                    id="journey-description"
                    aria-label="Journey Description"
                    value={parse(journey.description)}
                    onSlChange={onDescriptionChange}
                    placeholder="Journey description"
                />
            </SlTooltip>
            {journey.tracks.size === 1 && <TrackStyleSettings/>}
        </div>
    </SlTabPanel>
)

const PoisTabPanel = () => (
    <SlTabPanel name={POIS}>
        <div className="panel-wrapper">
            <MapPOIEditFilter/>
            <MapPOIEditSettings/>
            <LGSScrollbars>
                <MapPOIList/>
            </LGSScrollbars>
        </div>
    </SlTabPanel>
)

const PointsTabPanel = () => (
    <SlTabPanel name={POINTS}>
        <TrackPoints/>
    </SlTabPanel>
)

export const JourneySettings = () => {
    const journeyEditorStore = lgs.stores.journeyEditor
    const {journey, isProcessing, activeTab} = useSnapshot(journeyEditorStore)
    const {running, target} = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const {journey: autoRotateJourney} = useSnapshot(lgs.settings.ui.camera.start.rotate)
    const {open} = useSnapshot(lgs.stores.ui.drawers)
    const _tabGroup = useRef(null)
    const _title = useRef(null)
    const _description = useRef(null)
    const _manualRotate = useRef(null)
    let allowRotation = false
    const previousElevationServer = journeyEditorStore.journey.elevationServer

    const serverList = useMemo(() => {
        const list = []
        const {hasElevation, elevationServer} = journey
        if (!hasElevation) {
            list.push(ElevationServer.FAKE_SERVERS.get(elevationServer === ElevationServer.NONE ? ElevationServer.NONE : ElevationServer.CLEAR))
        }
        else {
            list.push(
                ElevationServer.FAKE_SERVERS.get(ElevationServer.CLEAR),
                ElevationServer.FAKE_SERVERS.get(ElevationServer.FILE_CONTENT),
            )
        }
        return list.concat(Array.from(ElevationServer.SERVERS.values()))
    }, [journey.hasElevation, journey.elevationServer])

    const handleError = (error, message) => {
        journeyEditorStore.isProcessing = false
        journeyEditorStore.journey.elevationServer = previousElevationServer
        console.error(error)
        UIToast.error({
                          caption: message,
                          text:    'Changes aborted! Check logs to see error details.',
                          errors:  error.errors ?? error,
                      })
    }

    const prepareCoordinates = (journeyData, originData) => {
        const coordinates = []
        const origins = []
        journeyData.geoJson.features.forEach((feature, index) => {
            let coords = feature.geometry.coordinates
            let orig = originData.features[index].geometry.coordinates
            if (feature.geometry.type === FEATURE_POINT) {
                coords = [coords]
                orig = [orig]
            }
            else if (feature.geometry.type === FEATURE_MULTILINE_STRING) {
                coords = coords.flat()
                orig = orig.flat()
            }
            coordinates.push(...coords.map(([lon, lat]) => [lon, lat]))
            origins.push(...orig)
        })
        return {coordinates, origins}
    }

    const updateJourneyWithElevation = async (coordinates, journeyData) => {
        const updatedJourney = Journey.deserialize({object: Journey.unproxify(journeyData)})
        let counter = 0
        updatedJourney.geoJson.features.forEach((feature, index, features) => {
            let length = feature.geometry.coordinates.flat().length
            if (feature.geometry.type === FEATURE_POINT) {
                length = 1
            }
            const chunk = coordinates.slice(counter, counter + length)
            counter += length
            if (feature.geometry.type === FEATURE_POINT) {
                features[index].geometry.coordinates = chunk[0]
            }
            else if (feature.geometry.type === FEATURE_MULTILINE_STRING) {
                const tmp = features[index].geometry.coordinates
                let subCounter = 0
                tmp.forEach((segment, subIndex) => {
                    features[index].geometry.coordinates[subIndex] = chunk.slice(subCounter, subCounter + segment.length)
                    subCounter += segment.length
                })
            }
            else {
                features[index].geometry.coordinates = chunk
            }
        })
        updatedJourney.getTracksFromGeoJson(true)
        await updatedJourney.getPOIsFromGeoJson()
        await updatedJourney.extractMetrics()
        updatedJourney.addToContext()
        await updatedJourney.persistToDatabase()
        await Utils.updateJourney(SIMULATE_ALTITUDE)
        Utils.updateJourneyEditor(updatedJourney.slug, {})
        __.ui.profiler.draw()
    }

    const computeElevation = async event => {
        const newServer = event.target.value
        journeyEditorStore.journey.elevationServer = newServer
        journeyEditorStore.isProcessing = newServer !== ElevationServer.NONE
        const server = new ElevationServer(newServer)
        const originData = JSON.parse(await lgs.db.lgs1920.get(journeyEditorStore.journey.slug, ORIGIN_STORE))
        const {coordinates, origins} = prepareCoordinates(lgs.theJourney, originData)
        try {
            const results = await server.getElevation(coordinates, origins)
            journeyEditorStore.isProcessing = false
            if (results.errors) {
                handleError(results.errors, 'An error occurred when calculating elevations')
                return
            }
            UIToast.success({
                                caption: 'Elevation data have been modified',
                                text:    `Source: ${ElevationServer.getServer(newServer).label}`,
                            })
            await updateJourneyWithElevation(results.coordinates, lgs.theJourney)
        }
        catch (error) {
            handleError(error, 'An error occurred when calculating elevations')
        }
    }

    const setTitle = debounce(async event => {
        const title = event.target.value
        if (!title) {
            _title.current.value = journeyEditorStore.journey.title
            return
        }
        journeyEditorStore.journey.title = journeyEditorStore.journey.singleTitle(title)
        if (lgs.theJourney.hasOneTrack()) {
            const [slug, track] = lgs.theJourney.tracks.entries().next().value
            track.title = journeyEditorStore.journey.title
            journeyEditorStore.journey.tracks.set(slug, track)
            track.addToEditor()
            __.ui.profiler.updateTitle()
        }
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneysList()
    }, 300)

    const setDescription = debounce(async event => {
        const description = event.target.value
        if (!description) {
            _description.current.value = journeyEditorStore.journey.description
            return
        }
        journeyEditorStore.journey.description = description
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
    }, 300)

    const setJourneyVisibility = async visibility => {
        if (running) {
            await __.ui.cameraManager.stopRotate()
        }
        journeyEditorStore.journey.visible = visibility
        lgs.theJourney.updateVisibility(visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    const setAllPOIsVisibility = async visibility => {
        journeyEditorStore.journey.POIsVisible = visibility
        TrackUtils.updatePOIsVisibility(lgs.theJourney, visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    const stopRotate = async () => {
        if (running) {
            await __.ui.cameraManager.stopRotate()
        }
    }

    const forceRotate = async () => {
        allowRotation = !allowRotation
        await focusOnJourney()
    }

    const maybeRotate = async () => {
        if (running) {
            allowRotation = false
            await stopRotate()
            if (target.element && target.element === lgs.theJourney.element) {
                return
            }
        }
        allowRotation = autoRotateJourney
        await focusOnJourney()
    }

    const focusOnJourney = async () => {
        if (running && target.instanceOf(CURRENT_JOURNEY)) {
            return
        }
        await setJourneyVisibility(true)
        lgs.theJourney.focus({
                                 resetCamera: true,
                                 action: REFRESH_DRAWING,
                                 rotate: allowRotation || autoRotateJourney,
                             })
    }

    const Message = () => <>{`'Not Yet. Sorry.'`}</>
    const [ConfirmExportJourneyDialog, confirmExportJourney] = useConfirm(`Export <strong>${journey.title}</strong> ?`, Message)

    const exportJourney = async () => {
        const confirmed = await confirmExportJourney()
        if (confirmed) {
            // TODO
        }
    }

    const initTab = event => {
        __.ui.drawerManager.tab = event.detail.name
        journeyEditorStore.activeTab = event.detail.name
        journeyEditorStore.showPOIsFilter = event.detail.name === POIS && event.type === 'sl-tab-show'
    }

    const isTabActive = tab => __.ui.drawerManager.tabActive(tab)

    const textVisibilityJourney = sprintf('%s Journey', journey.visible ? 'Hide' : 'Show')
    const textVisibilityPOIs = sprintf('%s POIs', journey.allPOIs ? 'Hide' : 'Show')

    useEffect(() => {
        lgs.stores.ui.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
        return () => lgs.stores.ui.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
    }, [])

    const shouldRender = journey && open === JOURNEY_EDITOR_DRAWER

    return (
        <Fragment>
            {shouldRender && (
                <div id="journey-settings" key={lgs.stores.main.components.journeyEditor.keys.journey.settings}>
                    <div className="settings-panel" id="editor-journey-settings-panel">
                        <SlTabGroup className="menu-panel" ref={_tabGroup} onSlTabShow={initTab} onSlTabHide={initTab}>
                            <SlTab slot="nav" panel={DATA} active={isTabActive(DATA)}>
                                <SlIcon library="fa" name={FA2SL.set(faRectangleList)}/> Data
                            </SlTab>
                            <SlTab slot="nav" panel={EDIT} active={isTabActive(EDIT)}>
                                <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/> Edit
                            </SlTab>
                            <SlTab slot="nav" panel={POIS} active={isTabActive(POIS)}>
                                <SlIcon library="fa" name={FA2SL.set(faLocationDot)}/> POIs
                            </SlTab>
                            <MapPOIEditToggleFilter slot="nav"/>
                            <DataTabPanel journey={journey} isProcessing={isProcessing} serverList={serverList}
                                          onElevationChange={computeElevation}/>
                            <EditTabPanel journey={journey} onTitleChange={setTitle}
                                          onDescriptionChange={setDescription}/>
                            <PoisTabPanel/>
                            <PointsTabPanel/>
                        </SlTabGroup>
                        <div id="journey-visibility" className="editor-vertical-menu">
                            <div>
                                {journey.visible && (
                                    <>
                                        {!autoRotateJourney && (
                                            <SlTooltip hoist
                                                       content={running && target.instanceOf(CURRENT_JOURNEY) ? 'Stop rotation' : 'Start rotation'}
                                                       placement="left">
                                                <FAButton
                                                    onClick={forceRotate}
                                                    ref={_manualRotate}
                                                    icon={faArrowRotateRight}
                                                    className={classNames({'fa-spin': running && target.instanceOf(CURRENT_JOURNEY)})}
                                                />
                                            </SlTooltip>
                                        )}
                                        <SlTooltip hoist
                                                   content={running && target.instanceOf(CURRENT_JOURNEY) ? 'Stop rotation' : 'Focus on journey'}
                                                   placement="left">
                                            <FAButton
                                                onClick={maybeRotate}
                                                icon={running && autoRotateJourney && target.instanceOf(CURRENT_JOURNEY) ? faArrowRotateRight : faCrosshairsSimple}
                                                className={classNames({'fa-spin': running && autoRotateJourney && target.instanceOf(CURRENT_JOURNEY)})}
                                            />
                                        </SlTooltip>
                                    </>
                                )}
                                <SlTooltip hoist content={textVisibilityJourney} placement="left">
                                    <ToggleStateIcon onChange={setJourneyVisibility} initial={journey.visible}/>
                                </SlTooltip>
                            </div>
                            {journey.pois.size > 1 && (
                                <SlTooltip hoist content={textVisibilityPOIs} placement="left">
                                    <ToggleStateIcon
                                        onChange={setAllPOIsVisibility}
                                        initial={journey.POIsVisible}
                                        icons={{shown: faLocationDot, hidden: faLocationDotSlash}}
                                    />
                                </SlTooltip>
                            )}
                            {journey.tracks.size === 1 && journey.visible && <TrackFlagsSettings tooltip="left"/>}
                            <div>
                                <SlTooltip hoist content="Export" placement="left">
                                    <SlIconButton onClick={exportJourney} library="fa" name={FA2SL.set(faDownload)}/>
                                </SlTooltip>
                                <RemoveJourney tooltip="left-start" name={REMOVE_JOURNEY_IN_EDIT}/>
                            </div>
                        </div>
                    </div>
                    <ConfirmExportJourneyDialog/>
                </div>
            )}
        </Fragment>
    )
}

