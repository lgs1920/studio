/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoCropperToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-24
 * Last modified: 2025-07-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VideoRecordButton }                           from '@Components/MainUI/video/VideoRecordButton'
import { VideoRecorderToolbar }                        from '@Components/MainUI/video/VideoRecorderToolbar'
import { DragHandler }                                 from '@Core/ui/drag-handler/DragHandler'
import { faCropSimple, faPhotoFilm, faVideo, faXmark } from '@fortawesome/pro-regular-svg-icons'
import { faGripDotsVertical }                          from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlIconButton, SlTooltip }             from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                       from '@Utils/FA2SL'
import { memo, useEffect, useRef }                     from 'react'
import { useSnapshot }                                 from 'valtio'

/**
 * Video editing steps
 * @type {Object.<string, number>}
 * @constant
 */
const VIDEO_STEP = {
    CROP:   1, // Crop phase: define video dimensions
    BLOCKS: 2, // Blocks phase: add blocks to video
    VIDEO:  3,  // Video phase: record the video
}

/**
 * VideoCropperCTA renders a call-to-action bar for the video cropper interface
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.manager - CropperManager instance for controlling crop state
 * @param {Object} props.manager.store - Valtio store with crop state (x, y, width, height, ratioEditor, etc.)
 */
const VideoCropperToolbar = memo(({manager}) => {
    // Access reactive video state from Valtio store
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const _cta = useRef(null)
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})

    /**
     * Handles canceling the video editing process
     * @function
     */
    const handleCancel = () => {
        $video.edit = false
    }

    /**
     * Advances to the next step in the video editing process
     * Updates the store's ratioEditor and ensures step doesn't exceed VIDEO phase
     * @function
     */
    const handleNext = () => {
        if (manager?.store) {
            manager.store.ratioEditor = false
        }
        $video.step = Math.min($video.step + 1, VIDEO_STEP.VIDEO)
    }

    /**
     * Returns to the previous step in the video editing process
     * Ensures step doesn't go below CROP phase and updates ratioEditor
     * @function
     */
    const handlePrev = () => {
        if (manager?.store) {
            manager.store.ratioEditor = true
        }
        $video.step = Math.max($video.step - 1, VIDEO_STEP.CROP)
    }

    // Initialize drag handler
    useEffect(() => {
        if (_cta.current) {
            _cta.current.style.opacity = toolbars.opacity || 1
            const dragHandler = new DragHandler({
                                                    grabber:   _cta.current,
                                                    parent:    _cta.current,
                                                    container: lgs.canvas,
                                                })
        }
    }, [])
    useEffect(() => {
        if (_cta.current) {
            _cta.current.style.opacity = toolbars.opacity || 1
        }
    }, [toolbars.opacity])


    // Render the CTA bar with conditional buttons based on the current step
    return (
        <> {video.edit && <> {
            video.step !== VIDEO_STEP.VIDEO ? (
                <div className="video-cropper-toolbar lgs-toolbar lgs-toolbar-horizontal lgs-card on-map"
                     ref={_cta}>
                    <div className="video-cropper-toolbar-actions">
                        <SlTooltip content="Drag me">
                            <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDotsVertical)}/>
                        </SlTooltip>

                        {/* Previous button: shown after CROP phase to return to crop settings */}
                        {video.step > VIDEO_STEP.CROP && (
                            <SlTooltip content="Return to Video Size Definition">
                                <SlIconButton onClick={handlePrev} library="fa" name={FA2SL.set(faCropSimple)}/>
                            </SlTooltip>
                        )}

                        {/* Next button: advances to next step or starts recording */}
                        <SlTooltip content={video.step === VIDEO_STEP.CROP ? 'Finalize Video' : 'Record Video'}>
                            <SlIconButton onClick={handleNext} library="fa"
                                          name={FA2SL.set(video.step === VIDEO_STEP.CROP ? faPhotoFilm : faVideo)}/>
                        </SlTooltip>

                        <SlTooltip content="Cancel Video Editing">
                            <SlIconButton className="close-lgs-toolbar" library="fa" name={FA2SL.set(faXmark)}
                                          onClick={handleCancel}/>
                        </SlTooltip>
                    </div>

                </div>
            ) : (
                // Video recording button: shown in VIDEO phase
                <div className="video-recorder-wrapper-toolbar">
                    <VideoRecordButton/><VideoRecorderToolbar/>
                </div>
            )
        }</>}
        </>
    )
})

export { VideoCropperToolbar }