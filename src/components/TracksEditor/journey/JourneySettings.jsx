/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-01
 * Last modified: 2026-04-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIEditListActions } from '@Components/MainUI/MapPOI/MapPOIEditListActions'
import {
    WaCard,
    WaIcon, WaInput, WaProgressBar, WaTab, WaTabGroup, WaTabPanel, WaTextarea, WaTooltip,
}                                     from '@web.awesome.me/webawesome-pro/dist/react'
import * as PropTypes from 'prop-types'
import { useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                from 'valtio'
import { sprintf }                    from 'sprintf-js'
import classNames                     from 'classnames'
import parse                          from 'html-react-parser'
import { FAButton }                   from '@Components/FAButton'
import { LGSScrollbars }              from '@Components/MainUI/LGSScrollbars'
import { MapPOIEditFilterPopup }      from '@Components/MainUI/MapPOI/MapPOIEditFilterPopup'
import { MapPOIEditFilterButton }     from '@Components/MainUI/MapPOI/MapPOIEditFilterButton'
import { MapPOIList }                 from '@Components/MainUI/MapPOI/MapPOIList'
import { useConfirm }                 from '@Components/Modals/ConfirmUI'
import { ToggleStateIcon }            from '@Components/ToggleStateIcon'
import {
    CURRENT_JOURNEY,
    JOURNEY_EDITOR_DRAWER,
    ORIGIN_STORE,
    REFRESH_DRAWING,
    REMOVE_JOURNEY_IN_EDIT,
    SIMULATE_ALTITUDE,
    UPDATE_JOURNEY_SILENTLY,
} from '@Core/constants'
import { ElevationServer }            from '@Core/Elevation/ElevationServer'
import { Journey }                    from '@Core/Journey'
import { RemoveJourney }              from '@Editor/journey/RemoveJourney'
import { TrackData }                  from '@Editor/track/TrackData'
import { TrackPoints }                from '@Editor/track/TrackPoints'
import { TrackStyleSettings }         from '@Editor/track/TrackStyleSettings'
import { Utils }                      from '@Editor/Utils'
import {
    faArrowRotateRight, faCrosshairsSimple, faDownload, faLocationDot, faLocationDotSlash, faPaintbrushPencil,
    faRectangleList,
}                                     from '@fortawesome/pro-regular-svg-icons'
import {
    FEATURE_MULTILINE_STRING, FEATURE_POINT, TrackUtils,
}                                     from '@Utils/cesium/TrackUtils'
import { FA2SL }                      from '@Utils/FA2SL'
import { UIToast }                    from '@Utils/UIToast'
import { ElevationProfile }           from '../../MainUI/ElevationProfile'
import { JourneyData }                from './JourneyData'

const PANELS = {
    DATA: 'tab-data',
    EDIT: 'tab-edit',
    POINTS: 'tab-points',
    POIS: 'tab-pois',
}

const {DATA, EDIT, POINTS, POIS} = PANELS

/**
 * Main journey settings component
 */
export const JourneySettings = () => {
    // Proxies
    const $journeyEditor = lgs.stores.journeyEditor
    const $uiRotate = lgs.stores.ui.mainUI.rotate
    const $cameraSettings = lgs.settings.ui.camera.start.rotate
    const $drawers = lgs.stores.ui.drawers

    // Snapshots
    const {journey, isProcessing} = useSnapshot($journeyEditor)
    const {running, target} = useSnapshot($uiRotate)
    const {journey: autoRotateJourney} = useSnapshot($cameraSettings)
    const {open} = useSnapshot($drawers)

    const _title = useRef(null)
    const _description = useRef(null)
    const _manualRotate = useRef(null)
    const _tabGroup = useRef(null)
    const _elevationRequestId = useRef(0)

    // Local state-like ref for rotation toggle
    const _allowRotation = useRef(false)

    /**
     * Memoized list of available elevation servers
     */
    const serverList = useMemo(() => {
        const list = []
        if (journey?.hasElevation === false) {
            list.push(ElevationServer.FAKE_SERVERS.get(journey?.elevationServer === ElevationServer.NONE ? ElevationServer.NONE : ElevationServer.CLEAR))
        }
        else {
            list.push(
                ElevationServer.FAKE_SERVERS.get(ElevationServer.CLEAR),
                ElevationServer.FAKE_SERVERS.get(ElevationServer.FILE_CONTENT),
            )
        }
        return list.concat(Array.from(ElevationServer.SERVERS.values()))
    }, [journey?.hasElevation, journey?.elevationServer])

    /**
     * Coordinates preparation logic
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
     * Update Journey logic after elevation fetch
     */
    const updateJourneyWithElevation = async (coordinates, journeyData) => {
        const updated = Journey.deserialize({object: Journey.unproxify(journeyData)})
        let counter = 0
        updated.geoJson.features.forEach((feature, index, features) => {
            let len = feature.geometry.type === FEATURE_POINT ? 1 : feature.geometry.coordinates.flat().length
            const chunk = coordinates.slice(counter, counter + len)
            counter += len

            if (feature.geometry.type === FEATURE_POINT) {
                features[index].geometry.coordinates = chunk[0]
            }
            else if (feature.geometry.type === FEATURE_MULTILINE_STRING) {
                let subCounter = 0
                features[index].geometry.coordinates.forEach((segment, subIdx) => {
                    features[index].geometry.coordinates[subIdx] = chunk.slice(subCounter, subCounter + segment.length)
                    subCounter += segment.length
                })
            }
            else {
                features[index].geometry.coordinates = chunk
            }
        })

        updated.getTracksFromGeoJson(true)
        console.log()
        await updated.getPOIsFromGeoJson()
        await updated.extractMetrics()
        updated.addToContext()
        await updated.persistToDatabase()
        await Utils.updateJourney(SIMULATE_ALTITUDE)
        Utils.updateJourneyEditor(updated.slug, {})
        __.ui.profiler.draw()
    }

    /**
     * Elevation computation handler
     */
    const computeElevation = async (event) => {
        const newServer = event?.detail?.value ?? event?.target?.value
        const force = event?.detail?.force === true
        const previousServer = journey.elevationServer

        if (!newServer || (newServer === previousServer && !force)) {
            return
        }

        const requestId = ++_elevationRequestId.current
        $journeyEditor.journey.elevationServer = newServer
        $journeyEditor.isProcessing = newServer !== ElevationServer.NONE
        const server = new ElevationServer(newServer)

        try {
            const originData = JSON.parse(await lgs.db.lgs1920.get(journey.slug, ORIGIN_STORE))
            const {coordinates, origins} = prepareCoordinates(lgs.theJourney, originData)

            const results = await server.getElevation(coordinates, origins)
            if (requestId !== _elevationRequestId.current) {
                return
            }

            if (results.errors) {
                throw results.errors
            }

            await updateJourneyWithElevation(results.coordinates, lgs.theJourney)
            if (requestId !== _elevationRequestId.current) {
                return
            }
            $journeyEditor.journey.elevationServer = newServer

            UIToast.success({
                                caption: 'Elevation data modified',
                                text:    `Source: ${ElevationServer.getServer(newServer).label}`,
                            })
        }
        catch (error) {
            if (requestId === _elevationRequestId.current) {
                $journeyEditor.journey.elevationServer = previousServer
                UIToast.error({
                                  caption: 'Calculation failed',
                                  text:    'Changes aborted.',
                                  errors:  error.errors ?? error,
                              })
            }
        }
        finally {
            if (requestId === _elevationRequestId.current) {
                $journeyEditor.isProcessing = false
            }
        }
    }

    const setTitle = __.tools.debounce(async (e) => {
        const val = e.target.value
        if (!val) {
            return
        }
        $journeyEditor.journey.title = $journeyEditor.journey.singleTitle(val)
        if (lgs.theJourney.hasOneTrack()) {
            const [slug, track] = lgs.theJourney.tracks.entries().next().value
            track.title = $journeyEditor.journey.title
            $journeyEditor.journey.tracks.set(slug, track)
            track.addToEditor()
            __.ui.profiler.updateTitle()
        }
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneysList()
    }, 300)

    const setDescription = __.tools.debounce(async (e) => {
        const val = e.target.value
        if (!val) {
            return
        }
        $journeyEditor.journey.description = val
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
    }, 300)

    const setJourneyVisibility = async (v) => {
        if (running) {
            await __.ui.cameraManager.stopRotate()
        }
        $journeyEditor.journey.visible = v
        lgs.theJourney.updateVisibility(v)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    const setAllPOIsVisibility = async (v) => {
        $journeyEditor.journey.POIsVisible = v
        TrackUtils.updatePOIsVisibility(lgs.theJourney, v)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    const focusOnJourney = async () => {
        if (running && target.instanceOf(CURRENT_JOURNEY)) {
            return
        }
        await setJourneyVisibility(true)
        lgs.theJourney.focus({
                                 resetCamera: true,
                                 action: REFRESH_DRAWING,
                                 rotate: _allowRotation.current || autoRotateJourney,
                             })
    }

    const maybeRotate = async () => {
        if (running) {
            _allowRotation.current = false
            await __.ui.cameraManager.stopRotate()
            if (target.element === lgs.theJourney.element) {
                return
            }
        }
        _allowRotation.current = autoRotateJourney
        await focusOnJourney()
    }

    const forceRotate = async () => {
        _allowRotation.current = !_allowRotation.current
        await focusOnJourney()
    }

    const initTab = (e) => {
        const tabName = e.detail.name
        __.ui.drawerManager.tab = tabName
        $journeyEditor.activeTab = tabName
        $journeyEditor.showPOIsFilter = tabName === POIS && e.type === 'wa-tab-show'
    }

    const [ConfirmExportJourneyDialog, confirmExportJourney] = useConfirm(`Export <strong>${journey?.title}</strong> ?`, () => <>Not
        Yet. Sorry.</>)

    useEffect(() => {
        if (!$journeyEditor.activeTab) {
            $journeyEditor.activeTab = DATA
            __.ui.drawerManager.tab = DATA
        }
        lgs.stores.ui.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
        return () => lgs.stores.ui.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
    }, [])

    const shouldRender = journey && open === JOURNEY_EDITOR_DRAWER
    const textVisibilityJourney = sprintf('%s Journey', journey?.visible ? 'Hide' : 'Show')
    const textVisibilityPOIs = sprintf('%s POIs', journey?.POIsVisible ? 'Hide' : 'Show')

    return (
        <>
            {shouldRender && (
                <div id="journey-settings" key={lgs.theJourney.slug}>
                    <div className="settings-panel">
                        <WaTabGroup className="menu-panel" ref={_tabGroup} onTabShow={initTab} onTabHide={initTab}>
                            <WaTab slot="nav" panel={DATA} active={__.ui.drawerManager.tabActive(DATA)}>
                                <WaIcon name="rectangle-list" variant="regular"/> Data
                            </WaTab>
                            <WaTab slot="nav" panel={EDIT} active={__.ui.drawerManager.tabActive(EDIT)}>
                                <WaIcon name="paintbrush-pencil" variant="regular"/> Edit
                            </WaTab>
                            <WaTab slot="nav" panel={POIS} active={__.ui.drawerManager.tabActive(POIS)}>
                                <WaIcon name="location-dot" variant="regular"/> POIs
                            </WaTab>

                            <MapPOIEditFilterButton slot="nav"/>

                            {/* Data Panel */}
                            <WaTabPanel name={DATA}>
                                <LGSScrollbars>
                                    <WaCard className="lgs--track-data" appearance="filled">
                                        <ElevationProfile
                                            default={journey.elevationServer}
                                            label={'Elevation Source:'}
                                            onChange={computeElevation}
                                            servers={serverList}
                                        />
                                        {journey.tracks.size === 1 ? <TrackData/> : <JourneyData/>}
                                    </WaCard>
                                </LGSScrollbars>
                            </WaTabPanel>

                            {/* Edit Panel */}
                            <WaTabPanel name={EDIT}>
                                <div id="journey-text-description">
                                    <WaInput
                                        label={'Title'}
                                        id={'journey-title-in-settings'}
                                        ref={_title}
                                        value={journey.title}
                                        onChange={setTitle}
                                    />

                                    <WaTextarea
                                        label={'Description'}
                                        ref={_description}
                                        rows={3}
                                        size="small"
                                        value={parse(journey.description)}
                                        onChange={setDescription}
                                    />

                                    {journey.tracks.size === 1 && <TrackStyleSettings/>}
                                </div>
                            </WaTabPanel>

                            {/* POIs Panel */}
                            <WaTabPanel name={POIS}>
                                <div className="panel-wrapper">
                                    <MapPOIEditFilterPopup/>
                                    <MapPOIEditListActions/>
                                    <LGSScrollbars><MapPOIList/></LGSScrollbars>
                                </div>
                            </WaTabPanel>

                            {/* Points Panel */}
                            <WaTabPanel name={POINTS}>
                                <TrackPoints/>
                            </WaTabPanel>
                        </WaTabGroup>

                        <div className="editor-vertical-menu">
                            <div>
                                {journey.visible && (
                                    <>
                                        {!autoRotateJourney && (
                                            <WaTooltip hoist
                                                       content={running && target.instanceOf(CURRENT_JOURNEY) ? 'Stop rotation' : 'Start rotation'}
                                                       placement="left">
                                                <FAButton
                                                    onClick={forceRotate}
                                                    ref={_manualRotate}
                                                    icon={faArrowRotateRight}
                                                    className={classNames({'fa-spin': running && target.instanceOf(CURRENT_JOURNEY)})}
                                                />
                                            </WaTooltip>
                                        )}
                                        <WaTooltip hoist
                                                   content={running && target.instanceOf(CURRENT_JOURNEY) ? 'Stop' : 'Focus'}
                                                   placement="left">
                                            <FAButton
                                                onClick={maybeRotate}
                                                icon={running && autoRotateJourney && target.instanceOf(CURRENT_JOURNEY) ? faArrowRotateRight : faCrosshairsSimple}
                                                className={classNames({'fa-spin': running && autoRotateJourney && target.instanceOf(CURRENT_JOURNEY)})}
                                            />
                                        </WaTooltip>
                                    </>
                                )}
                                <WaTooltip hoist content={textVisibilityJourney} placement="left">
                                    <ToggleStateIcon onChange={setJourneyVisibility} initial={journey.visible}/>
                                </WaTooltip>
                            </div>
                            {journey.pois.size > 1 && (
                                <WaTooltip hoist content={textVisibilityPOIs} placement="left">
                                    <ToggleStateIcon
                                        onChange={setAllPOIsVisibility}
                                        initial={journey.POIsVisible}
                                        icons={{shown: 'location-dot', hidden: 'location-dot-slash'}}
                                    />
                                </WaTooltip>
                            )}
                            <div>
                                <WaTooltip hoist content="Export" placement="left">
                                    <FAButton onClick={confirmExportJourney} icon={faDownload}/>
                                </WaTooltip>
                                <RemoveJourney tooltip="left-start" name={REMOVE_JOURNEY_IN_EDIT}/>
                            </div>
                        </div>
                    </div>
                    <ConfirmExportJourneyDialog/>
                </div>
            )}
        </>
    )
}
