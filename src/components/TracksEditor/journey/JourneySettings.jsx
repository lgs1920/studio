/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    LGSScrollbars,
}                                     from '@Components/MainUI/LGSScrollbars'
import {
    MapPOIEditListActions,
}                                     from '@Components/MainUI/MapPOI/MapPOIEditListActions'
import {
    MapPOIList,
}                                     from '@Components/MainUI/MapPOI/MapPOIList'
import {
    useConfirm,
}                                     from '@Components/Modals/ConfirmUI'
import { LGSPopup }                   from '@Components/LGSPopup'
import {
    ToggleStateIcon,
}                                     from '@Components/ToggleStateIcon'
import {
    CURRENT_JOURNEY, EDIT_JOURNEY_ICON, JOURNEY_EDITOR_DRAWER, ORIGIN_STORE, REMOVE_JOURNEY_IN_EDIT,
    SIMULATE_ALTITUDE,
    UPDATE_JOURNEY_SILENTLY,
} from '@Core/constants'
import {
    ElevationServer,
}                                     from '@Core/Elevation/ElevationServer'
import { Journey }                    from '@Core/Journey'
import { Export }                     from '@Core/ui/Export'
import {
    RemoveJourney,
}                                     from '@Editor/journey/RemoveJourney'
import { JourneyGroupsInfo }          from '@Editor/groups/JourneyGroupsInfo'
import {
    TrackData,
}                                     from '@Editor/track/TrackData'
import {
    TrackPoints,
}                                     from '@Editor/track/TrackPoints'
import { TrackSettings }              from '@Editor/track/TrackSettings'
import {
    TrackStyleSettings,
}                                     from '@Editor/track/TrackStyleSettings'
import { Utils }                      from '@Editor/Utils'
import { TrackUtils }                 from '@Utils/cesium/TrackUtils'
import {
    applyElevationCoordinatesToFeature, flattenFeatureGeometryCoordinates, prepareJourneyElevationCoordinates,
}                                     from '@Utils/cesium/elevationCoordinateUtils'
import {
    exportJourneyToGeoJSON, exportJourneyToGPX, getExportableJourneyPOIs, getJourneyExportBaseName,
    JOURNEY_EXPORT_FORMAT_LABELS, JOURNEY_EXPORT_FORMATS, JOURNEY_EXPORT_MIME_TYPES,
    normalizeJourneyExportBaseName, normalizeJourneyExportFileName,
}                                     from '@Utils/JourneyGpxUtils'
import {
    exportJourneyToHTMLZip, exportJourneyToPDF,
}                                     from '@Utils/ExportAsReport'
import {
    UIToast,
}                                     from '@Utils/UIToast'
import { getGlobalHideOtherJourneys, refreshJourneyVisibility, setGlobalHideOtherJourneys } from '@Core/ui/JourneyVisibility'
import { decodeHTMLEntities }         from '@Utils/TextUtils'
import {
    WaButton, WaCard, WaDetails, WaIcon, WaInput, WaOption, WaSelect, WaSwitch, WaTab, WaTabGroup, WaTabPanel,
    WaTextarea, WaTooltip,
}                                     from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef, useState } from 'react'
import { sprintf }                    from 'sprintf-js'
import { useSnapshot }                from 'valtio'
import { useOptionalSnapshot }        from '@Utils/ValtioUtils'
import {
    ElevationProfile,
}                                     from '../../MainUI/ElevationProfile'
import { JourneyData }                from './JourneyData'

const PANELS = {
    DATA: 'tab-data',
    EDIT: 'tab-edit',
    POINTS: 'tab-points',
    POIS: 'tab-pois',
}

const {DATA, EDIT, POINTS, POIS} = PANELS
const EXPORT_DIALOG_FORMATS = {
    FILE: [
        {value: JOURNEY_EXPORT_FORMATS.GPX, label: 'gpx'},
        {value: JOURNEY_EXPORT_FORMATS.GEOJSON, label: 'geojson'},
    ],
    REPORT: [
        {value: JOURNEY_EXPORT_FORMATS.PDF, label: 'pdf'},
        {value: JOURNEY_EXPORT_FORMATS.HTML, label: 'html'},
    ],
}
const REPORT_EXPORT_STAGES = {
    SNAPSHOTS: 'snapshots',
    WRITING:   'writing',
}

