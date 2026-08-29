/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MainUI.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
import { Compass }          from '@Components/MainUI/compass/Compass'
import { CameraAdjustmentOverlay } from '@Components/MainUI/CameraAdjustmentOverlay'
import { JourneyReplayCameraAngleGuide } from '@Components/JourneyReplay/JourneyReplayCameraAngleGuide'
import { FullScreenButton } from '@Components/FullScreenButton/FullScreenButton'
import { ContextMenuRenderer } from '@Components/MainUI/context-menu/ContextMenuRenderer'
import { MapPointContextMenuTrigger } from '@Components/MainUI/context-menu/MapPointContextMenuTrigger'

import { GeocodingButton }   from '@Components/MainUI/geocoding/GeocodingButton'
import { GeocodingWidget } from '@Components/MainUI/geocoding/GeocodingWidget'
import { MapPOIMonitor }     from '@Components/MainUI/MapPOI/MapPOIMonitor'
import { PanoramaWidget } from '@Components/MainUI/PanoramaWidget'
import { OrbitWidget }       from '@Components/MainUI/OrbitWidget'
import { OrbitButton }       from '@Components/MainUI/OrbitButton'
import { EditorPanelButton } from '@Editor/EditorPanelButton'
import { VideoButton }       from '@Components/MainUI/video/VideoButton'
import { VideoDownloadAndShareDialog } from '@Components/MainUI/video/VideoDownloadAndShareDialog'
import { ReplayRecordingMonitorWidget } from '@Components/MainUI/video/ReplayRecordingMonitorWidget'
import { TextButton }        from '@Components/Text/TextButton'
import { TracksEditor }                         from '@Components/TracksEditor/TracksEditor'
import { JourneyGroupsDrawer }                  from '@Editor/groups/JourneyGroupsDrawer'
import { JourneyReplayButton }         from '@Components/JourneyReplay/JourneyReplayButton'
import { JourneyReplayDrawer }         from '@Components/JourneyReplay/JourneyReplayDrawer'
import {
    BOTTOM, END, EVENTS, MENU_BOTTOM_END, MENU_BOTTOM_START, MENU_END_END, MENU_END_START, MENU_START_END,
    MENU_START_START, SCENE_MODE_2D, SECOND, START, TOP,
}                            from '@Core/constants'
import { memo, useCallback, useEffect, useRef } from 'react'
import { sprintf }        from 'sprintf-js'
import { subscribe, useSnapshot }               from 'valtio'
import { JourneyLoaderUI }                      from '../FileLoader/JourneyLoaderUI'
import { CodeDependenciesDrawer }               from '../InformationPanel/CodeDependenciesDrawer'
import { Panel as InformationPanel }            from '../InformationPanel/Panel'
import { PanelButton as InformationButton } from '../InformationPanel/PanelButton'
import { Panel as LayersPanel }                 from '../Settings/layers/Panel'
import { PanelButton as LayersButton }          from '../Settings/layers/PanelButton'
import { Panel as SettingsPanel }               from '../Settings/Panel'
import { PanelButton as SettingsButton }        from '../Settings/PanelButton'

import { CallForActions }               from './CallForActions'
import { CameraTarget }                 from './CameraTarget'
import { CreditsBar }                   from './credits/CreditsBar'
import { Panel as MapPOIEditPanel }     from './MapPOI/Panel'
import { PanelButton as POIEditButton } from './MapPOI/PanelButton'
import { SceneModeSelector }            from './SceneModeSelector'
import { SupportUI }                    from './SupportUI'
import { SupportUIButton }   from './SupportUIButton'
import { WidgetManagementDrawer } from './widgets/management/WidgetManagementDrawer'
import { WidgetEditorPanel } from './widgets/editor/WidgetEditorPanel'

import './style.css'

const PRIMARY_ENTRANCE = 'lgs-slide-in-from-left'
const SECONDARY_ENTRANCE = 'lgs-slide-in-from-right'

