import { FAButton }                                                  from '@Components/FAButton'
import { ToggleStateIcon }                                           from '@Components/ToggleStateIcon'
import { CURRENT_JOURNEY, REFRESH_DRAWING, UPDATE_JOURNEY_SILENTLY } from '@Core/constants'
import {
    JourneySelector,
}                                                                    from '@Editor/journey/JourneySelector'
import { Utils }                                                     from '@Editor/Utils'
import {
    faArrowRotateRight, faCrosshairsSimple, faGripDotsVertical, faSquarePlus,
}                                                                    from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon, SlIconButton, SlTooltip,
}                                                                    from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                     from '@Utils/FA2SL'
import classNames                                                    from 'classnames'
import React, { useRef }                                             from 'react'
import { sprintf }                                                   from 'sprintf-js'
import { useSnapshot }                                               from 'valtio'

export const JourneyToolbar = (props) => {
    const mainUI = lgs.mainProxy.components.mainUI
    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)
    const _journeyToolbar = useRef(null)

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
    
    const hideToolbar = (event) => {
        mainUI.journeyMenu.active = false
    }

    const journeyLoader = () => {
        journeyLoaderStore.visible = true
    }

    const newJourneySelection = async (event) => {
        await Utils.updateJourneyEditor(event.target.value, {})
    }

    const handleMouseDown = (event) => {
        const rect = _journeyToolbar.current.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top
        _journeyToolbar.current.classList.add('dragging')
        dragging = true
        document.body.classList.add('no-select')

        const handleMouseMove = (event) => {
            if (dragging) {
                if (animationFrame.current) {
                    cancelAnimationFrame(animationFrame.current)
                }
                animationFrame.current = requestAnimationFrame(() => {
                    $journeyToolbar.y = event.clientY - offsetY
                    $journeyToolbar.x = event.clientX - offsetX
                })
            }
        }

        const handleMouseUp = (event) => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)

            _journeyToolbar.current.classList.remove('dragging')
            document.body.classList.remove('no-select')

            dragging = false
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current)
                animationFrame.current = null
            }

        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }
    const stopRotate = async () => {
        if ($rotate.running) {
            await __.ui.cameraManager.stopRotate()
        }
    }
    const setJourneyVisibility = async visibility => {
        stopRotate()
        $editorStore.journey.visible = visibility
        lgs.theJourney.updateVisibility(visibility)
        await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        Utils.renderJourneySettings()
    }

    const forceRotate = async () => {
        rotationAllowed = !rotationAllowed
        await focusOnJourney()
    }

    const maybeRotate = async () => {
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
     * Focus on Journey
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
                                 action:      REFRESH_DRAWING,
                                 rotate:      rotationAllowed || autoRotate.journey,
                             })
    }

    const textVisibilityJourney = sprintf('%s Journey', editorStore?.journey?.visible ? 'Hide' : 'Show')
    return (
        <div className="journey-toolbar lgs-card on-map" ref={_journeyToolbar}
             style={{top: journeyToolbar.y, left: journeyToolbar.x}}>
            <SlTooltip hoist content={'Drag me'}>
                <SlIcon ref={grabber} className="grabber" library="fa" name={FA2SL.set(faGripDotsVertical)}
                        onPointerDown={handleMouseDown}
                />
            </SlTooltip>

            <JourneySelector onChange={newJourneySelection} single="true" size="small" style="card"/>

            <SlTooltip hoist content={'Add a journey'} placement="top">
                <SlIconButton library="fa" onClick={journeyLoader} name={FA2SL.set(faSquarePlus)}/>
            </SlTooltip>
            <>
                {editorStore.journey?.visible &&
                    <>
                        {!autoRotate.journey &&
                            <SlTooltip hoist
                                       content={rotate.running && rotate.target.instanceOf(CURRENT_JOURNEY) ? 'Stop rotation' : 'Start rotation'}
                                       placement="top">
                                <FAButton onClick={forceRotate}
                                          ref={manualRotate}
                                          icon={faArrowRotateRight}
                                          className={classNames({'fa-spin': rotate.running && rotate.target?.instanceOf(CURRENT_JOURNEY)})}/>
                            </SlTooltip>
                        }

                        <SlTooltip hoist
                                   content={rotate.running && rotate.target?.instanceOf(CURRENT_JOURNEY) ? 'Stop rotation' : 'Focus on journey'}
                                   placement="top">
                            <FAButton onClick={maybeRotate}
                                      icon={rotate.running && autoRotate.journey && (rotate.target?.instanceOf(CURRENT_JOURNEY)) ? faArrowRotateRight : faCrosshairsSimple}
                                      className={classNames({'fa-spin': rotate.running && autoRotate.journey && rotate.target?.instanceOf(CURRENT_JOURNEY)})}/>
                        </SlTooltip>
                    </>
                }

                <SlTooltip hoist content={textVisibilityJourney} placement="top">
                    <ToggleStateIcon onChange={setJourneyVisibility}
                                     initial={editorStore?.journey?.visible}/>
                </SlTooltip>
            </>
        </div>
    )
}