const REPORT_EXPORT_STAGE_ICONS = {
    [REPORT_EXPORT_STAGES.SNAPSHOTS]: {
        name:      'camera',
        animation: 'fade',
    },
    [REPORT_EXPORT_STAGES.WRITING]: {
        name:      'pencil',
        animation: 'beat-fade',
    },
}

const journeyEditorStore = () => lgs.stores.journeyEditor

const setJourneyEditorElevationServer = (value) => {
    journeyEditorStore().journey.elevationServer = value
}

const setJourneyEditorProcessing = (value) => {
    journeyEditorStore().isProcessing = value
}

const setJourneyEditorActivity = (activity) => {
    const editor = journeyEditorStore()
    editor.journey.activity = activity
    editor.journey.activitySettings = Journey.activityProfile(activity)
}

const setJourneyEditorJourneyVisible = (value) => {
    journeyEditorStore().journey.visible = value
}

const setJourneyEditorPOIsVisible = (value) => {
    journeyEditorStore().journey.POIsVisible = value
}

const setHideOtherJourneys = async (event) => {
    const enabled = Boolean(event?.target?.checked)
    await setGlobalHideOtherJourneys(enabled, {
        currentJourney: journeyEditorStore().journey,
    })
}

const setJourneyEditorTabState = (tabName, eventType = 'wa-tab-show') => {
    const editor = journeyEditorStore()
    editor.activeTab = tabName
    editor.showPOIsFilter = tabName === POIS && eventType === 'wa-tab-show'
}

const initializeJourneyEditorTab = (tabName) => {
    const editor = journeyEditorStore()
    if (!editor.activeTab) {
        editor.activeTab = tabName
    }
}

