import { FAButton }                                            from '@Components/FAButton'
import { ToggleStateIcon }                                                              from '@Components/ToggleStateIcon'
import { APP_EVENT, CURRENT_JOURNEY, REFRESH_DRAWING, SECOND, UPDATE_JOURNEY_SILENTLY } from '@Core/constants'
import { DragHandler }                                                                  from '@Core/ui/DragHandler'
import { JourneySelector }                                     from '@Editor/journey/JourneySelector'
import { Utils }                                               from '@Editor/Utils'
import {
    faArrowRotateRight,
    faCrosshairsSimple,
    faGripDotsVertical,
    faSquarePlus,
    faXmark,
}                                                              from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlIconButton, SlTooltip }                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                               from '@Utils/FA2SL'
import classNames                                              from 'classnames'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sprintf }                                             from 'sprintf-js'
import { useSnapshot }                                         from 'valtio'

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

    const $journeyEditor = lgs.mainProxy.components.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)

    const $rotate = lgs.mainProxy.components.mainUI.rotate
    const rotate = useSnapshot($rotate)

    const animationFrame = useRef(null)
    const journeyLoaderStore = lgs.mainProxy.components.mainUI.journeyLoader
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
        if ($rotate.running) {
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


    useLayoutEffect(() => {
        const toolbar = _journeyToolbar.current
        const grabberElement = grabber.current
        const setToolbarOpacity = () => {
            toolbar.style.opacity = journeyToolbar.opacity
        }
        // Do nothing if the toolbar is not rendered or references are null
        if (!toolbar || !grabberElement || journeyEditor.list.length === 0) {
            return
        }

        // Configure InteractionHandler for dragging
        const dragHandler = new DragHandler({
                                                grabber:  grabberElement,
                                                parent:   toolbar,
                                                callback: (toolbarData) => {
                                                    $journeyToolbar.x = toolbarData.x
                                                    $journeyToolbar.y = toolbarData.y
                                                },
                                            })

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
            //    window.removeEventListener("app/welcome/hide", setToolbarOpacity)
        }
    }, [
                        $journeyToolbar.x,
                        $journeyToolbar.y,
                        journeyToolbar.opacity,
                        journeyEditor.list.length, // Key dependency to re-trigger the effect when the list changes
                    ])

    const textVisibilityJourney = sprintf('%s Journey', editorStore?.journey?.visible ? 'Hide' : 'Show')

    return (
        <>
            {journeyEditor.list.length > 0 &&
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

                    <JourneySelector onChange={newJourneySelection} single="true" size="small" style="card"/>

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
                                        <FAButton
                                            onClick={forceRotate}
                                            ref={manualRotate}
                                            icon={faArrowRotateRight}
                                            className={classNames({
                                                                      'fa-spin': rotate.running && rotate.target?.instanceOf(CURRENT_JOURNEY),
                                                                  })}
                                        />
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
                                    <FAButton
                                        onClick={maybeRotate}
                                        icon={
                                            rotate.running &&
                                            autoRotate.journey &&
                                            rotate.target?.instanceOf(CURRENT_JOURNEY)
                                            ? faArrowRotateRight
                                            : faCrosshairsSimple
                                        }
                                        className={classNames({
                                                                  'fa-spin':
                                                                      rotate.running &&
                                                                      autoRotate.journey &&
                                                                      rotate.target?.instanceOf(CURRENT_JOURNEY),
                                                              })}
                                    />
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