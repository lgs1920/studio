/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-06
 * Last modified: 2025-07-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Fragment, useEffect, useMemo, useRef } from 'react'
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

/**
 * Available panel tabs for the journey settings interface
 * @type {Object}
 * @readonly
 */
const PANELS = {
    DATA: 'tab-data',
    EDIT: 'tab-edit',
    POINTS: 'tab-points',
    POIS: 'tab-pois',
}

const {DATA, EDIT, POINTS, POIS} = PANELS

/**
 * Data tab panel component for displaying journey data and elevation settings
 * @param {Object} props - Component properties
 * @param {Object} props.journey - Journey object containing tracks and settings
 * @param {boolean} props.isProcessing - Whether elevation processing is in progress
 * @param {Array} props.serverList - List of available elevation servers
 * @param {Function} props.onElevationChange - Callback for elevation server change
 * @returns {JSX.Element} Data tab panel component
 */
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

/**
 * Edit tab panel component for journey title and description editing
 * @param {Object} props - Component properties
 * @param {Object} props.journey - Journey object with title and description
 * @param {Function} props.onTitleChange - Callback for title changes
 * @param {Function} props.onDescriptionChange - Callback for description changes
 * @returns {JSX.Element} Edit tab panel component
 */
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

/**
 * POIs tab panel component for managing Points of Interest
 * @returns {JSX.Element} POIs tab panel component
 */
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

/**
 * Points tab panel component for managing track points
 * @returns {JSX.Element} Points tab panel component
 */
const PointsTabPanel = () => (
    <SlTabPanel name={POINTS}>
        <TrackPoints/>
    </SlTabPanel>
)

/**
 * Main journey settings component providing comprehensive journey editing interface
 * Features include:
 * - Journey data management and elevation processing
 * - Title and description editing
 * - POI (Points of Interest) management
 * - Track points editing
 * - Journey visibility controls
 * - Camera rotation and focus controls
 * - Journey export functionality
 *
 * @component
 * @returns {JSX.Element} Journey settings interface
 */
export const JourneySettings = () => {
    const journeyEditorStore = lgs.stores.journeyEditor
    const {journey, isProcessing, activeTab} = useSnapshot(journeyEditorStore)
    const {running, target} = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const {journey: autoRotateJourney} = useSnapshot(lgs.settings.ui.camera.start.rotate)
    const {open} = useSnapshot(lgs.stores.ui.drawers)

    /** @type {React.RefObject} Reference to tab group component */
    const _tabGroup = useRef(null)
    /** @type {React.RefObject} Reference to title input component */
    const _title = useRef(null)
    /** @type {React.RefObject} Reference to description textarea component */
    const _description = useRef(null)
    /** @type {React.RefObject} Reference to manual rotate button */
    const _manualRotate = useRef(null)

    let allowRotation = false
    const previousElevationServer = journeyEditorStore.journey.elevationServer

    /**
     * Memoized list of available elevation servers based on journey state
     * @returns {Array} List of elevation server objects
     */
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

    /**
     * Handles errors during elevation processing
     * @param {Error|Object} error - The error object or message
     * @param {string} message - User-friendly error message
     */
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

    /**
     * Prepares coordinate data for elevation processing
     * @param {Object} journeyData - Journey GeoJSON data
     * @param {Object} originData - Original coordinate data
     * @returns {Object} Object containing prepared coordinates and origins arrays
     */
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

    /**
     * Updates journey with new elevation data
     * @param {Array} coordinates - Array of coordinates with elevation data
     * @param {Object} journeyData - Journey data to update
     * @async
     */
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

    /**
     * Computes elevation data for journey using selected elevation server
     * @param {Event} event - Change event from elevation server selector
     * @async
     */
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

    /**
     * Sets journey title with debouncing to prevent excessive updates
     * @type {Function}
     */
    const setTitle = __.tools.debounce(async event => {
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

    /**
     * Sets journey description with debouncing to prevent excessive updates
     * @type {Function}
     */
    const setDescription = __.tools.debounce(async event => {
        const description = event.target.value
        if (!description) {
            _description.current.value = journeyEditorStore.journey.description
            return
        }
        journeyEditorStore.journey.description = description
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
    }, 300)

    /**
     * Sets journey visibility and updates UI accordingly
     * @param {boolean} visibility - Whether journey should be visible
     * @async
     */
    const setJourneyVisibility = async visibility => {
        if (running) {
            await __.ui.cameraManager.stopRotate()
        }
        journeyEditorStore.journey.visible = visibility
        lgs.theJourney.updateVisibility(visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    /**
     * Sets visibility for all POIs in the journey
     * @param {boolean} visibility - Whether POIs should be visible
     * @async
     */
    const setAllPOIsVisibility = async visibility => {
        journeyEditorStore.journey.POIsVisible = visibility
        TrackUtils.updatePOIsVisibility(lgs.theJourney, visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    /**
     * Stops camera rotation if currently running
     * @async
     */
    const stopRotate = async () => {
        if (running) {
            await __.ui.cameraManager.stopRotate()
        }
    }

    /**
     * Forces camera rotation toggle and focuses on journey
     * @async
     */
    const forceRotate = async () => {
        allowRotation = !allowRotation
        await focusOnJourney()
    }

    /**
     * Conditionally rotates camera based on settings and current state
     * @async
     */
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

    /**
     * Focuses camera on the current journey with optional rotation
     * @async
     */
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

    /**
     * Placeholder message component for export functionality
     * @returns {JSX.Element} Message component
     */
    const Message = () => <>{`'Not Yet. Sorry.'`}</>

    /** Confirmation dialog hook for journey export */
    const [ConfirmExportJourneyDialog, confirmExportJourney] = useConfirm(`Export <strong>${journey.title}</strong> ?`, Message)

    /**
     * Handles journey export functionality (currently placeholder)
     * @async
     */
    const exportJourney = async () => {
        const confirmed = await confirmExportJourney()
        if (confirmed) {
            // TODO: Implement export functionality
        }
    }

    /**
     * Initializes tab state when tab is changed
     * @param {Event} event - Tab change event
     */
    const initTab = event => {
        __.ui.drawerManager.tab = event.detail.name
        journeyEditorStore.activeTab = event.detail.name
        journeyEditorStore.showPOIsFilter = event.detail.name === POIS && event.type === 'sl-tab-show'
    }

    /**
     * Checks if a specific tab is currently active
     * @param {string} tab - Tab identifier
     * @returns {boolean} Whether the tab is active
     */
    const isTabActive = tab => __.ui.drawerManager.tabActive(tab)

    // Dynamic text for visibility toggle buttons
    const textVisibilityJourney = sprintf('%s Journey', journey.visible ? 'Hide' : 'Show')
    const textVisibilityPOIs = sprintf('%s POIs', journey.allPOIs ? 'Hide' : 'Show')

    // Component should only render when journey exists and drawer is open
    const shouldRender = journey && open === JOURNEY_EDITOR_DRAWER

    /**
     * Component initialization and cleanup effect
     */
    useEffect(() => {
        if (!journeyEditorStore.activeTab) {
            journeyEditorStore.activeTab = DATA
            __.ui.drawerManager.tab = DATA
        }
        lgs.stores.ui.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
        return () => lgs.stores.ui.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
    }, [])

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