const ReportExportAnimation = ({animation}) => {
    const stage = typeof animation === 'string' ? animation : animation?.stage
    const icon = REPORT_EXPORT_STAGE_ICONS[stage]
    if (!icon) {
        return null
    }

    return (
        <div className={`journey-report-export-animation is-${stage}`} aria-hidden="true">
            <WaIcon key={animation?.id ?? stage} name={icon.name} variant="light" animation={icon.animation}/>
        </div>
    )
}

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
    const {journey} = useSnapshot($journeyEditor)
    const {running, target} = useSnapshot($uiRotate)
    const {journey: autoRotateJourney} = useSnapshot($cameraSettings)
    const {open} = useSnapshot($drawers)
    const {hideOtherJourneys: globalHideOtherJourneys} = useOptionalSnapshot(lgs.settings.journey)
    const journeySlug = journey?.slug ?? null

    const _title = useRef(null)
    const _description = useRef(null)
    const _manualRotate = useRef(null)
    const _tabGroup = useRef(null)
    const _elevationRequestId = useRef(0)
    const _exportFormat = useRef(JOURNEY_EXPORT_FORMATS.GPX)
    const _exportFileName = useRef('')

    const [exportFormat, setExportFormatState] = useState(JOURNEY_EXPORT_FORMATS.GPX)
    const [exportFileName, setExportFileNameState] = useState('')
    const [exportChoiceOpen, setExportChoiceOpen] = useState(false)
    const [journeyLocationState, setJourneyLocationState] = useState({slug: null, value: ''})
    const [reportExportAnimation, setReportExportAnimation] = useState(null)

    // Local state-like ref for rotation toggle
    const _allowRotation = useRef(false)

    const serverList = (() => {
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
    })()

    const activityList = Journey.activityProfiles()

    /**
     * Coordinates preparation logic
     */
    const prepareCoordinates = (journeyData, originData) => prepareJourneyElevationCoordinates(journeyData.geoJson, originData)

    /**
     * Update Journey logic after elevation fetch
     */
    const updateJourneyWithElevation = async (coordinates, journeyData) => {
        const updated = Journey.deserialize({object: Journey.unproxify(journeyData)})
        let counter = 0
        updated.geoJson.features.forEach((feature, index, features) => {
            const len = flattenFeatureGeometryCoordinates(feature.geometry).length
            const chunk = coordinates.slice(counter, counter + len)
            counter += len

            applyElevationCoordinatesToFeature(features[index], chunk)
        })

        updated.getTracksFromGeoJson(true)
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
        const previousServer = journey.elevationServer

        if (!newServer || newServer === previousServer) {
            return
        }

        const requestId = ++_elevationRequestId.current
        setJourneyEditorElevationServer(newServer)
        setJourneyEditorProcessing(newServer !== ElevationServer.NONE)
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
            setJourneyEditorElevationServer(newServer)

            UIToast.success({
                                caption: 'Elevation data modified',
                                text:    `Source: ${ElevationServer.getServer(newServer).label}`,
                            })
        }
        catch (error) {
            if (requestId === _elevationRequestId.current) {
                setJourneyEditorElevationServer(previousServer)
                UIToast.error({
                                  caption: 'Calculation failed',
                                  text:    'Changes aborted.',
                                  errors:  error.errors ?? error,
                              })
            }
        }
        finally {
            if (requestId === _elevationRequestId.current) {
                setJourneyEditorProcessing(false)
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
        const val = decodeHTMLEntities(e.target.value)
        if (!val) {
            return
        }
        $journeyEditor.journey.description = val
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
    }, 300)

    const setActivity = async (event) => {
        const activity = event.target.value
        if (!activity || activity === $journeyEditor.journey.activity) {
            return
        }

        setJourneyEditorActivity(activity)
        const updated = await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        updated.addToContext()
        const track = updated.tracks.get($journeyEditor.track?.slug) ?? Array.from(updated.tracks.values())[0]
        track?.addToContext()
        track?.addToEditor()
        Utils.renderJourneySettings()
        __.ui.profiler.draw()
    }

    const setJourneyVisibility = async (v) => {
        if (running) {
            await __.ui.cameraManager.stopRotate()
        }
        setJourneyEditorJourneyVisible(v)
        lgs.theJourney.updateVisibility(v)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY, {focus: false})
        if (getGlobalHideOtherJourneys()) {
            await refreshJourneyVisibility({
                hideOtherJourneys: true,
                currentJourney:    lgs.theJourney,
            })
        }
        Utils.renderJourneySettings()
    }

    const setAllPOIsVisibility = async (v) => {
        setJourneyEditorPOIsVisible(v)
        TrackUtils.updatePOIsVisibility(lgs.theJourney, v)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY, {focus: false})
        Utils.renderJourneySettings()
    }

    const focusOnJourney = async () => {
        if (running) {
            await __.ui.cameraManager.stopRotate()
        }
        await setJourneyVisibility(true)
        lgs.theJourney.focus({
                                 resetCamera: true,
                                 rotate: _allowRotation.current || autoRotateJourney,
                             })
    }

    const maybeRotate = async () => {
        if (running) {
            _allowRotation.current = false
            await __.ui.cameraManager.stopRotate()
            if (target?.element === lgs.theJourney.element) {
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
        setJourneyEditorTabState(tabName, e.type)
    }

    const setExportFormatValue = (format) => {
        _exportFormat.current = format
        setExportFormatState(format)
    }

    const setExportFileNameValue = (fileName) => {
        _exportFileName.current = fileName
        setExportFileNameState(fileName)
    }

    const resetExportDialog = (currentJourney, format = JOURNEY_EXPORT_FORMATS.GPX) => {
        setExportFormatValue(format)
        setExportFileNameValue(getJourneyExportBaseName(currentJourney))
    }

    const handleExportFileNameChange = (event) => {
        event.stopPropagation()
        setExportFileNameValue(event.target.value)
    }

    const handleExportFormatChange = (event) => {
        event.stopPropagation()
        const format = event.target.value || JOURNEY_EXPORT_FORMATS.GPX
        setExportFormatValue(format)
        setExportFileNameValue(normalizeJourneyExportBaseName(_exportFileName.current, lgs.theJourney))
    }

    const keepExportFormatPopoverInDialog = (event) => {
        event.stopPropagation()
    }

    const ExportJourneyMessage = ({formats = EXPORT_DIALOG_FORMATS.FILE, kind = 'file'} = {}) => {
        const poiCount = getExportableJourneyPOIs(lgs.theJourney).length
        const formatLabel = JOURNEY_EXPORT_FORMAT_LABELS[exportFormat] ?? JOURNEY_EXPORT_FORMAT_LABELS.gpx
        const itemLabel = kind === 'report' ? 'report' : 'file'
        return (
            <div className="journey-export-dialog-content">
                <p>{`Export ${formatLabel} ${itemLabel} with ${journey?.tracks?.size ?? 0} track(s) and ${poiCount} associated POI(s).`}</p>
                <div className="journey-export-controls">
                    <WaInput appearance="filled"
                        aria-label="Export file name"
                        className="journey-export-file-name"
                        value={exportFileName}
                        size="s"
                        onInput={handleExportFileNameChange}
                    />
                    <WaSelect appearance="filled"
                        aria-label="Export format"
                        className="journey-export-format"
                        value={exportFormat}
                        size="s"
                        onChange={handleExportFormatChange}
                        onWaShow={keepExportFormatPopoverInDialog}
                        onWaAfterShow={keepExportFormatPopoverInDialog}
                        onWaHide={keepExportFormatPopoverInDialog}
                        onWaAfterHide={keepExportFormatPopoverInDialog}
                    >
                        {formats.map(format => (
                            <WaOption key={format.value} value={format.value}>{format.label}</WaOption>
                        ))}
                    </WaSelect>
                </div>
            </div>
        )
    }

    const ExportFileMessage = () => (
        <ExportJourneyMessage formats={EXPORT_DIALOG_FORMATS.FILE} kind="file"/>
    )

    const ExportReportMessage = () => (
        <ExportJourneyMessage formats={EXPORT_DIALOG_FORMATS.REPORT} kind="report"/>
    )

    const [ConfirmExportFileDialog, confirmExportFile] = useConfirm(
        `${'Export File'}&nbsp;<strong>${journey?.title}</strong> ?`,
        ExportFileMessage,
        {
            icon:            'route',
            text:            `Export ${JOURNEY_EXPORT_FORMAT_LABELS[exportFormat] ?? JOURNEY_EXPORT_FORMAT_LABELS.gpx}`,
            dialogClassName: 'journey-export-dialog',
        },
    )

    const [ConfirmExportReportDialog, confirmExportReport] = useConfirm(
        `${'Export Report'}&nbsp;<strong>${journey?.title}</strong> ?`,
        ExportReportMessage,
        {
            icon:            'file-lines',
            text:            `Export ${JOURNEY_EXPORT_FORMAT_LABELS[exportFormat] ?? JOURNEY_EXPORT_FORMAT_LABELS.pdf}`,
            dialogClassName: 'journey-export-dialog',
        },
    )

    const exportJourney = async (event) => {
        event?.stopPropagation()
        if (!lgs.theJourney) {
            return
        }
        setExportChoiceOpen(open => !open)
    }

    const notifyExportInProgress = () => {
        UIToast.notify({
                           caption: 'Export in progress',
                           text:    'It will take few seconds.',
                       }, 5000)
    }

    const waitForExportToastPaint = () => new Promise(resolve => {
        if (typeof requestAnimationFrame !== 'function') {
            setTimeout(resolve, 0)
            return
        }

        requestAnimationFrame(() => requestAnimationFrame(resolve))
    })

    const openExportFileDialog = async () => {
        const currentJourney = lgs.theJourney
        if (!currentJourney) {
            return
        }
        resetExportDialog(currentJourney)
        setExportChoiceOpen(false)

        const confirmed = await confirmExportFile()
        if (!confirmed) {
            return
        }

        try {
            notifyExportInProgress()
            await waitForExportToastPaint()
            const pois = getExportableJourneyPOIs(currentJourney)
            const format = _exportFormat.current
            const fileName = normalizeJourneyExportFileName(_exportFileName.current, format, currentJourney)
            const content = format === JOURNEY_EXPORT_FORMATS.GEOJSON
                            ? exportJourneyToGeoJSON(currentJourney, {pois})
                            : exportJourneyToGPX(currentJourney, {pois})
            await Export.toFile(content, fileName, JOURNEY_EXPORT_MIME_TYPES[format])

            UIToast.success({
                                caption: 'Export success',
                                text:    `${fileName}<br/>${pois.length} POI(s) exported.`,
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Export failed',
                              text:    'The journey export could not be generated.',
                              errors:  error,
                          })
        }
    }

    const openExportReportDialog = async () => {
        const currentJourney = lgs.theJourney
        if (!currentJourney) {
            return
        }
        resetExportDialog(currentJourney, JOURNEY_EXPORT_FORMATS.PDF)
        setExportChoiceOpen(false)

        const confirmed = await confirmExportReport()
        if (!confirmed) {
            return
        }

        const format = _exportFormat.current
        let reportExportActive = true
        const setCurrentReportExportStage = payload => {
            if (!reportExportActive) {
                return
            }

            const stage = typeof payload === 'string' ? payload : payload?.stage
            if (stage === REPORT_EXPORT_STAGES.SNAPSHOTS && reportExportAnimation?.stage === REPORT_EXPORT_STAGES.SNAPSHOTS) {
                return
            }

            const animation = {
                stage,
                id: stage === REPORT_EXPORT_STAGES.SNAPSHOTS ? REPORT_EXPORT_STAGES.SNAPSHOTS : `${stage}-${Date.now()}`,
            }

            setReportExportAnimation(animation)
        }

        try {
            notifyExportInProgress()
            await waitForExportToastPaint()
            const fileName = normalizeJourneyExportFileName(_exportFileName.current, format, currentJourney)
            const reportOptions = {
                fileName,
                onReportStage: setCurrentReportExportStage,
            }
            const result = format === JOURNEY_EXPORT_FORMATS.HTML
                           ? await exportJourneyToHTMLZip(currentJourney, reportOptions)
                           : await exportJourneyToPDF(currentJourney, reportOptions)

            UIToast.success({
                                caption: 'Export success',
                                text:    `${fileName}<br/>${result.poiCount} POI(s) exported.`,
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Export failed',
                              text:    'The report could not be generated.',
                              errors:  error,
                          })
        }
        finally {
            reportExportActive = false
            setReportExportAnimation(null)
        }
    }

    useEffect(() => {
        if (!journeyEditorStore().activeTab) {
            initializeJourneyEditorTab(DATA)
            __.ui.drawerManager.tab = DATA
        }
        lgs.stores.ui.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
        return () => lgs.stores.ui.mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_EDIT, false)
    }, [])

    useEffect(() => {
        let isMounted = true

        if (!journeySlug || open !== JOURNEY_EDITOR_DRAWER || !__.ui.geocoder?.getJourneyLocation) {
            return () => {
                isMounted = false
            }
        }

        const currentJourney = lgs.getJourneyBySlug(journeySlug) ?? lgs.theJourney

        __.ui.geocoder.getJourneyLocation(currentJourney)
            .then(location => {
                if (isMounted) {
                    setJourneyLocationState({slug: journeySlug, value: location})
                }
            })
            .catch(error => {
                console.error(error)
                if (isMounted) {
                    setJourneyLocationState({slug: journeySlug, value: ''})
                }
            })

        return () => {
            isMounted = false
        }
    }, [journeySlug, open])

    const shouldRender = journey && open === JOURNEY_EDITOR_DRAWER
    const textVisibilityJourney = sprintf('%s Journey', journey?.visible ? 'Hide' : 'Show')
    const textVisibilityPOIs = sprintf('%s POIs', journey?.POIsVisible ? 'Hide' : 'Show')
    const journeyLocation = journeyLocationState.slug === journeySlug ? journeyLocationState.value : ''

    return (
        <>
            {shouldRender && (
                <div id="journey-settings" key={lgs.theJourney.slug}>
                    <div className="settings-panel">
                        <div className="journey-global-visibility-row">
                            <WaSwitch
                                label-at-start
                                size="xs"
                                checked={globalHideOtherJourneys === true}
                                onChange={setHideOtherJourneys}
                            >
                                {'Hide other journeys'}
                            </WaSwitch>
                        </div>
                        <WaTabGroup className="menu-panel" ref={_tabGroup} onWaTabShow={initTab} onWaTabHide={initTab}>
                            <WaTab slot="nav" panel={DATA} active={__.ui.drawerManager.tabActive(DATA)}>
                                <WaIcon name="rectangle-list" variant="regular"/> Data
                            </WaTab>
                            <WaTab slot="nav" panel={EDIT} active={__.ui.drawerManager.tabActive(EDIT)}>
                                <WaIcon name={EDIT_JOURNEY_ICON} variant="regular"/> Edit
                            </WaTab>
                            <WaTab slot="nav" panel={POIS} active={__.ui.drawerManager.tabActive(POIS)}>
                                <WaIcon name="location-dot" variant="regular"/> POIs
                            </WaTab>

                            {/* Data Panel */}
                            <WaTabPanel name={DATA}>
                                <LGSScrollbars>
                                    <WaCard className="lgs--track-data" appearance="plain">
                                        <ElevationProfile
                                            default={journey.elevationServer}
                                            label={'Elevation Source:'}
                                            onChange={computeElevation}
                                            servers={serverList}
                                        />
                                        {journey.tracks.size === 1 ? <TrackData/> : <JourneyData/>}
                                        <TrackSettings/>
                                    </WaCard>
                                </LGSScrollbars>
                            </WaTabPanel>

                            {/* Edit Panel */}
                            <WaTabPanel name={EDIT}>
                                <LGSScrollbars>
                                    <WaCard className="lgs--track-data lgs--journey-edit-card" appearance="plain">
                                        <WaSelect appearance="filled"
                                            className="lgs--journey-activity-select"
                                            label="Activity"
                                            value={journey.activity ?? Journey.defaultActivity()}
                                            onChange={setActivity}
                                        >
                                            {activityList.map(activity => (
                                                <WaOption key={activity.id} value={activity.id}>
                                                    {activity.icon && <WaIcon slot="start" name={activity.icon} variant="regular"/>}
                                                    {activity.label}
                                                </WaOption>
                                            ))}
                                        </WaSelect>

                                        <div className="lgs--details-list lgs--journey-edit-details-list">
                                            <WaDetails
                                                small
                                                open
                                                className="lgs--details-hoverable lgs--journey-edit-details"
                                            >
                                                <span slot="summary">Journey details</span>
                                                <WaInput appearance="filled"
                                                    label={journey.tracks.size === 1 ? 'Title' : 'Journey Title'}
                                                    id={'journey-title-in-settings'}
                                                    ref={_title}
                                                    value={journey.title}
                                                    onChange={setTitle}
                                                />

                                                {journeyLocation && (
                                                    <div className="lgs--journey-location-in-settings">
                                                        <WaIcon name="location-dot" variant="regular"/>
                                                        <span>{journeyLocation}</span>
                                                    </div>
                                                )}

                                                <JourneyGroupsInfo journey={journey}/>

                                                <WaTextarea appearance="filled"
                                                    label={journey.tracks.size === 1 ? 'Description' : 'Journey Description'}
                                                    ref={_description}
                                                    rows={3}
                                                    value={decodeHTMLEntities(journey.description)}
                                                    onChange={setDescription}
                                                />
                                            </WaDetails>

                                            <WaDetails
                                                small
                                                open
                                                className="lgs--details-hoverable lgs--journey-edit-details"
                                            >
                                                <span slot="summary">Track style</span>
                                                {journey.tracks.size === 1 && <TrackStyleSettings showTitle={false}/>}
                                                <TrackSettings/>
                                            </WaDetails>
                                        </div>
                                    </WaCard>
                                </LGSScrollbars>
                            </WaTabPanel>

                            {/* POIs Panel */}
                            <WaTabPanel name={POIS}>
                                <div className="panel-wrapper">
                                    <MapPOIEditListActions/>
                                    <LGSScrollbars><MapPOIList/></LGSScrollbars>
                                </div>
                            </WaTabPanel>

                            {/* Points Panel */}
                            <WaTabPanel name={POINTS}>
                                <TrackPoints/>
                            </WaTabPanel>
                            <div className="lgs--tabs-right-menu " slot="nav">
                                {journey.visible && (
                                    <>
                                        {!autoRotateJourney && (<>
                                                <WaTooltip
                                                    placement="bottom"
                                                    for="rotation-in-settings"
                                                >
                                                    {running && target?.instanceOf?.(CURRENT_JOURNEY) ? 'Stop orbit' : 'Start orbit'}
                                                </WaTooltip>
                                                <WaButton
                                                    size="s"
                                                    onClick={forceRotate}
                                                    ref={_manualRotate}
                                                    id="rotation-in-settings"
                                                    variant="brand"
                                                    appearance="plain">
                                                    <WaIcon name="arrow-rotate-right"
                                                            variant="regular"
                                                            animation={running && target?.instanceOf?.(CURRENT_JOURNEY) ? 'spin' : ''}/>
                                                </WaButton>
                                            </>
                                        )}
                                        <WaTooltip
                                            for="auto-rotate-in-settings"
                                            placement="bottom">
                                            {running && target?.instanceOf?.(CURRENT_JOURNEY) ? 'Stop orbit' : 'Focus on Journey'}
                                        </WaTooltip>
                                        <WaButton id="auto-rotate-in-settings"
                                                  size="s"
                                                  onClick={maybeRotate}
                                                  id="auto-rotate-in-settings"
                                                  variant="brand"
                                                  appearance="plain">
                                            <WaIcon
                                                variant="regular"
                                                name={running && autoRotateJourney && target?.instanceOf?.(CURRENT_JOURNEY) ? 'arrow-rotate-right' : 'crosshairs-simple'}
                                                animation={running && autoRotateJourney && target?.instanceOf?.(CURRENT_JOURNEY) ? 'spin' : ''}
                                            />
                                        </WaButton>

                                    </>
                                )}
                                <WaTooltip placement="bottom"
                                           for="journey-visibility-in-settings">
                                    {textVisibilityJourney}
                                </WaTooltip>
                                <ToggleStateIcon id="journey-visibility-in-settings" onChange={setJourneyVisibility}
                                                 initial={journey.visible}/>

                                {journey.pois.size > 1 && (<>

                                        <WaTooltip for="pois-visibility-in-settings"
                                                   placement="left">{textVisibilityPOIs}</WaTooltip>
                                    <ToggleStateIcon
                                        onChange={setAllPOIsVisibility}
                                        initial={journey.POIsVisible}
                                        id="pois-visibility-in-settings"
                                        icons={{shown: 'location-dot', hidden: 'location-dot-slash'}}
                                    />
                                    </>
                            )}
                            <div>
                                <WaTooltip placement="bottom"
                                           for="export-journey-in-settings">{'Export Journey'}</WaTooltip>
                                <WaButton onClick={exportJourney}
                                          id="export-journey-in-settings"
                                          size="s"
                                          appearance="plain"
                                          variant="brand">
                                    <WaIcon name="download" variant="regular"/>
                                </WaButton>
                                <LGSPopup
                                    active={exportChoiceOpen}
                                    anchor="export-journey-in-settings"
                                    onRequestClose={() => setExportChoiceOpen(false)}
                                    placement="bottom-end"
                                    strategy="fixed"
                                    distance={lgs.gutter?.xs ?? 4}
                                    flip
                                    shift
                                >
                                    <div className="journey-export-choice-content">
                                        <WaTooltip placement="bottom"
                                                   for="export-journey-file-choice">{'Export as File'}</WaTooltip>
                                        <WaButton
                                            id="export-journey-file-choice"
                                            className="journey-export-choice-button"
                                            variant="brand"
                                            appearance="plain"
                                            aria-label="Export as File"
                                            onClick={openExportFileDialog}
                                        >
                                            <WaIcon slot="start" name="route" variant="regular"/>
                                            <span>Export as File</span>
                                        </WaButton>
                                        <WaTooltip placement="bottom"
                                                   for="export-journey-report-choice">{'Export a Report'}</WaTooltip>
                                        <WaButton
                                            id="export-journey-report-choice"
                                            className="journey-export-choice-button"
                                            variant="brand"
                                            appearance="plain"
                                            aria-label="Export a Report"
                                            onClick={openExportReportDialog}
                                        >
                                            <WaIcon slot="start" name="file-lines" variant="regular"/>
                                            <span>Export a Report</span>
                                        </WaButton>
                                    </div>
                                </LGSPopup>
                                <RemoveJourney tooltip="left-start" name={REMOVE_JOURNEY_IN_EDIT}/>
                            </div>
                        </div>
                        </WaTabGroup>
                    </div>
                </div>
            )}
            <ConfirmExportFileDialog/>
            <ConfirmExportReportDialog/>
            <ReportExportAnimation animation={reportExportAnimation}/>
        </>
    )
}
