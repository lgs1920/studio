/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-25
 * Last modified: 2025-09-25
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
    faCrosshairsSimple, faSquarePlus, faXmark,
}                                                                               from '@fortawesome/pro-regular-svg-icons'
import { faGripDotsVertical }                                                   from '@fortawesome/pro-solid-svg-icons'
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
    const toolbars = useSnapshot(lgs.settings.ui.toolbars)


    const _journeyToolbar = useRef(null)
    const _journeySelector = useRef(null)

    const toolbarMoved = useRef(false)

    const $journeyEditor = lgs.mainProxy.components.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)

    const $rotate = lgs.stores.ui.mainUI.rotate
    const rotate = useSnapshot($rotate)

    const journeyLoaderStore = lgs.stores.ui.mainUI.journeyLoader
    const $editorStore = lgs.theJourneyEditorProxy
    const editorStore = useSnapshot($editorStore)

    const autoRotate = useSnapshot(lgs.settings.ui.camera.start.rotate)
    let rotationAllowed = false
    const manualRotate = useRef(null)

    const [isDragging, setIsDragging] = useState(false)

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

    useEffect(() => {
        if (props.ref) {
            props.ref.current = {

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
                handleDragEnd: event => {
                    if (_journeySelector.current && isDragging) {
                        _journeySelector.current.show()
                    }
                    setIsDragging(false)
                },
            }
        }
    }, [props.ref])

    const textVisibilityJourney = sprintf('%s Journey', editorStore?.journey?.visible ? 'Hide' : 'Show')

    return (
        <>
            {journeyEditor.list.length > 0 && journeyToolbar.show &&
                <div className="journey-toolbar lgs-card on-map"
                     ref={_journeyToolbar}>
                        <SlTooltip hoist content={'Drag me'}>
                            <SlIcon className="grabber" library="fa"
                                    name={FA2SL.set(faGripDotsVertical)}/>
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
                                                <SlIcon slot="prefix" library="fa"
                                                        name={FA2SL.set(faCrosshairsSimple)}/>
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
                                <FAButton className="close-lgs-toolbar" onClick={closeToolbar} icon={faXmark}/>
                            </SlTooltip>
                        </>
                    </div>
            }
        </>
    )
}