/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MainUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-04-30
 * Last modified: 2025-04-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Compass } from '@Components/cesium/CompassUI/Compass'
import { FullScreenButton }                 from '@Components/FullScreenButton/FullScreenButton'
import { GeocodingButton }                  from '@Components/MainUI/geocoding/GeocodingButton'
import { GeocodingUI }       from '@Components/MainUI/geocoding/GeocodingUI'
import { TrackEditorButton } from '@Components/MainUI/TrackEditorButton'
import { MapPOICluster }     from '@Components/MainUI/MapPOI/MapPOICluster'
import { MapPOIContextMenu }                from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { RotateButton }                     from '@Components/MainUI/RotateButton'
import { Profile }                          from '@Components/Profile/Profile'
import { ProfileButton }                    from '@Components/Profile/ProfileButton'
import { TracksEditor }                     from '@Components/TracksEditor/TracksEditor'
import {
    BOTTOM, CESIUM_EVENTS, DESKTOP_MIN, DOUBLE_CLICK_TIMEOUT, DOUBLE_TAP_TIMEOUT, END, MENU_BOTTOM_END,
    MENU_BOTTOM_START, MENU_END_END,
    MENU_END_START,
    MENU_START_END,
    MENU_START_START, MOBILE_MAX, POINTER, POIS_EDITOR_DRAWER, SCENE_MODE_2D, SECOND, START, TOP,
} from '@Core/constants'
import { JourneyToolbar } from '@Editor/JourneyToolbar'
import { useEffect, useRef, useState } from 'react'

import './style.css'
import { useMediaQuery }                    from 'react-responsive'
import { subscribe, useSnapshot }           from 'valtio'
import { CameraAndTargetPanel }             from '../cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { JourneyLoaderUI }                  from '../FileLoader/JourneyLoaderUI'
import { Panel as InformationPanel }        from '../InformationPanel/Panel'
import { PanelButton as InformationButton } from '../InformationPanel/PanelButton'
import { Panel as LayersPanel }             from '../Settings/layers/Panel'
import { PanelButton as LayersButton }      from '../Settings/layers/PanelButton'
import { Panel as SettingsPanel }           from '../Settings/Panel'
import { PanelButton as SettingsButton }    from '../Settings/PanelButton'
import { CallForActions }                   from './CallForActions'
import { CameraTarget }                     from './CameraTarget'
import { CreditsBar }                       from './credits/CreditsBar'
import { Panel as MapPOIEditPanel }         from './MapPOI/Panel'
import { PanelButton as POIEditButton }     from './MapPOI/PanelButton'
import { SceneModeSelector }                from './SceneModeSelector'
import { SupportUI }                        from './SupportUI'
import { SupportUIButton }                  from './SupportUIButton'

