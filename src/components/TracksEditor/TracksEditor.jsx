/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TracksEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-11
 * Last modified: 2026-06-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter                 from '@Components/DrawerFooter'
import { JourneyLoaderButton }      from '@Components/FileLoader/JourneyLoaderButton'
import PanelActions                                  from '@Components/PanelsActions'
import { JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import WaDrawer                                      from '@Components/WaDrawerNonModal'
import { setGlobalHideOtherJourneys }                from '@Core/ui/JourneyVisibility'
import { useOptionalSnapshot }                       from '@Utils/ValtioUtils'
import classNames                                    from 'classnames'

import './style.css'
import { WaSwitch }                                  from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useRef }      from 'react'
import { createPortal }                              from 'react-dom'
import { useSnapshot }              from 'valtio'
import { JourneySelector }       from './journey/JourneySelector'
import { JourneySettings }       from './journey/JourneySettings'
import { Utils }                 from './Utils'

// Memoized sub-component for the toolbar header
const ToolbarHeader = memo(({show, usage, onToggle}) => {
    if (!usage) {
        return null
    }
    return (
        <WaSwitch
            label-at-start width-auto
            size="xs"
                checked={show}
            onChange={onToggle}
            >
                Toolbar
        </WaSwitch>
    )
})

// Memoized sub-component for journey content
const JourneyContent = memo(({hideOtherJourneys, onToggleHideOtherJourneys}) => (
    <div className="journey-content-wrapper">
        <div className="selector-wrapper">
            <JourneySelector
                onChange={Utils.initJourneyEdition}
                single={true}
                closeOnOutsidePointerDown
            />
            <JourneyLoaderButton
                id="import-journey-in-editor"
                tooltip="left"
                iconOnly
                className="journey-import-in-editor"
            />
        </div>
        <WaSwitch
            label-at-start
            size="xs"
            checked={hideOtherJourneys === true}
            onChange={onToggleHideOtherJourneys}
        >
            {'Hide other journeys'}
        </WaSwitch>
        <JourneySettings/>
    </div>
))

export const TracksEditor = memo(() => {
    // Select necessary state properties with safe defaults
    const {canViewJourneyData} = useSnapshot(lgs.stores.main)
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)
    const {hideOtherJourneys: globalHideOtherJourneys} = useOptionalSnapshot(lgs.settings.journey)

    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const {show: toolbarShow, usage: toolbarUsage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const hasJourneys = lgs.journeys.size > 0
    const drawerRef = useRef(null)

    const isStacked = __.ui.drawerManager.isStacked(JOURNEY_EDITOR_DRAWER)
    const closePanelWithManager = useCallback(() => {
        window.dispatchEvent(new Event('resize'))
        if (__.ui.drawerManager.isCurrent(JOURNEY_EDITOR_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    // Memoized event handlers
    const toggleToolbar = useCallback(() => {
        lgs.settings.ui.journeyToolbar.show = !lgs.settings.ui.journeyToolbar.show
    }, [])

    const setHideOtherJourneys = useCallback(async event => {
        const enabled = Boolean(event?.target?.checked)
        await setGlobalHideOtherJourneys(enabled, {
            currentJourney: lgs.theJourney,
        })
    }, [])

    const handleRequestClose = useCallback((event) => {
        if (event.target.tagName !== 'WA-DRAWER') {
            event.preventDefault()
        }
        else if (__.ui.drawerManager.isCurrent(JOURNEY_EDITOR_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const closeTracksEditor = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(JOURNEY_EDITOR_DRAWER)) {
            window.dispatchEvent(new Event('resize')) // Consider debouncing if frequent
            __.ui.drawerManager.close()
        }
    }, [])

    useEffect(() => {
        if (drawerOpen === JOURNEY_EDITOR_DRAWER) {
            __.ui.drawerManager.restoreDrawerUiState?.(drawerRef.current)
        }
    }, [drawerOpen])

    // Early return for no journey data
    if (!canViewJourneyData) {
        return null
    }

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawerOpen === JOURNEY_EDITOR_DRAWER &&
                    <WaDrawer
                        ref={drawerRef}
                        id={JOURNEY_EDITOR_DRAWER}
                        open={true}
                        onWaAfterHide={handleRequestClose}
                        onSlAfterHide={closeTracksEditor}
                        placement={drawerPlacement}
                        className={classNames({'drawer-is-stacked': isStacked})}
                    >

                        <span slot="label">{'Edit the Journey'}</span>
                        <PanelActions stackedPanel={isStacked} onBack={isStacked ? closePanelWithManager : null}>
                            <ToolbarHeader
                            show={toolbarShow}
                            usage={toolbarUsage}
                            onToggle={toggleToolbar}
                        />
                        </PanelActions>
                        {hasJourneys && (
                            <JourneyContent
                                hideOtherJourneys={globalHideOtherJourneys}
                                onToggleHideOtherJourneys={setHideOtherJourneys}
                            />
                        )}
                        <DrawerFooter/>
                    </WaDrawer>
            }
        </>
    )
    return drawerRoot ? createPortal(content, drawerRoot) : content

})
