/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoCropperCTA.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-22
 * Last modified: 2025-07-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VideoRecordButton }           from '@Components/MainUI/video/VideoRecordButton'
import { faCropSimple, faXmark }       from '@fortawesome/pro-regular-svg-icons'
import { faPhotoFilm }                 from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import { memo }                        from 'react'
import { useSnapshot }                 from 'valtio'

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
 * Button configurations for cancel, previous, and next actions
 * @type {Object.<string, {text: string, icon: string}>}
 * @constant
 */
const buttons = {
    cancel: {text: 'Cancel', icon: FA2SL.set(faXmark)},
    prev:   {text: 'Prev', icon: FA2SL.set(faCropSimple)},
    next:   {text: 'Next', icon: FA2SL.set(faPhotoFilm)},
}

/**
 * VideoCropperCTA renders a call-to-action bar for the video cropper interface
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.manager - CropperManager instance for controlling crop state
 * @param {Object} props.manager.store - Valtio store with crop state (x, y, width, height, ratioEditor, etc.)
 */
const VideoCropperCTA = memo(({manager}) => {
    // Access reactive video state from Valtio store
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

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

    // Render the CTA bar with conditional buttons based on the current step
    return (
        <div className="cropper-cta call-for-actions lgs-slide-in-from-bottom">
            <div className="buttons-bar">
                {video.step !== VIDEO_STEP.VIDEO ? (
                    <>
                        {/* Cancel button: exits editing mode */}
                        <SlTooltip content="Cancel Video Editing">
                            <SlButton onClick={handleCancel} outline>
                                <SlIcon slot="prefix" library="fa" name={buttons.cancel.icon}/>
                            </SlButton>
                        </SlTooltip>

                        {/* Previous button: shown after CROP phase to return to crop settings */}
                        {video.step > VIDEO_STEP.CROP && (
                            <SlTooltip content="Return to Video Size Definition">
                                <SlButton variant="primary" onClick={handlePrev}>
                                    <SlIcon slot="prefix" library="fa" name={buttons.prev.icon}/>
                                    {buttons.prev.text}
                                </SlButton>
                            </SlTooltip>
                        )}

                        {/* Next button: advances to next step or starts recording */}
                        <SlTooltip
                            content={video.step === VIDEO_STEP.CROP ? 'Finalize Video' : 'Record Video'}
                        >
                            <SlButton variant="primary" onClick={handleNext}>
                                <SlIcon slot="prefix" library="fa" name={buttons.next.icon}/>
                                {buttons.next.text}
                            </SlButton>
                        </SlTooltip>
                    </>
                ) : (
                     // Video recording button: shown in VIDEO phase
                     <VideoRecordButton/>
                 )}
            </div>
        </div>
    )
})

export { VideoCropperCTA }