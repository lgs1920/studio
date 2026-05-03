/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditorPanelButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JOURNEY_EDITOR_DRAWER, REMOVE_JOURNEY_IN_TOOLBAR } from '@Core/constants'
import { WaButton, WaIcon, WaPopup, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                           from 'valtio'

const JOURNEY_TRIGGER_CLICK_DELAY = 280

/**
 * A memoized React component for toggling the journey editor or loader.
 * @param {Object} props - Component props
 * @param {string} [props.tooltip] - Tooltip and popup side placement.
 * @returns {JSX.Element} The rendered TrackEditorButton component
 */
export const EditorPanelButton = memo((props) => {
    // Granular snapshots to minimize re-renders
    const {toolBar} = useSnapshot(lgs.settings.ui.menu)
    // Derive boolean to avoid reactivity to nested theJourney properties
    const hasJourney = useSnapshot(lgs.stores.main).theJourney !== null
    const [open, setOpen] = useState(false)
    const _popupHost = useRef(null)
    const _triggerClickTimer = useRef(null)

    // Stable references to store objects
    const journeyLoaderStore = useMemo(() => lgs.stores.ui.mainUI.journeyLoader, [])
    const mainUI = useMemo(() => lgs.stores.ui.mainUI, [])

    /**
     * Memoized tooltip placement based on toolbar settings.
     * @type {string}
     */
    const tooltipPlacement = useMemo(() => {
        return props.tooltip ?? (toolBar.fromStart ? 'right' : 'left')
    }, [props.tooltip, toolBar.fromStart])

    const popupPlacement = useMemo(() => {
        return tooltipPlacement === 'right' ? 'right-start' : 'left-start'
    }, [tooltipPlacement])

    /**
     * Toggles the journey actions popup.
     * @function
     */
    const toggleActions = useCallback(() => {
        if (_triggerClickTimer.current) {
            window.clearTimeout(_triggerClickTimer.current)
        }

        _triggerClickTimer.current = window.setTimeout(() => {
            _triggerClickTimer.current = null
            setOpen(current => !current)
        }, JOURNEY_TRIGGER_CLICK_DELAY)
    }, [])

    const clearTriggerClickTimer = useCallback(() => {
        if (!_triggerClickTimer.current) {
            return
        }

        window.clearTimeout(_triggerClickTimer.current)
        _triggerClickTimer.current = null
    }, [])

    /**
     * Opens the journey loader.
     * @function
     */
    const importJourney = useCallback(() => {
        clearTriggerClickTimer()
        setOpen(false)
        journeyLoaderStore.visible = true
    }, [clearTriggerClickTimer, journeyLoaderStore])

    /**
     * Toggles the journey editor.
     * @function
     */
    const editJourney = useCallback(() => {
        clearTriggerClickTimer()
        setOpen(false)
        __.ui.drawerManager.toggle(JOURNEY_EDITOR_DRAWER, {
            suppressFocusOnOpen: [
                                     lgs.theJourney?.slug,
                                     lgs.stores.main.components.pois.current,
                                 ].filter(Boolean),
        })
    }, [clearTriggerClickTimer])

    const activateJourneyTrigger = useCallback((event) => {
        event.preventDefault()
        event.stopPropagation()
        clearTriggerClickTimer()

        if (hasJourney) {
            editJourney()
            return
        }

        importJourney()
    }, [clearTriggerClickTimer, editJourney, hasJourney, importJourney])

    // Manage remove journey dialog state (if needed)
    useEffect(() => {
        mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)
        // Cleanup to ensure consistent state
        return () => {
            mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)
        }
    }, [mainUI])

    useEffect(() => {
        return () => clearTriggerClickTimer()
    }, [clearTriggerClickTimer])

    useEffect(() => {
        if (!open) {
            return
        }

        const handlePointerDown = (event) => {
            if (_popupHost.current && !event.composedPath().includes(_popupHost.current)) {
                setOpen(false)
            }
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        window.addEventListener('keydown', handleKeyDown, true)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            window.removeEventListener('keydown', handleKeyDown, true)
        }
    }, [open])

    return (
        <div className="toolbar-action-popup-host journey-action-popup-host" ref={_popupHost}>
            <WaTooltip for="open-journey-editor" placement={tooltipPlacement}>{'Journey'}</WaTooltip>
            <WaButton id="open-journey-editor"
                      className="square-button"
                      onClick={toggleActions}
                      onDoubleClick={activateJourneyTrigger}
                      variant={'brand'}
                      appearance="Filled"
                      aria-haspopup="menu"
                      aria-expanded={open ? 'true' : 'false'}>
                <WaIcon name={hasJourney ? 'route' : 'circle-plus'} variant="regular"/>
            </WaButton>

            <WaPopup anchor="open-journey-editor"
                     active={open}
                     placement={popupPlacement}
                     distance={lgs.gutter.xs}
                     flip
                     shift>
                <div className={`toolbar-action-popup ${hasJourney && popupPlacement === 'right-start' ? 'toolbar-action-popup--reverse' : ''}`}
                     role="menu">
                    <WaTooltip for="journey-action-import" placement="top">{'Import journey'}</WaTooltip>
                    <WaButton id="journey-action-import"
                              className="square-button"
                              variant="brand"
                              appearance="Filled"
                              onClick={importJourney}
                              role="menuitem"
                              aria-label="Import">
                        <WaIcon name="file-import" variant="regular"/>
                    </WaButton>

                    {hasJourney && (
                        <>
                            <WaTooltip for="journey-action-edit" placement="top">{'Edit Journey'}</WaTooltip>
                            <WaButton id="journey-action-edit"
                                      className="square-button"
                                      variant="brand"
                                      appearance="Filled"
                                      onClick={editJourney}
                                      role="menuitem">
                                <WaIcon name="pen-to-square" variant="regular"/>
                            </WaButton>
                        </>
                    )}
                </div>
            </WaPopup>
        </div>
    )
})
