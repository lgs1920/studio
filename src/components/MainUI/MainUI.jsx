/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MainUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-23
 * Last modified: 2026-04-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
import { Compass }          from '@Components/MainUI/compass/Compass'
import { FullScreenButton } from '@Components/FullScreenButton/FullScreenButton'
import { ContextMenuRenderer } from '@Components/MainUI/context-menu/ContextMenuRenderer'

import { GeocodingButton }   from '@Components/MainUI/geocoding/GeocodingButton'
import { GeocodingUI }                          from '@Components/MainUI/geocoding/GeocodingUI'
import { MapPOIMonitor }     from '@Components/MainUI/MapPOI/MapPOIMonitor'
import { RotateButton }      from '@Components/MainUI/RotateButton'
import { EditorPanelButton } from '@Editor/EditorPanelButton'
import { VideoButton }       from '@Components/MainUI/video/VideoButton'
import { VideoDownloadAndShareDialog } from '@Components/MainUI/video/VideoDownloadAndShareDialog'
import { ProfileButton }                        from '@Components/Profile/ProfileButton'
import { TextButton }        from '@Components/Text/TextButton'
import { TracksEditor }                         from '@Components/TracksEditor/TracksEditor'
import {
    BOTTOM, END, EVENTS, MENU_BOTTOM_END, MENU_BOTTOM_START, MENU_END_END, MENU_END_START, MENU_START_END,
    MENU_START_START, SCENE_MODE_2D, SECOND, START, TOP,
}                            from '@Core/constants'
import { memo, useCallback, useEffect, useRef } from 'react'
import { subscribe, useSnapshot }               from 'valtio'
import { JourneyLoaderUI }                      from '../FileLoader/JourneyLoaderUI'
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
import { WidgetEditorPanel } from './widgets/editor/WidgetEditorPanel'

import './style.css'

const PRIMARY_ENTRANCE = 'lgs-slide-in-from-left'
const SECONDARY_ENTRANCE = 'lgs-slide-in-from-right'

export const MainUI = memo(() => {
    const formerDevice = useRef(__.device.isMobile)
    const main = useSnapshot(lgs.stores.main)
    const mainUI = useSnapshot(lgs.stores.ui.mainUI)
    const {drawers, toolBar} = useSnapshot(lgs.settings.ui.menu)
    const {device, video} = useSnapshot(lgs.stores.ui)


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

    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Escape') {
            closeDrawer()
        }
        console.log(event.key)
    }, [closeDrawer])

    const arrangeDrawers = useCallback(() => {
        const placement = sprintf('%s-%s',
                                  __.device.isMobile ? (drawers.fromBottom ? BOTTOM : TOP) : (drawers.fromStart ? START : END),
                                  toolBar.fromStart ? START : END,
        )

        const isDrawerOpen = lgs.stores.ui.drawers.open !== null
        const verticalOffsetLeft = isDrawerOpen ? __.ui.css.getCSSVariable('--lgs-vertical-panel-offset-left') : '0.1px'
        const verticalOffsetRight = isDrawerOpen ? __.ui.css.getCSSVariable('--lgs-vertical-panel-offset-right') : '0.1px'
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
        if (mainUI.callForActions.initialized || !main.readyForTheShow) {
            return
        }

        lgs.stores.ui.mainUI.callForActions.active = !main.theJourney
        lgs.stores.ui.mainUI.callForActions.initialized = true
    }, [main.readyForTheShow, main.theJourney, mainUI.callForActions.initialized])

    useEffect(() => {
        if (!mainUI.callForActions.active) {
            return
        }

        if (main.theJourney || video.editing || video.recording || video.preRecording || video.snapshot) {
            lgs.stores.ui.mainUI.callForActions.active = false
        }
    }, [main.theJourney, mainUI.callForActions.active, video.editing, video.recording, video.preRecording, video.snapshot])

    const tooltipDir = toolBar.fromStart ? 'right' : 'left'
    const {primaryEntrance, secondaryEntrance} = arrangeDrawers()

    return (
        <>
            <div id="lgs-main-ui" onKeyDown={handleKeyDown}>
                {!video.editing && (
                    <>
                        <div id="primary-buttons-bar" className={primaryEntrance}>
                            <SettingsButton tooltip={tooltipDir}/>
                            <LayersButton tooltip={tooltipDir}/>
                            <POIEditButton tooltip={tooltipDir}/>
                            <EditorPanelButton tooltip="top"/>
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
                                <RotateButton tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                <FullScreenButton tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                <VideoButton tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                <GeocodingUI/>
                            </div>
                        </div>
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
                <SettingsPanel/>
                <LayersPanel/>
                <TracksEditor/>
                <MapPOIEditPanel/>
                <WidgetEditorPanel/>
            </div>
            <SupportUI/>
            <JourneyLoaderUI multiple/>
            <ContextMenuRenderer/>

            <MapPOIMonitor/>
            <VideoDownloadAndShareDialog/>

            {mainUI.callForActions.active && <CallForActions/>}

        </>
    )
})
