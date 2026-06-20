/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-17
 * Last modified: 2026-06-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * VideoRecordingSettingsToolbar.jsx
 *
 * Renders a call-to-action bar for the video cropper interface.
 ******************************************************************************/
import { Tunnel } from '@Components/Tunnel/Tunnel'
import { FlythroughButton } from '@Components/Flythrough/FlythroughButton'
import { VIDEO_CROP_ZONE, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { cancelVideoEditing } from '@Components/MainUI/video/videoEditingCleanup'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot } from 'valtio'
import '../style.css'

const resolveRecorderToolbarPosition = (event) => {
    const nativeEvent = event?.nativeEvent ?? event
    const touch = nativeEvent?.changedTouches?.[0] ?? nativeEvent?.touches?.[0]
    const rect = event?.currentTarget?.getBoundingClientRect?.()
    const rawLeft = touch?.clientX ?? nativeEvent?.clientX
    const rawTop = touch?.clientY ?? nativeEvent?.clientY
    const left = Number.isFinite(rawLeft) ? rawLeft : ((rect?.left ?? 0) + ((rect?.width ?? window.innerWidth) / 2))
    const top = Number.isFinite(rawTop) ? rawTop : ((rect?.top ?? 0) + ((rect?.height ?? window.innerHeight) / 2))

    return {
        left,
        top,
        attachTo: top < window.innerHeight / 2 ? 'top' : 'bottom',
    }
}

/**
 * VideoRecordingSettingsToolbar renders a call-to-action bar for the video cropper interface.
 * @component
 */