export const MainUI = memo(() => {
    const formerDevice = useRef(__.device.isMobile)
    const {readyForTheShow, theJourney} = useSnapshot(lgs.stores.main)
    const geocoderDialog = useSnapshot(lgs.stores.main.components.geocoder.dialog)
    const mainUI = useSnapshot(lgs.stores.ui.mainUI)
    const {drawers, toolBar} = useSnapshot(lgs.settings.ui.menu)
    const {video} = useSnapshot(lgs.stores.ui)
    const replay = useSnapshot(lgs.stores.replay)
    const windowResized = useCallback(__.tools.debounce(() => {
        if (formerDevice.current !== __.device.isMobile) {
            __.ui.menuManager.reset()
            arrangeDrawers()
            formerDevice.current = __.device.isMobile
        }
    }, 0.3 * SECOND), [])

    const closeDrawer = useCallback(() => {
        __.ui.drawerManager.close()
    }, [])

    /**
     * Starts the synchronized Replay video entry point.
     *
     * @returns {void} Nothing.
     */
    const startReplayVideo = useCallback(() => {
        __.ui.replayVideoSync?.arm?.({
            autoStopRecording: true,
            resetToStart:      true,
        })
        lgs.stores.ui.video.timelinePreviewActive = true
        lgs.stores.ui.video.editing = true
    }, [])

    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Escape') {
            closeDrawer()
        }
    }, [closeDrawer])

    const arrangeDrawers = useCallback(() => {
        const placement = sprintf('%s-%s',
                                  __.device.isMobile ? (drawers.fromBottom ? BOTTOM : TOP) : (drawers.fromStart ? START : END),
                                  toolBar.fromStart ? START : END,
        )

        const isDrawerOpen = lgs.stores.ui.drawers.open !== null
        const horizontalOffsetLeft = isDrawerOpen ? __.ui.css.getCSSVariable('--lgs-horizontal-panel-offset-left') : '0.1px'
        const width = isDrawerOpen
                      ? `calc(${__.ui.css.getCSSVariable('--lgs-vertical-panel-width')} + ${__.ui.css.getCSSVariable('--right')})`
                      : '0.1px'

        const cssConfig = {
            [MENU_START_START]:  {
                '--primary-buttons-bar-left': width,
                '--primary-buttons-bar-right':         'auto',
                '--secondary-buttons-bar-left':        'auto',
                '--secondary-buttons-bar-margin-left': 'auto',
                '--secondary-buttons-bar-right':       0,
                '--lgs-horizontal-panel-left':         'var(--lgs-horizontal-panel-offset-left)',
                '--lgs-horizontal-panel-width':        `calc(var(--lgs-inner-width) - ${horizontalOffsetLeft})`,
            },
            [MENU_START_END]:    {
                '--primary-buttons-bar-left':          'auto',
                '--primary-buttons-bar-right': 'var(--right)',
                '--secondary-buttons-bar-left':        width,
                '--secondary-buttons-bar-margin-left': 0,
                '--secondary-buttons-bar-right':       'auto',
                '--lgs-horizontal-panel-left':         horizontalOffsetLeft,
                '--lgs-horizontal-panel-width':        `calc(var(--lgs-inner-width) - calc(var(--left) + ${width}))`,
                primaryEntrance:                       SECONDARY_ENTRANCE,
                secondaryEntrance:                     PRIMARY_ENTRANCE,
            },
            [MENU_END_START]:    {
                '--primary-buttons-bar-left':          0,
                '--primary-buttons-bar-right':         'auto',
                '--secondary-buttons-bar-left':        'auto',
                '--secondary-buttons-bar-margin-left': 'auto',
                '--secondary-buttons-bar-right':       width,
                '--lgs-horizontal-panel-left':         0,
                '--lgs-horizontal-panel-width':        `calc(var(--lgs-inner-width) - calc(var(--left) + ${width}))`,
            },
            [MENU_END_END]:      {
                '--primary-buttons-bar-left':          'auto',
                '--primary-buttons-bar-right':  `calc(${width} + var(--right))`,
                '--secondary-buttons-bar-left':        0,
                '--secondary-buttons-bar-margin-left': 0,
                '--secondary-buttons-bar-right':       'auto',
                '--lgs-horizontal-panel-left':         0,
                '--lgs-horizontal-panel-width': `calc(var(--lgs-inner-width) - calc(var(--left) - var(--right) + ${width}))`,
                primaryEntrance:                       SECONDARY_ENTRANCE,
                secondaryEntrance:                     PRIMARY_ENTRANCE,
            },
            [MENU_BOTTOM_START]: {
                '--primary-buttons-bar-left':          0,
                '--primary-buttons-bar-right':         'auto',
                '--secondary-buttons-bar-left':        'auto',
                '--secondary-buttons-bar-margin-left': 'auto',
                '--secondary-buttons-bar-right':       0,
                '--lgs-horizontal-panel-left':         0,
                '--lgs-horizontal-panel-width':        'calc(var(--lgs-inner-width) - var(--left))',
            },
            [MENU_BOTTOM_END]:   {
                '--primary-buttons-bar-left':          'auto',
                '--primary-buttons-bar-right':         0,
                '--secondary-buttons-bar-left':        0,
                '--secondary-buttons-bar-margin-left': 0,
                '--secondary-buttons-bar-right':       'auto',
                '--lgs-horizontal-panel-left':         0,
                '--lgs-horizontal-panel-width':        'calc(var(--lgs-inner-width) - var(--left))',
                primaryEntrance:                       SECONDARY_ENTRANCE,
                secondaryEntrance:                     PRIMARY_ENTRANCE,
            },
        }

        const config = cssConfig[placement] || {}
        Object.entries(config).forEach(([key, value]) => {
            if (key !== 'primaryEntrance' && key !== 'secondaryEntrance') {
                __.ui.css.setCSSVariable(key, value)
            }
        })

        return {
            primaryEntrance:   config.primaryEntrance || PRIMARY_ENTRANCE,
            secondaryEntrance: config.secondaryEntrance || SECONDARY_ENTRANCE,
        }
    }, [drawers.fromBottom, drawers.fromStart, toolBar.fromStart])

    useEffect(() => {
        if (lgs.settings.scene.mode.value === SCENE_MODE_2D.value) {
            lgs.scene.morphTo2D(0)
        }

        subscribe(lgs.stores.ui.drawers, arrangeDrawers)
        subscribe(lgs.settings.ui.menu, arrangeDrawers)
        window.addEventListener('resize', windowResized)

        arrangeDrawers()

        __.canvasEvents.addEventListener(EVENTS.DOUBLE_TAP, closeDrawer)
        __.canvasEvents.addEventListener(EVENTS.DOUBLE_CLICK, closeDrawer)

        return () => {
            __.canvasEvents.removeEventListener(EVENTS.DOUBLE_TAP, closeDrawer)
            __.canvasEvents.removeEventListener(EVENTS.DOUBLE_CLICK, closeDrawer)
            window.removeEventListener('resize', windowResized)
        }
    }, [arrangeDrawers, closeDrawer, windowResized])

    useEffect(() => {
        if (mainUI.callForActions.initialized || !readyForTheShow) {
            return
        }

        lgs.stores.ui.mainUI.callForActions.active = !theJourney
        lgs.stores.ui.mainUI.callForActions.initialized = true
    }, [readyForTheShow, theJourney, mainUI.callForActions.initialized])

    useEffect(() => {
        if (!mainUI.callForActions.active) {
            return
        }

        if (theJourney || video.editing || video.recording || video.preRecording || video.snapshot || video.finalizing) {
            lgs.stores.ui.mainUI.callForActions.active = false
        }
    }, [theJourney, mainUI.callForActions.active, video.editing, video.recording, video.preRecording, video.snapshot, video.finalizing])

    const tooltipDir = toolBar.fromStart ? 'right' : 'left'
    const {primaryEntrance, secondaryEntrance} = arrangeDrawers()
    const videoCaptureActive = video.preRecording || video.recording || video.snapshot || video.finalizing
    const isJourneyReplayUiHidden = replay.mainUiHidden === true

    return (
        <>
            <MapPointContextMenuTrigger/>
            <JourneyReplayCameraAngleGuide/>
            <MapPOIMonitor/>
            {!isJourneyReplayUiHidden && (
                <>
                    <div id="lgs-main-ui" onKeyDown={handleKeyDown}>
                        {!video.editing && (
                            <>
                                <div id="primary-buttons-bar" className={primaryEntrance}>
                                    <SettingsButton tooltip={tooltipDir}/>
                                    <LayersButton tooltip={tooltipDir}/>
                                    <POIEditButton tooltip={tooltipDir}/>
                                    <EditorPanelButton tooltip={tooltipDir}/>
                                    {/* <ProfileButton tooltip={tooltipDir}/> */}
                                    <TextButton tooltip={tooltipDir}/>
                                    <InformationButton tooltip={tooltipDir}/>
                                    <SupportUIButton tooltip={tooltipDir}/>
                                </div>
                                <div id="secondary-buttons-bar" className={secondaryEntrance}>
                                    {!video.recording && <Compass sensitivity={100}/>}
                                    <div id="secondary-buttons-bar-content">
                                        <SceneModeSelector tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                        <GeocodingButton tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                        <OrbitButton tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                        {!videoCaptureActive && <FullScreenButton tooltip={toolBar.fromStart ? 'left' : 'right'}/>}
                                        <div className="video-entry-actions">
                                            <VideoButton
                                                tooltip={toolBar.fromStart ? 'left' : 'right'}
                                                className="square-button"
                                                appearance="filled"
                                            />
                                            <JourneyReplayButton
                                                id="launch-the-replay-video"
                                                tooltip={toolBar.fromStart ? 'left' : 'right'}
                                                tooltipText="Record a synchronized Replay video"
                                                ariaLabel="Record a synchronized Replay video"
                                                onClick={startReplayVideo}
                                                variant="brand"
                                                appearance="filled"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {geocoderDialog.mounted && <GeocodingWidget/>}
                                <OrbitWidget/>
                                <PanoramaWidget/>
                            </>
                        )}

                        {!video.editing && (
                            <>
                                <CameraTarget/>
                                <div id="bottom-left-ui">

                                </div>
                                <div id="bottom-right-ui">
                                    {!video.recording && <CreditsBar/>}
                                </div>
                            </>
                        )}

                        {lgs.platform !== 'production' && (
                            <div id="used-platform">
                                {lgs.platform}-{lgs.versions.studio}
                            </div>
                        )}
                        <InformationPanel/>
                        <CodeDependenciesDrawer/>
                        <SettingsPanel/>
                        <LayersPanel/>
                        <TracksEditor/>
                        <JourneyGroupsDrawer/>
                        <JourneyReplayDrawer/>
                        <MapPOIEditPanel/>
                        <WidgetManagementDrawer/>
                        <WidgetEditorPanel/>
                    </div>
                    <SupportUI/>
                    <JourneyLoaderUI multiple/>
                    {mainUI.callForActions.active && <CallForActions/>}
                </>
            )}
            {video.editing && <CameraAdjustmentOverlay/>}
            <ContextMenuRenderer/>
            <VideoDownloadAndShareDialog/>
            <ReplayRecordingMonitorWidget/>

        </>
    )
})
