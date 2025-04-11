import { FAButton }                                                          from '@Components/FAButton'
import {
    ToggleStateIcon,
}                                                                            from '@Components/ToggleStateIcon'
import { CURRENT_JOURNEY, REFRESH_DRAWING, SECOND, UPDATE_JOURNEY_SILENTLY } from '@Core/constants'
import {
    InteractionHandler,
}                                                                            from '@Core/ui/InteractionHandler'
import {
    JourneySelector,
}                                                                            from '@Editor/journey/JourneySelector'
import { Utils }                                                             from '@Editor/Utils'
import {
    faArrowRotateRight, faCrosshairsSimple, faGripDotsVertical, faSquarePlus, faXmark,
}                                                                            from '@fortawesome/pro-regular-svg-icons'
import {
    SlIcon, SlIconButton, SlTooltip,
}                                                                            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                             from '@Utils/FA2SL'
import classNames                                                            from 'classnames'
import React, { useLayoutEffect, useRef } from 'react'
import { sprintf }                                                           from 'sprintf-js'
import { useSnapshot }                                                       from 'valtio'

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

    const journeyLoader = () => {
        journeyLoaderStore.visible = true
    }

    const newJourneySelection = async (event) => {
        await Utils.updateJourneyEditor(event.target.value, {})
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

    const forceRotate = async (event) => {
        rotationAllowed = !rotationAllowed
        await focusOnJourney()
    }

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

    const forcePosition = () => {
        const w = window.innerWidth
        const h = window.innerHeight
        if (!_journeyToolbar.current) {
            return;
        }
        if (journeyEditor.list.length > 0) {
            if ($journeyToolbar.x > w || $journeyToolbar.x === null) {
                $journeyToolbar.x = w - 2 * _journeyToolbar.current.offsetWidth
            }
            if ($journeyToolbar.y > h || $journeyToolbar.y === null) {
                $journeyToolbar.y = 2 * h / 3 - 2 * _journeyToolbar.current.offsetHeight
            }
        }
        else {
            if ($journeyToolbar.x === null) {
                $journeyToolbar.x = w / 2
            }
            if ($journeyToolbar.y === null) {
                $journeyToolbar.y = 2 * h / 3
            }
        }
    }

    const closeToolbar = (event) => {
        $journeyToolbar.show = false
    }

    useLayoutEffect(() => {
        const toolbar = _journeyToolbar.current
        const grabberElement = grabber.current

        // Ne rien faire si la toolbar n'est pas rendue ou si les références sont null
        if (!toolbar || !grabberElement || journeyEditor.list.length === 0) {
            return
        }

        console.log('trace')

        // Initialiser la position au montage
        //forcePosition();
        toolbar.style.opacity = journeyToolbar.opacity

        // Configurer InteractionHandler pour le dragging
        const interactionHandler = new InteractionHandler({
                                                              grabber:  grabberElement,
                                                              parent:   toolbar,
                                                              callback: (toolbarData) => {
                                                                  $journeyToolbar.x = toolbarData.x
                                                                  $journeyToolbar.y = toolbarData.y
                                                              },
                                                          })

        // Attacher les événements de dragging
        interactionHandler.attachEvents()

        // Nettoyage : détacher les événements lorsque le composant est démonté ou la condition change
        return () => {
            interactionHandler.destroy()
        };
    }, [
                        $journeyToolbar.x,
                        $journeyToolbar.y,
                        journeyToolbar.opacity,
                        journeyEditor.list.length, // Dépendance clé pour re-déclencher l'effet quand la liste change
                    ]);



    const textVisibilityJourney = sprintf('%s Journey', editorStore?.journey?.visible ? 'Hide' : 'Show')
    return (
        <>
            {journeyEditor.list.length > 0 &&
                <div className="journey-toolbar lgs-card on-map"
                     ref={_journeyToolbar}
                     style={{
                         top:      `${$journeyToolbar.y}px`,
                         left:     `${$journeyToolbar.x}px`,
                         opacity:  $journeyToolbar.opacity,
                         position: 'absolute',
                     }}>
                    <SlTooltip hoist content={'Drag me'}>
                        <SlIcon ref={grabber} className="grabber" library="fa" name={FA2SL.set(faGripDotsVertical)}/>
                    </SlTooltip>

                    <JourneySelector onChange={newJourneySelection}
                                     single="true" size="small" style="card"/>

                    <SlTooltip hoist content={'Add a journey'} placement="top">
                        <SlIconButton
                            library="fa" onClick={journeyLoader} name={FA2SL.set(faSquarePlus)}/>
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

                        <SlTooltip hoist content="Close" placement="top">
                            <FAButton id="close-journey-toolbar" onClick={closeToolbar} icon={faXmark}/>
                        </SlTooltip>
                    </>
                </div>
            }

        </>
    )
}