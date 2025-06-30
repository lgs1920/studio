/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TracksEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { JourneyLoaderButton }           from '@Components/FileLoader/JourneyLoaderButton'
import { JOURNEY_EDITOR_DRAWER }         from '@Core/constants'
import { SlDivider, SlDrawer, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useSnapshot }                   from 'valtio'
import { JourneySelector }               from './journey/JourneySelector'
import { JourneySettings }               from './journey/JourneySettings'
import { TrackSelector }                 from './track/TrackSelector'
import { TrackSettings }                 from './track/TrackSettings'
import { Utils }                         from './Utils'
import { memo, useCallback, useMemo }    from 'react'

// Memoized sub-component for the toolbar header
const ToolbarHeader = memo(({show, usage, onToggle}) => {
    if (!usage) {
        return null;
    }
    return (
        <div slot="header-actions">
            <SlSwitch
                align-right
                size="x-small"
                checked={show}
                onSlChange={onToggle}
            >
                Toolbar
            </SlSwitch>
        </div>
    );
});

// Memoized sub-component for journey content
const JourneyContent = memo(({journeyVisible}) => (
    <>
        <div className="selector-wrapper">
            <JourneySelector
                onChange={Utils.initJourneyEdition}
                single={true}
            />
            <JourneyLoaderButton
                tooltip="left"
                mini="true"
                className="editor-vertical-menu in-header"
            />
        </div>
        <JourneySettings/>
        {journeyVisible && (
            <>
                <SlDivider/>
                <div className="selector-wrapper">
                    <TrackSelector
                        onChange={Utils.initTrackEdition}
                        label={'Select one of the tracks:'}
                    />
                    <div className="editor-vertical-menu"/>
                </div>
                <TrackSettings/>
            </>
        )}
    </>
))

export const TracksEditor = memo(() => {
    // Select necessary state properties with safe defaults
    const {canViewJourneyData} = useSnapshot(lgs.stores.main)
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)

    const editorSnap = useSnapshot(lgs.theJourneyEditorProxy)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const {show: toolbarShow, usage: toolbarUsage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const hasJourneys = lgs.journeys.size > 0

    // Safely access journey.visible with a fallback
    const journeyVisible = editorSnap.journey?.visible ?? false

    // Memoized event handlers
    const toggleToolbar = useCallback(() => {
        lgs.settings.ui.journeyToolbar.show = !toolbarShow
    }, [toolbarShow])

    const handleRequestClose = useCallback((event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
        else {
            __.ui.drawerManager.close()
        }
    }, [])

    const closeTracksEditor = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(JOURNEY_EDITOR_DRAWER)) {
            window.dispatchEvent(new Event('resize')) // Consider debouncing if frequent
            __.ui.drawerManager.close()
        }
    }, [])

    // Early return for no journey data
    if (!canViewJourneyData) {
        return <div className="drawer-wrapper"/>
    }

    return (
        <div className="drawer-wrapper">
            <SlDrawer
                id={JOURNEY_EDITOR_DRAWER}
                open={drawerOpen === JOURNEY_EDITOR_DRAWER}
                onSlRequestClose={handleRequestClose}
                onSlAfterHide={closeTracksEditor}
                contained
                className="lgs-theme"
                placement={drawerPlacement}
            >
                <span slot="label">{'Edit the Journey'}</span>
                <ToolbarHeader
                    show={toolbarShow}
                    usage={toolbarUsage}
                    onToggle={toggleToolbar}
                />
                {hasJourneys && <JourneyContent journeyVisible={journeyVisible}/>}
                <div id="journey-editor-footer" slot="footer"/>
            </SlDrawer>
        </div>
    );
});