export const MainUI = () => {

    const snap = useSnapshot(lgs.mainProxy)
    const isMobile = useMediaQuery({maxWidth: MOBILE_MAX})
    const settings = useSnapshot(lgs.settings.ui.menu)
    const clickTimeout = useRef(null)

    const journeyToolbar = useSnapshot(lgs.settings.ui.journeyToolbar)

    let resizeTimer
    const windowResized = () => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
            if (!isMobile && window.innerWidth <= MOBILE_MAX) {
                __.ui.menuManager.reset()
                arrangeDrawers()
            }
            if (isMobile && window.innerWidth >= DESKTOP_MIN) {
                __.ui.menuManager.reset()
                arrangeDrawers()
            }
        }, 0.3 * SECOND)
    }

    const closeDrawer = (event) => {
        console.log(event)
        __.ui.drawerManager.close()
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            closeDrawer()
        }
    }


    useEffect(() => {
        if (lgs.settings.scene.mode.value === SCENE_MODE_2D.value) {
            lgs.scene.morphTo2D(0)
        }
        // we need to manage some canvas events
        __.canvasEvents.addEventListener(__.canvasEvents.events.DOUBLE_TAP, closeDrawer)
        __.canvasEvents.addEventListener(__.canvasEvents.events.LEFT_DOUBLE_CLICK, closeDrawer)

        return () => {
            __.canvasEvents.removeEventListener(__.canvasEvents.events.DOUBLE_TAP, closeDrawer)
            __.canvasEvents.removeEventListener(__.canvasEvents.events.LEFT_DOUBLE_CLICK, closeDrawer)

        }

    }, [])

    // We need to interact with  Drawers
    let primaryEntrance = 'lgs-slide-in-from-left'
    let secondaryEntrance = 'lgs-slide-in-from-right'
    const arrangeDrawers = () => {
        const placement = sprintf('%s-%s',
                                  isMobile ? (lgs.settings.ui.menu.drawers.fromBottom ? BOTTOM : TOP)
                                           : lgs.settings.ui.menu.drawers.fromStart ? START : END,
                                  lgs.settings.ui.menu.toolBar.fromStart ? START : END)


        const verticalOffsetLeft = (lgs.mainProxy.drawers.open === null) ? '0.1px' : __.ui.css.getCSSVariable('--lgs-vertical-panel-offset-left')
        const verticalOffsetRight = (lgs.mainProxy.drawers.open === null) ? '0.1px' : __.ui.css.getCSSVariable('--lgs-vertical-panel-offset-right')
        const horizontalOffsetLeft = (lgs.mainProxy.drawers.open === null) ? '0.1px' : __.ui.css.getCSSVariable('--lgs-horizontal-panel-offset-left')

        const width = (lgs.mainProxy.drawers.open === null)
                      ? '0.1px'
                      : `calc( ${__.ui.css.getCSSVariable('--lgs-vertical-panel-width')} + ${__.ui.css.getCSSVariable('--right')}`
        switch (placement) {
            case MENU_START_START:
                __.ui.css.setCSSVariable('--primary-buttons-bar-left', width)
                __.ui.css.setCSSVariable('--primary-buttons-bar-right', 'auto')
                __.ui.css.setCSSVariable('--secondary-buttons-bar-left', 'auto')
                __.ui.css.setCSSVariable('--secondary-buttons-bar-margin-left', 'auto')
                __.ui.css.setCSSVariable('--secondary-buttons-bar-right', 0)
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-left', 'var(--lgs-horizontal-panel-offset-left)')
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-width', `calc( var(--lgs-inner-width) - ${horizontalOffsetLeft})`)
                break
            case MENU_START_END:
                primaryEntrance = 'lgs-slide-in-from-right'
                secondaryEntrance = 'lgs-slide-in-from-left'
                __.ui.css.setCSSVariable('--primary-buttons-bar-left', 'auto')
                __.ui.css.setCSSVariable('--primary-buttons-bar-right', 0)
                __.ui.css.setCSSVariable('--secondary-buttons-bar-left', width)
                __.ui.css.setCSSVariable('--secondary-buttons-bar-margin-left', 0)
                __.ui.css.setCSSVariable('--secondary-buttons-bar-right', 'auto')
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-left', horizontalOffsetLeft)
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-width', `calc( var(--lgs-inner-width) - calc(var(--left) + ${width}))`)
                break
            case MENU_END_START:
                __.ui.css.setCSSVariable('--primary-buttons-bar-left', 0)
                __.ui.css.setCSSVariable('--primary-buttons-bar-right', 'auto')
                __.ui.css.setCSSVariable('--secondary-buttons-bar-left', 'auto')
                __.ui.css.setCSSVariable('--secondary-buttons-bar-margin-left', 'auto')
                __.ui.css.setCSSVariable('--secondary-buttons-bar-right', width)
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-left', 0)
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-width', `calc( var(--lgs-inner-width) - calc(var(--left) + ${width}))`)
                break
            case MENU_END_END:
                primaryEntrance = 'lgs-slide-in-from-right'
                secondaryEntrance = 'lgs-slide-in-from-left'
                __.ui.css.setCSSVariable('--primary-buttons-bar-left', 'auto')
                __.ui.css.setCSSVariable('--primary-buttons-bar-right', width)
                __.ui.css.setCSSVariable('--secondary-buttons-bar-left', 0)
                __.ui.css.setCSSVariable('--secondary-buttons-bar-margin-left', 0)

                __.ui.css.setCSSVariable('--secondary-buttons-bar-right', 'auto')
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-left', 0)
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-width', `calc( var(--lgs-inner-width) - calc(var(--left) + ${width}))`)
                break

            case MENU_BOTTOM_START:
                __.ui.css.setCSSVariable('--primary-buttons-bar-left', 0)
                __.ui.css.setCSSVariable('--primary-buttons-bar-right', 'auto')
                __.ui.css.setCSSVariable('--secondary-buttons-bar-left', 'auto')
                __.ui.css.setCSSVariable('--secondary-buttons-bar-margin-left', 'auto')

                __.ui.css.setCSSVariable('--secondary-buttons-bar-right', 0)
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-left', 0)
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-width', `calc( var(--lgs-inner-width) - calc(var(--left) ))`)
                break
            case MENU_BOTTOM_END:
                primaryEntrance = 'lgs-slide-in-from-right'
                secondaryEntrance = 'lgs-slide-in-from-left'
                __.ui.css.setCSSVariable('--primary-buttons-bar-left', 'auto')
                __.ui.css.setCSSVariable('--primary-buttons-bar-right', 0)
                __.ui.css.setCSSVariable('--secondary-buttons-bar-left', 0)
                __.ui.css.setCSSVariable('--secondary-buttons-bar-margin-left', 0)

                __.ui.css.setCSSVariable('--secondary-buttons-bar-right', 'auto')
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-left', 0)
                __.ui.css.setCSSVariable('--lgs-horizontal-panel-width', `calc( var(--lgs-inner-width) - calc(var(--left) ))`)
                break
        }


    }
    subscribe(lgs.mainProxy.drawers, arrangeDrawers)
    subscribe(lgs.settings.ui.menu, arrangeDrawers)
    window.addEventListener('resize', windowResized)

    arrangeDrawers()

    const SupportUIDialog = () => {
        return (<SupportUI/>)
    }


    return (
        <>
            <div id="lgs-main-ui" onKeyDown={handleKeyDown}>
                {snap.components.welcome.hidden &&
                    <>
                        <div id={'primary-buttons-bar'} className={primaryEntrance}>
                            <SettingsButton tooltip={settings.toolBar.fromStart ? 'right' : 'left'}/>
                            <LayersButton tooltip={settings.toolBar.fromStart ? 'right' : 'left'}/>
                            <POIEditButton tooltip={settings.toolBar.fromStart ? 'right' : 'left'}/>
                            <TrackEditorButton tooltip={'top'}/>
                            <ProfileButton tooltip={settings.toolBar.fromStart ? 'right' : 'left'}/>

                            <InformationButton tooltip={settings.toolBar.fromStart ? 'right' : 'left'}/>
                            <SupportUIButton tooltip={settings.toolBar.fromStart ? 'right' : 'left'}/>
                        </div>
                        <div id={'secondary-buttons-bar'} className={secondaryEntrance}>
                            <Compass sensitivity={100}/>
                            <div id="secondary-buttons-bar-content">
                                <SceneModeSelector tooltip={settings.toolBar.fromStart ? 'left' : 'right'}/>
                                <GeocodingButton tooltip={settings.toolBar.fromStart ? 'left' : 'right'}/>
                                <RotateButton tooltip={settings.toolBar.fromStart ? 'left' : 'right'}/>
                                <FullScreenButton/>
                                <GeocodingUI/>

                            </div>

                        </div>

                    </>
                }
                {snap.components.welcome.hidden && <CallForActions/>}

                <CameraTarget/>
                <div id={'bottom-left-ui'}>
                    {
                        lgs.platform !== 'production' &&
                        <div id="used-platform"
                             className={'lgs-card on-map'}> {lgs.platform}-{lgs.versions.studio}
                        </div>
                    }
                </div>

                <div id={'bottom-right-ui'}>
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
            {/* <MapPOICluster/> */}

            <SupportUIDialog/>
            <JourneyLoaderUI multiple/>
            <MapPOIContextMenu/>

            {journeyToolbar.show && journeyToolbar.usage && <JourneyToolbar/>}


        </>
    )
}

