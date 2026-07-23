/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-21
 * Last modified: 2026-07-21
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
import { JourneyReplayButton } from '@Components/JourneyReplay/JourneyReplayButton'
import { VIDEO_CROP_ZONE, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { cancelVideoEditing, prepareVideoCaptureUi, prepareVideoEditingUi } from '@Components/MainUI/video/videoEditingCleanup'
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
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot($video)
    const shouldShowToolbar = video.editing === true
                              && !video.preRecording
                              && !video.recording
                              && !video.snapshot
                              && !video.finalizing
    const videoCropConfig = __.ui.widgetManager.getWidgetConfig?.(VIDEO_CROP_ZONE)
    const hasDefinedCropDimensions = Number.isFinite(videoCropConfig?.cropDimensions?.width) &&
        Number.isFinite(videoCropConfig?.cropDimensions?.height) &&
        videoCropConfig.cropDimensions.width > 0 &&
        videoCropConfig.cropDimensions.height > 0

    const _steps = useRef([])

    // --- Handlers ---

    const syncCropFrame = useCallback((phase = 'sync') => (
        __.ui.widgetManager.syncCropDimensionsFromElement(VIDEO_CROP_ZONE, true, phase)
    ), [])

    /** Persists the live crop before closing the video editor. */
    const handleCancel = useCallback(async () => {
        await syncCropFrame('editing-exit')
        cancelVideoEditing()
    }, [syncCropFrame])

    const leadingAction = replay.recordingSync === true && Boolean(lgs.theJourney) ? (
        <JourneyReplayButton
            id="launch-the-replay-editor-from-video"
            tooltip="top"
            tooltipText="Journey Replay Settings"
            tooltipPlacement="top"
            tooltipStyle="tunnel"
            variant="neutral"
            appearance="plain"
            className=""
            showOnlyWhenLinked
            ariaLabel="Journey Replay Settings"
        />
    ) : null

    const handleVideoRecording = useCallback(async (event) => {
        if (!__.recorder) {
            console.warn('[VideoRecordingSettingsToolbar] Recorder not initialized')
            return
        }

        prepareVideoCaptureUi()
        const toolbarPosition = resolveRecorderToolbarPosition(event)
        Object.assign($video, {
            editing:      false,
            preRecording: true,
            recording:    false,
            finalizing:   false,
            paused:       false,
            position: toolbarPosition,
            toolbarPosition,
        })
    }, [$video])

    /**
     * Side effect to hide background widgets when the toolbar appears.
     */
    useEffect(() => {
        if (!shouldShowToolbar) {
            return
        }

        prepareVideoEditingUi()
        // Note: Widgets are restored when the recording dialog/session is fully closed,
        // or by handleCancel when user cancels editing.
    }, [shouldShowToolbar])

    useEffect(() => {
        if (!shouldShowToolbar || replay.recordingSync !== true) {
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
            void syncCropFrame('replay-sync-center')
        }

        raf = requestAnimationFrame(centerCropZone)

        return () => {
            cancelled = true
            cancelAnimationFrame(raf)
        }
    }, [replay.recordingSync, shouldShowToolbar, syncCropFrame])

    // --- Tunnel Steps ---
    const steps = useMemo(() => {
        _steps.current = [
            {
                icon: 'paintbrush-pencil',
                text:       'Compose video',
                tooltip: {
                    title: 'Compose video',
                    text:  'Choose the format, resize the crop, and arrange the widgets.',
                },
                done: hasDefinedCropDimensions,
                // The crop zone is the initial view, but recording can be
                // launched immediately with the current crop.
                mandatory:  false,
                beforeStep: () => {
                    $video.step = 0
                    Object.assign($video.cropper, {
                        ratioEditor:   true,
                        presetEditor: true,
                        widgetEditor:  true,
                    })
                    __.ui.widgetManager.windowResizing = true
                    return true
                },
                afterStep:  () => {
                    void syncCropFrame('composition-exit')
                    Object.assign($video.cropper, {
                        ratioEditor:   false,
                        presetEditor: false,
                        widgetEditor:  false,
                    })
                    _steps.current[0].done = true
                    return true
                },
            },
            {
                icon: 'clapperboard-play',
                text:       'Record',
                variant:    'brand',
                appearance: 'plain',
                className:  'video-recorder-start-recording wa-theme-lgs1920',
                tooltip: {
                    title: 'Record',
                    text: 'Record the selected zone.',
                },
                done:       false,
                // Recording can start immediately with the current crop. The
                // composition step remains available as an optional editor.
                mandatory:  false,
                beforeStep: () => {
                    $video.step = 1
                    Object.assign($video.cropper, {
                        ratioEditor:  false,
                        presetEditor: false,
                        widgetEditor: false,
                    })
                    __.ui.widgetManager.windowResizing = false
                    return true
                },
                onClick: async (_index, event) => {
                    await syncCropFrame('before-recording')
                    await handleVideoRecording(event)
                    return true
                },
            },
        ]
        return _steps.current
    }, [$video, handleVideoRecording, hasDefinedCropDimensions, syncCropFrame])

    if (!shouldShowToolbar) {
        return null
    }

    return (
        <div className="video-recording-settings-toolbar lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal wa-theme-lgs1920-on-map">
            <Tunnel
                leadingAction={leadingAction}
                steps={steps}
                // Keep the crop zone visible initially; recording is available
                // immediately because the composition step is optional.
                defaultStepIndex={0}
                cancelTooltip={{
                    title: 'Cancel',
                    text:  'Leave video setup.',
                }}
                onCancel={handleCancel}
                cancelAppearance="plain"
            />
        </div>
    )
})
