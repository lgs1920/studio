/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MainUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-18
 * Last modified: 2025-07-18
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Compass }                      from '@Components/cesium/CompassUI/Compass'
import { FullScreenButton }                     from '@Components/FullScreenButton/FullScreenButton'
import { ContextMenuHook }              from '@Components/MainUI/ContextMenuHook'
import { Cropper }                      from '@Components/MainUI/cropper/Cropper'
import { GeocodingButton }                      from '@Components/MainUI/geocoding/GeocodingButton'
import { GeocodingUI }                          from '@Components/MainUI/geocoding/GeocodingUI'
import { MapPOIContextMenu }            from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { MapPOIMonitor }                from '@Components/MainUI/MapPOI/MapPOIMonitor'
import { RotateButton }                 from '@Components/MainUI/RotateButton'
import { TrackEditorButton }            from '@Components/MainUI/TrackEditorButton'
import { PanelButton as VideoRecorder } from '@Components/MainUI/video/PanelButton'
import { VideoPreview }                 from '@Components/MainUI/video/VideoPreview'
import { VideoRecorderToolbar }         from '@Components/MainUI/video/VideoRecorderToolbar'
import { Profile }                      from '@Components/Profile/Profile'
import { ProfileButton }                        from '@Components/Profile/ProfileButton'
import { TracksEditor }                         from '@Components/TracksEditor/TracksEditor'
import {
    BOTTOM, END, EVENTS, MENU_BOTTOM_END, MENU_BOTTOM_START, MENU_END_END, MENU_END_START, MENU_START_END,
    MENU_START_START, SCENE_MODE_2D, SECOND, START, TOP,
}                                       from '@Core/constants'
import { JourneyToolbar }                       from '@Editor/JourneyToolbar'
import { memo, useCallback, useEffect, useRef } from 'react'
import { subscribe, useSnapshot }               from 'valtio'
import { CameraAndTargetPanel }                 from '../cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { JourneyLoaderUI }                      from '../FileLoader/JourneyLoaderUI'
import { Panel as InformationPanel }            from '../InformationPanel/Panel'
import { PanelButton as InformationButton } from '../InformationPanel/PanelButton'
import { Panel as LayersPanel }                 from '../Settings/layers/Panel'
import { PanelButton as LayersButton }          from '../Settings/layers/PanelButton'
import { Panel as SettingsPanel }               from '../Settings/Panel'
import { PanelButton as SettingsButton }        from '../Settings/PanelButton'
import { CallForActions }                       from './CallForActions'
import { CameraTarget }                         from './CameraTarget'
import { CreditsBar }                           from './credits/CreditsBar'
import { Panel as MapPOIEditPanel }             from './MapPOI/Panel'
import { PanelButton as POIEditButton }         from './MapPOI/PanelButton'
import { SceneModeSelector }                    from './SceneModeSelector'
import { SupportUI }                            from './SupportUI'
import { SupportUIButton }                      from './SupportUIButton'

import './style.css'

const PRIMARY_ENTRANCE = 'lgs-slide-in-from-left'
const SECONDARY_ENTRANCE = 'lgs-slide-in-from-right'

export const MainUI = memo(() => {
    const {hidden} = useSnapshot(lgs.stores.ui.welcome)
    const formerDevice = useRef(__.device.isMobile)
    const {drawers, toolBar} = useSnapshot(lgs.settings.ui.menu)
    const {show, usage} = useSnapshot(lgs.settings.ui.journeyToolbar)

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
                '--primary-buttons-bar-left':          width,
                '--primary-buttons-bar-right':         'auto',
                '--secondary-buttons-bar-left':        'auto',
                '--secondary-buttons-bar-margin-left': 'auto',
                '--secondary-buttons-bar-right':       0,
                '--lgs-horizontal-panel-left':         'var(--lgs-horizontal-panel-offset-left)',
                '--lgs-horizontal-panel-width':        `calc(var(--lgs-inner-width) - ${horizontalOffsetLeft})`,
            },
            [MENU_START_END]:    {
                '--primary-buttons-bar-left':          'auto',
                '--primary-buttons-bar-right':         0,
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
                '--primary-buttons-bar-right':         width,
                '--secondary-buttons-bar-left':        0,
                '--secondary-buttons-bar-margin-left': 0,
                '--secondary-buttons-bar-right':       'auto',
                '--lgs-horizontal-panel-left':         0,
                '--lgs-horizontal-panel-width':        `calc(var(--lgs-inner-width) - calc(var(--left) + ${width}))`,
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

    const tooltipDir = toolBar.fromStart ? 'right' : 'left'
    const {primaryEntrance, secondaryEntrance} = arrangeDrawers()

    return (
        <>
            <div id="lgs-main-ui" onKeyDown={handleKeyDown}>
                {hidden && (
                    <>
                        <div id="primary-buttons-bar" className={primaryEntrance}>
                            <SettingsButton tooltip={tooltipDir}/>
                            <LayersButton tooltip={tooltipDir}/>
                            <POIEditButton tooltip={tooltipDir}/>
                            <TrackEditorButton tooltip="top"/>
                            <ProfileButton tooltip={tooltipDir}/>
                            <InformationButton tooltip={tooltipDir}/>
                            <SupportUIButton tooltip={tooltipDir}/>
                        </div>
                        <div id="secondary-buttons-bar" className={secondaryEntrance}>
                            <Compass sensitivity={100}/>
                            <div id="secondary-buttons-bar-content">
                                <SceneModeSelector tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                <GeocodingButton tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                <RotateButton tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                <FullScreenButton/>
                                <VideoRecorder tooltip={toolBar.fromStart ? 'left' : 'right'}/>
                                <GeocodingUI/>
                            </div>
                        </div>
                        <CallForActions/>
                    </>
                )}
                <CameraTarget/>
                <div id="bottom-left-ui">
                    {lgs.platform !== 'production' && (
                        <div id="used-platform" className="lgs-card on-map">
                            {lgs.platform}-{lgs.versions.studio}
                        </div>
                    )}
                </div>
                <div id="bottom-right-ui">
                    <CreditsBar/>
                </div>
                <CameraAndTargetPanel/>
                <Profile/>
                <InformationPanel/>
                <SettingsPanel/>
                <LayersPanel/>
                <TracksEditor/>
                <MapPOIEditPanel/>
            </div>
            <SupportUI/>
            <JourneyLoaderUI multiple/>
            <MapPOIContextMenu/>
            <MapPOIMonitor/>
            <VideoRecorderToolbar tooltip={toolBar.fromStart ? 'left' : 'right'}/>
            <VideoPreview/>
            <ContextMenuHook/>
            {!device.mobile && video.canDefine &&
                // No video Cropping
                <Cropper source={lgs.canvas} store={lgs.stores.main.components.cropper}/>
            }
            {/* <CropSelector/> */}
            {/* <CropSelector/> */}
            {show && usage && <JourneyToolbar/>}
        </>
    )
})
