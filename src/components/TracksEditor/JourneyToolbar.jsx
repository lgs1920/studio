/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ToggleStateIcon }                                           from '@Components/ToggleStateIcon'
import {
    FOCUS_ICON, ROTATION_ICON, UPDATE_JOURNEY_SILENTLY,
} from '@Core/constants'
import { getGlobalHideOtherJourneys, refreshJourneyVisibility } from '@Core/ui/JourneyVisibility'
import {
    JourneySelector,
} from '@Editor/journey/JourneySelector'
import { Utils }                                                     from '@Editor/Utils'
import {
    REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
}                                                                 from '@Core/ui/replay/JourneyReplayMode'
import {
    WaButton, WaCard, WaIcon, WaSpinner, WaTooltip,
} from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef, useState } from 'react'
import { useSnapshot }                                               from 'valtio'

/**
 * A toolbar component for managing journey-related actions, such as selecting journeys, toggling visibility, focusing,
 * rotating, and dragging the toolbar.
 * @param {Object} props - Component props
 * @returns {JSX.Element} The rendered JourneyToolbar component
 */
export const JourneyToolbar = (props) => {
    const toolbarRef = props.ref
    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)

    const _journeyToolbar = useRef(null)
    const _journeySelector = useRef(null)

    const $journeyEditor = lgs.stores.main.components.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)

    const $rotate = lgs.stores.ui.mainUI.rotate
    const rotate = useSnapshot($rotate)

    const journeyLoaderStore = lgs.stores.ui.mainUI.journeyLoader
    const $editorStore = lgs.theJourneyEditorProxy
    const editorStore = useSnapshot($editorStore)

    const autoRotate = useSnapshot(lgs.settings.ui.camera.start.rotate)
    const replayState = useSnapshot(lgs.stores.replay)
    const replayActive = replayState.active || replayState.playing || replayState.paused
    const rotationAllowedByJourneyReplay = !replayActive && replayState.orbitAllowed !== false
    const replayRuntime = replayState
    const [journeyToolbarTemporarilyHidden, setJourneyToolbarTemporarilyHidden] = useState(
        __.ui.replay?.isJourneyToolbarTemporarilyHidden?.() === true,
    )
    const rotationAllowed = useRef(false)
    const manualRotate = useRef(null)
    const journeyOrbitActive = rotate.running

    const [isDragging, setIsDragging] = useState(false)

    useEffect(() => {
        const syncVisibility = () => {
            setJourneyToolbarTemporarilyHidden(__.ui.replay?.isJourneyToolbarTemporarilyHidden?.() === true)
        }

        syncVisibility()
        globalThis.window?.addEventListener?.(REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT, syncVisibility)
        return () => {
            globalThis.window?.removeEventListener?.(REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT, syncVisibility)
        }
    }, [])

    /**
     * Opens the journey loader by setting its visibility to true.
     */
    const journeyLoader = () => {
        journeyLoaderStore.visible = true
    }

    /**
     * Handles the selection of a new journey and updates the journey editor.
     * @param {Event} event - The change event from the journey selector
     */
    const newJourneySelection = async (event) => {
        await Utils.updateJourneyEditor(event.target.value, {})
    }

    /**
     * Stops the camera rotation if it is currently running.
     */
    const stopRotate = async () => {
        if ($rotate.running) {
            await __.ui.cameraManager.stopRotate()
        }
    }

    /**
     * Sets the visibility of the current journey and updates related settings.
     * @param {boolean} visibility - Whether the journey should be visible
     */
    const setJourneyVisibility = async (visibility) => {
        await stopRotate()
        $editorStore.journey.visible = visibility
        lgs.theJourney.updateVisibility(visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY, {focus: false})
        if (getGlobalHideOtherJourneys()) {
            await refreshJourneyVisibility({
                hideOtherJourneys: true,
                currentJourney:    lgs.theJourney,
            })
        }
        Utils.renderJourneySettings()
    }

    /**
     * Toggles the rotation state and focuses on the journey.
     * @param {Event} event - The click event
     */
    const forceRotate = async () => {
        if ($rotate.running) {
            rotationAllowed.current = false
            await stopRotate()
            return
        }

        if (!rotationAllowedByJourneyReplay) {
            return
        }
        rotationAllowed.current = !rotationAllowed.current
        await focusOnJourney()
    }

    /**
     * Initiates rotation if allowed, or stops it, then focuses on the journey.
     * @param {Event} event - The click event
     */
    const maybeRotate = async (event) => {
        event.stopPropagation()
        if (rotate.running) {
            rotationAllowed.current = false
            await stopRotate()
            return
        }
        if (!rotationAllowedByJourneyReplay) {
            await focusOnJourney({rotate: false})
            return
        }
        rotationAllowed.current = autoRotate.journey
        await focusOnJourney()
    }

    /**
     * Focuses the camera on the current journey, optionally resetting the camera and enabling rotation.
     */
    const focusOnJourney = async ({rotate: shouldRotate = rotationAllowed.current || autoRotate.journey} = {}) => {
        if ($rotate.running) {
            await __.ui.cameraManager.stopRotate()
        }
        await setJourneyVisibility(true)
        lgs.theJourney.focus({
                                 resetCamera: true,
                                 rotate: shouldRotate,
                             })
    }

    useEffect(() => {}, [replayRuntime.active, replayRuntime.playing, replayRuntime.paused])

    useEffect(() => {
        if (toolbarRef) {
            toolbarRef.current = {

                // We do not need handleDragStart here

                /**
                 * Handles drag movement, updating toolbar position.
                 * If target is the journey selector, hide it.
                 * @param {Event} event - The drag event
                 */
                handleDrag: event => {
                    $journeyToolbar.x = event.left
                    $journeyToolbar.y = event.top
                    if (_journeySelector.current && !isDragging) {
                        _journeySelector.current.hide()
                    }
                    setIsDragging(true)

                },

                /**
                 * Handles the drag end event. it will display journey selector options
                 * if it's only a click.
                 * @param {Object} event - The drag end event object.
                 */
                handleDragEnd: () => {
                    if (_journeySelector.current && isDragging) {
                        _journeySelector.current.show()
                    }
                    setIsDragging(false)
                },
            }
        }
    }, [toolbarRef, isDragging, $journeyToolbar])

    return (
        <>
            {journeyEditor.list.length > 0 && journeyToolbar.show && !journeyToolbarTemporarilyHidden &&
                <WaCard className="journey-toolbar lgs--toolbar wa-theme-lgs1920-on-map"
                        ref={_journeyToolbar}>
                    <JourneySelector onChange={newJourneySelection}
                                     single="true"
                                     closeOnOutsidePointerDown
                                     size="s"
                                     ref={_journeySelector}/>

                    <WaTooltip for="create-journey-toolbar">{'Import journey'}</WaTooltip>
                    <WaButton id="create-journey-toolbar"
                              appearance="plain"
                              variant="brand"
                              onClick={journeyLoader}
                              aria-label="Import"
                    >
                        <WaIcon name="file-import" variant={'regular'}/>
                    </WaButton>

                    <WaTooltip for="visibility-journey-toolbar">{'Show/hide journey'}</WaTooltip>
                    <ToggleStateIcon
                        id="visibility-journey-toolbar"
                        onChange={setJourneyVisibility}
                        initial={editorStore?.journey?.visible}
                    />

                    <>
                        {editorStore.journey?.visible &&
                            <>
                                {!autoRotate.journey &&
                                    <>
                                        <WaTooltip for="rotate-journey-toolbar">
                                            {
                                                journeyOrbitActive
                                                ? 'Stop orbit'
                                                : 'Start orbit'
                                            }
                                        </WaTooltip>

                                        <WaButton
                                            variant="brand"
                                            appearance="plain"
                                            id="rotate-journey-toolbar"
                                            ref={manualRotate}
                                            onClick={forceRotate}
                                            disabled={!rotationAllowedByJourneyReplay && !rotate.running}
                                            size="s"
                                        >
                                            {journeyOrbitActive
                                             ? (<WaSpinner size="s"/>)
                                             : (<WaIcon name={FOCUS_ICON} variant="regular"/>)
                                            }
                                        </WaButton>
                                    </>
                                }
                                    <WaTooltip for="focus-journey-toolbar">{
                                        journeyOrbitActive
                                        ? 'Stop orbit'
                                        : 'Focus on journey'
                                    }
                                    </WaTooltip>
                                    <WaButton
                                        id="focus-journey-toolbar"
                                        variant="brand"
                                        appearance="plain"
                                        onClick={maybeRotate}
                                    >
                                        {journeyOrbitActive
                                        ? (<WaIcon name={ROTATION_ICON} variant="regular" animation="spin"/>)
                                        : (<WaIcon name={FOCUS_ICON} variant="regular"/>)
                                        }
                                    </WaButton>
                            </>
                        }
                    </>
                </WaCard>
            }
        </>
    )
}
