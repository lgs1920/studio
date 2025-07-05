/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-05
 * Last modified: 2025-07-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FAButton }                                                             from '@Components/FAButton'
import { ToggleStateIcon }                                                      from '@Components/ToggleStateIcon'
import { APP_EVENT, CURRENT_JOURNEY, REFRESH_DRAWING, UPDATE_JOURNEY_SILENTLY } from '@Core/constants'
import { DragHandler }                                                          from '@Core/ui/drag-handler/DragHandler'
import { JourneySelector }                                                      from '@Editor/journey/JourneySelector'
import { Utils }                                                                from '@Editor/Utils'
import {
    faCrosshairsSimple, faGripDotsVertical, faSquarePlus, faXmark,
}                                                                               from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlIcon, SlIconButton, SlTooltip,
}                                                                               from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                                from '@Utils/FA2SL'
import React, { useEffect, useRef, useState }                                   from 'react'
import { sprintf }                                                              from 'sprintf-js'
import { useSnapshot }                                                          from 'valtio'

/**
 * A toolbar component for managing journey-related actions, such as selecting journeys, toggling visibility, focusing,
 * rotating, and dragging the toolbar.
 * @param {Object} props - Component props
 * @returns {JSX.Element} The rendered JourneyToolbar component
 */
export const JourneyToolbar = (props) => {
    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)
    const _journeyToolbar = useRef(null)
    const _journeySelector = useRef(null)

    const toolbarMoved = useRef(false)
    const selectStates = useRef(new Map()) // Store initial disabled states of SlSelect elements

    const $journeyEditor = lgs.mainProxy.components.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)

    const $rotate = lgs.stores.ui.mainUI.rotate
    const rotate = useSnapshot($rotate)

    const animationFrame = useRef(null)
    const journeyLoaderStore = lgs.stores.ui.mainUI.journeyLoader
    let dragging
    const $editorStore = lgs.theJourneyEditorProxy
    const editorStore = useSnapshot($editorStore)

    const autoRotate = useSnapshot(lgs.settings.ui.camera.start.rotate)
    let rotationAllowed = false
    const manualRotate = useRef(null)

    const grabber = useRef(null)
    const [init, setInit] = useState(false)

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
     * Memoized condition for rendering FAButton vs SlSpinner.
     * @type {boolean}
     */
    const showButton = () => {
        return rotate.running && autoRotate.journey && !rotate.target
    }

    /**
     * Sets the visibility of the current journey and updates related settings.
     * @param {boolean} visibility - Whether the journey should be visible
     */
    const setJourneyVisibility = async (visibility) => {
        stopRotate()
        $editorStore.journey.visible = visibility
        lgs.theJourney.updateVisibility(visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    /**
     * Toggles the rotation state and focuses on the journey.
     * @param {Event} event - The click event
     */
    const forceRotate = async (event) => {
        rotationAllowed = !rotationAllowed
        await focusOnJourney()
    }

    /**
     * Initiates rotation if allowed, or stops it, then focuses on the journey.
     * @param {Event} event - The click event
     */
    const maybeRotate = async (event) => {
        event.stopPropagation()
        if (rotate.running) {
            rotationAllowed = false
            stopRotate()
            if ($rotate.target.element && $rotate.target.element === lgs.theJourney.element) {
                return
            }
        }
        rotationAllowed = autoRotate.journey
        await focusOnJourney()
    }

    /**
     * Focuses the camera on the current journey, optionally resetting the camera and enabling rotation.
     */
    const focusOnJourney = async (event) => {
        if ($rotate.running) {
            await __.ui.cameraManager.stopRotate()
            if (rotate.target?.instanceOf(CURRENT_JOURNEY)) {
                return
            }
        }
        await setJourneyVisibility(true)
        lgs.theJourney.focus({
                                 resetCamera: true,
                                 action: REFRESH_DRAWING,
                                 rotate: rotationAllowed || autoRotate.journey,
                             })
    }

    /**
     * Closes the journey toolbar by hiding it.
     * @param {Event} event - The click event
     */
    const closeToolbar = (event) => {
        $journeyToolbar.show = false
    }
    const setToolbarOpacity = () => {
        _journeyToolbar.current.style.opacity = $journeyToolbar.opacity
    }
    useEffect(() => {
        const toolbar = _journeyToolbar.current
        if (!toolbar || !$journeyToolbar.show || journeyEditor.list.length === 0) {
            return
        }

        const positionToolbar = () => {
            const {width, height} = toolbar.getBoundingClientRect()
            if (width === 0 || height === 0) {
                // Retry if dimensions are not yet available
                requestAnimationFrame(positionToolbar)
                return
            }

            // Calculate position to center at 2/3 window height and 50% window width
            const x = (window.innerWidth - width) / 2 // Center horizontally
            const y = (window.innerHeight * 2 / 3) - (height / 2) // Center at 2/3 height

            // Set initial position only if not already set (to respect drag changes)
            if ($journeyToolbar.x === 0 && $journeyToolbar.y === 0) {
                $journeyToolbar.x = x
                $journeyToolbar.y = y
            }
        }
        // Force the right opacity
        setToolbarOpacity(toolbar)
        requestAnimationFrame(positionToolbar)
    }, [$journeyToolbar.show, journeyEditor.list.length]) // Dependencies to wait for toolbar visibility


    /**
     * Handles the start of a drag interaction, disabling SlSelect elements.
     * @param {Event} event - The dragstart event
     */

    const handleDragStart = (event) => {
        toolbarMoved.current = true
        _journeySelector.current.disabled = true
    }

    /**
     * Handles drag movement, updating toolbar position.
     * @param {Event} event - The drag event
     */
    const handleDrag = (event) => {
        $journeyToolbar.x = event.detail.value.x
        $journeyToolbar.y = event.detail.value.y // Fixed typo (was .x)
    }

    const handleDragStop = (event) => {
        toolbarMoved.current = false
        _journeySelector.current.disabled = false

    }


    useEffect(() => {
        const toolbar = _journeyToolbar.current
        const grabberElement = grabber.current

        // Do nothing if the toolbar is not rendered or references are null
        if (!toolbar || !grabberElement || journeyEditor.list.length === 0) {
            return
        }

        // Configure InteractionHandler for dragging
        const dragHandler = new DragHandler({
                                                grabber:   toolbar,
                                                parent:    toolbar,
                                                container: lgs.canvas,

                                            })

        toolbar.addEventListener(DragHandler.DRAG_START, handleDragStart)
        toolbar.addEventListener(DragHandler.DRAG, handleDrag)
        toolbar.addEventListener(DragHandler.DRAG_STOP, handleDragStop)

        // Attach dragging events
        dragHandler.attachEvents()

        if (!init) {
            window.addEventListener(APP_EVENT.WELCOME.HIDE, setToolbarOpacity)
            setInit(true)
        }
        else {
            setToolbarOpacity()
        }

        // Cleanup: detach events when the component unmounts or conditions change
        return () => {
            dragHandler.destroy()
            toolbar.removeEventListener(DragHandler.DRAG_START, handleDragStart)
            toolbar.removeEventListener(DragHandler.DRAG, handleDrag)
            toolbar.removeEventListener(DragHandler.DRAG_STOP, handleDragStop)
            //    window.removeEventListener("app/welcome/hide", setToolbarOpacity)
        }
    }, [
                  journeyToolbar.show,
                  $journeyToolbar.x, // we need to use proxy here...
                  $journeyToolbar.y, // ...
                  journeyToolbar.opacity,
                  journeyEditor.list.length, // Key dependency to re-trigger the effect when the list changes
              ])

    const textVisibilityJourney = sprintf('%s Journey', editorStore?.journey?.visible ? 'Hide' : 'Show')

    return (
        <>
            {journeyEditor.list.length > 0 && journeyToolbar.show &&
                <div
                    className="journey-toolbar lgs-card on-map"
                    ref={_journeyToolbar}
                    style={{
                        top:      `${$journeyToolbar.y}px`,
                        left:     `${$journeyToolbar.x}px`,
                        position: 'absolute',
                    }}
                >
                    <SlTooltip hoist content={'Drag me'}>
                        <SlIcon ref={grabber} className="grabber" library="fa" name={FA2SL.set(faGripDotsVertical)}/>
                    </SlTooltip>

                    <JourneySelector onChange={newJourneySelection}
                                     single="true" size="small" style="card" ref={_journeySelector}/>

                    <SlTooltip hoist content={'Add a journey'} placement="top">
                        <SlIconButton library="fa" onClick={journeyLoader} name={FA2SL.set(faSquarePlus)}/>
                    </SlTooltip>
                    <>
                        {editorStore.journey?.visible &&
                            <>
                                {!autoRotate.journey &&
                                    <SlTooltip
                                        hoist
                                        content={
                                            rotate.running && rotate.target.instanceOf(CURRENT_JOURNEY)
                                            ? 'Stop rotation'
                                            : 'Start rotation'
                                        }
                                        placement="top"
                                    >
                                        <SlButton
                                            size="small"
                                            ref={manualRotate}

                                            onClick={forceRotate}
                                            loading={rotate.running && rotate.target?.instanceOf(CURRENT_JOURNEY)}
                                        >
                                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCrosshairsSimple)}/>
                                        </SlButton>

                                    </SlTooltip>
                                }

                                <SlTooltip
                                    hoist
                                    content={
                                        rotate.running && rotate.target?.instanceOf(CURRENT_JOURNEY)
                                        ? 'Stop rotation'
                                        : 'Focus on journey'
                                    }
                                    placement="top"
                                >
                                    <SlButton
                                        size="small"
                                        onClick={maybeRotate}
                                        loading={rotate.running && rotate.target?.instanceOf(CURRENT_JOURNEY)}
                                    >
                                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCrosshairsSimple)}/>
                                    </SlButton>

                                </SlTooltip>
                            </>
                        }
                        <SlTooltip hoist content={textVisibilityJourney} placement="top">
                            <ToggleStateIcon
                                onChange={setJourneyVisibility}
                                initial={editorStore?.journey?.visible}
                            />
                        </SlTooltip>

                        <SlTooltip hoist content="Close" placement="top">
                            <FAButton id="close-journey-toolbar" onClick={closeToolbar} icon={faXmark}/>
                        </SlTooltip>
                    </>
                </div>
            }
        </>
    )
}