export const VideoRecordingSettingsToolbar = memo(() => {
    const $video = lgs.stores.ui.video
    const flythrough = useSnapshot(lgs.stores.flythrough)
    const video = useSnapshot($video)
    const videoCropConfig = __.ui.widgetManager.getWidgetConfig?.(VIDEO_CROP_ZONE)
    const hasDefinedCropDimensions = Number.isFinite(videoCropConfig?.cropDimensions?.width) &&
        Number.isFinite(videoCropConfig?.cropDimensions?.height) &&
        videoCropConfig.cropDimensions.width > 0 &&
        videoCropConfig.cropDimensions.height > 0

    const _steps = useRef([])

    // --- Handlers ---

    const syncCropFrame = useCallback((phase = 'sync') => {
        void __.ui.widgetManager.syncCropDimensionsFromElement(VIDEO_CROP_ZONE, true, phase)
    }, [])

    /** Cancels the video editing process and restores widgets immediately. */
    const handleCancel = useCallback(() => {
        cancelVideoEditing()
    }, [])

    const leadingAction = flythrough.recordingSync === true && Boolean(lgs.theJourney) ? (
        <FlythroughButton
            id="launch-the-flythrough-editor-from-video"
            tooltip="top"
            tooltipText="Open Flythrough drawer"
            tooltipPlacement="top"
            tooltipStyle="tunnel"
            variant="neutral"
            appearance="plain"
            className=""
            showOnlyWhenLinked
            ariaLabel="Open Flythrough drawer"
        />
    ) : null

    const handleSnapShot = useCallback(async () => {
        Object.assign($video, {
            snapshot:     true,
            preRecording: false,
            recording:    false,
        })
        // Restoration logic should be triggered by the store observer or a dedicated event
        // after the actual file is saved/processed.
    }, [$video])

    const handleVideoRecording = useCallback(async (event) => {
        if (!__.recorder) {
            console.warn('[VideoRecordingSettingsToolbar] Recorder not initialized')
            return
        }

        const toolbarPosition = resolveRecorderToolbarPosition(event)
        Object.assign($video, {
            preRecording: true,
            recording:    false,
            paused:       false,
            position: toolbarPosition,
            toolbarPosition,
        })
    }, [$video])

    /**
     * Side effect to hide background widgets when the toolbar appears.
     */
    useEffect(() => {
        __.ui.widgetCache.hideAllExceptBoards(VIDEO_WIDGETS_BOARD)
        // Note: Widgets will be restored by VideoRecorderToolbar when recording stops,
        // or by handleCancel when user cancels editing
    }, [])

    useEffect(() => {
        if (!video.editing || flythrough.recordingSync !== true) {
            return undefined
        }

        let cancelled = false
        let raf = 0

        const centerCropZone = () => {
            if (cancelled) {
                return
            }

            const element = __.ui.widgetManager.getElementById(VIDEO_CROP_ZONE)
            if (!element) {
                raf = requestAnimationFrame(centerCropZone)
                return
            }

            __.ui.widgetManager.toCenter(element, 0)
            syncCropFrame('flythrough-sync-center')
        }

        raf = requestAnimationFrame(centerCropZone)

        return () => {
            cancelled = true
            cancelAnimationFrame(raf)
        }
    }, [flythrough.recordingSync, syncCropFrame, video.editing])

    // --- Tunnel Steps ---
    const steps = useMemo(() => {
        _steps.current = [
            {
                icon: 'camera-viewfinder',
                text:       'Video parameters',
                tooltip: {
                    title: 'Video parameters',
                    text:  'Choose the video format and presets before composing the capture.',
                },
                done: hasDefinedCropDimensions,
                mandatory:  false,
                beforeStep: () => {
                    $video.step = 0
                    Object.assign($video.cropper, {
                        ratioEditor:   true,
                        presetEditor: true,
                        widgetEditor:  false,
                    })
                    __.ui.widgetManager.windowResizing = true
                    return true
                },
                afterStep:  () => {
                    syncCropFrame('ratio-editor-exit')
                    Object.assign($video.cropper, {
                        ratioEditor:   false,
                        presetEditor: false,
                    })
                    _steps.current[0].done = true
                    return true
                },
            },
            {
                icon: 'photo-film',
                text:       'Add widgets',
                tooltip: {
                    title: 'Add widgets',
                    text:  'Place, resize, and arrange the widgets that will appear in the video.',
                },
                done:       hasDefinedCropDimensions,
                mandatory:  true,
                beforeStep: () => {
                    $video.step = 1
                    Object.assign($video.cropper, {
                        ratioEditor:  false,
                        presetEditor: false,
                        widgetEditor: true,
                    })
                    __.ui.widgetManager.windowResizing = false
                    _steps.current[1].done = true
                    _steps.current[2].done = true
                    _steps.current[3].done = true
                    return true
                },
                afterStep:  () => {
                    $video.cropper.widgetEditor = false
                    __.ui.drawerManager.close()
                    return true
                },
            },
            {
                icon: 'clapperboard-play',
                text:       'Start Recording',
                tooltip: {
                    title: 'Start recording',
                    text: 'Record the selected zone.',
                },
                done:       false,
                mandatory:  false,
                beforeStep: () => {
                    $video.step = 2
                    Object.assign($video.cropper, {
                        ratioEditor:  false,
                        presetEditor: false,
                        widgetEditor: false,
                    })
                    __.ui.widgetManager.windowResizing = false
                    return true
                },
                onClick: async (_index, event) => {
                    syncCropFrame('before-recording')
                    await handleVideoRecording(event)
                    Object.assign($video, {
                        editing:    false,
                        finalizing: false,
                    })
                    return true
                },
            },
            {
                icon: 'camera',
                text:       'Snapshot',
                tooltip: {
                    title: 'Snapshot',
                    text:  'Export one image from the current zone.',
                },
                done: false,
                mandatory:  false,
                beforeStep: () => {
                    $video.step = 3
                    Object.assign($video.cropper, {
                        ratioEditor:  false,
                        presetEditor: false,
                        widgetEditor: false,
                    })
                    __.ui.widgetManager.windowResizing = false
                    return true
                },
                onClick: async () => {
                    syncCropFrame('before-snapshot')
                    Object.assign($video, {
                        recording:  false,
                        editing:    false,
                        finalizing: false,
                    })
                    _steps.current[3].done = true
                    await handleSnapShot()
                    return true
                },
            },
        ]
        return _steps.current
    }, [$video, handleVideoRecording, handleSnapShot, hasDefinedCropDimensions, syncCropFrame])

    if (!video.editing) {
        return null
    }

    return (
        <div className="video-recording-settings-toolbar lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map">
            <Tunnel
                leadingAction={leadingAction}
                steps={steps}
                defaultStepIndex={hasDefinedCropDimensions ? 2 : 0}
                cancelTooltip={{
                    title: 'Cancel',
                    text:  'Leave video setup.',
                }}
                onCancel={handleCancel}
            />
        </div>
    )
})
