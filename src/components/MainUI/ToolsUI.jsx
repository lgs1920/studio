/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToolsUI.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-08-19
 * Last modified: 2026-09-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CameraAndTargetPanel }     from '@Components/cesium/CameraAndTargetPanel/CameraAndTargetPanel'
import { VideoRecordingSettingsWidget } from '@Components/MainUI/video/toolbox/VideoRecordingSettingsWidget'
import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { VideoSettingsInfo }    from '@Components/MainUI/video/VideoSettingsInfo'
import { SceneWidgetsRenderer } from '@Components/MainUI/widgets/SceneWidgetsRenderer'
import { DockedWidgetDrawer } from '@Components/MainUI/widgets/DockedWidgetDrawer'
import { DetachedWidgetPortal } from '@Components/MainUI/widgets/DetachedWidgetPortal'
import { WidgetContextMenu }    from '@Components/MainUI/widgets/WidgetContextMenu'
import { Cropper }           from '@Components/ToolsUI/cropper/Cropper'
import { VideoRecordingScreenArea } from '@Components/MainUI/video/VideoRecordingScreenArea'
import {
    JOURNEY_TOOLBAR_WIDGET, JOURNEY_WIDGETS, REPLAY_TIMELINE_WIDGET, SCENE_WIDGETS_BOARD,
} from '@Core/constants'
import {hydrateDockedWidget} from '@Core/ui/widget-manager/WidgetDockManager'
import { JourneyToolbarWidget }     from '@Editor/JourneyToolbarWidget'
import { useEffect, useRef }        from 'react'
import { useSnapshot }              from 'valtio/index'

export const ToolsUI = () => {
    const {usage} = useSnapshot(lgs.settings.ui.journeyToolbar)
    const {video} = useSnapshot(lgs.stores.ui)
    const replay = useSnapshot(lgs.stores.replay)
    const widget = useSnapshot(lgs.stores.ui.widget)
    const $cropper = lgs.stores.ui.video.cropper
    const _journeyToolbarHiddenByVideoEditor = useRef(false)
    const _replayPreparationActive = useRef(false)

    const renderLinkedTimeline = video.editing === true
        && video.timelinePreviewActive === true
        && replay.recordingSync === true
        && widget.docked?.id?.split('#')[0] !== REPLAY_TIMELINE_WIDGET

    useEffect(() => {
        const linkedReplay = replay.recordingSync === true
            || replay.simplePreparationActive === true
            || lgs.settings?.ui?.replay?.recordingSync === true
        const videoEditing = video.editing === true
        const replayPlaying = replay.active || replay.playing || replay.paused

        if (linkedReplay && videoEditing && !_journeyToolbarHiddenByVideoEditor.current
            && !__.ui.replay?.isJourneyToolbarTemporarilyHidden?.()) {
            __.ui.replay?.hideJourneyToolbarVisibility?.()
            _journeyToolbarHiddenByVideoEditor.current = true
            return
        }

        if ((!linkedReplay || !videoEditing) && _journeyToolbarHiddenByVideoEditor.current && !replayPlaying) {
            __.ui.replay?.restoreJourneyToolbarVisibility?.()
            _journeyToolbarHiddenByVideoEditor.current = false
        }
    }, [replay.active, replay.paused, replay.playing, replay.recordingSync, video.editing])

    useEffect(() => {
        if (renderLinkedTimeline) {
            hydrateDockedWidget()
        }
    }, [renderLinkedTimeline])

    useEffect(() => {
        const captureActive = video.preRecording || video.recordingHQ || video.snapshot || video.finalizing
        const replayLinked = replay.recordingSync === true || replay.simplePreparationActive === true
        const preparationActive = video.editing && replayLinked && !captureActive
        if (!preparationActive) {
            _replayPreparationActive.current = false
            return undefined
        }

        if (_replayPreparationActive.current) {
            return undefined
        }

        _replayPreparationActive.current = true
        let transitionActive = true
        void Promise.resolve(__.ui.replay?.enterReplayPreparation?.({
            journey:    lgs.theJourney,
            shouldApply: () => transitionActive
                           && lgs.stores.ui.video.editing === true
                           && (lgs.stores.replay.recordingSync === true
                               || lgs.stores.replay.simplePreparationActive === true),
        })).catch(() => undefined)

        return () => {
            transitionActive = false
        }
    }, [replay.recordingSync, replay.simplePreparationActive, video.editing, video.finalizing, video.preRecording, video.recordingHQ, video.snapshot])

    useEffect(() => {
        const appContainer = document.getElementById('lgs1920-container')
        if (!appContainer) {
            return undefined
        }

        const cropInputMode = video.editing
            || video.preRecording
            || video.recordingHQ
            || video.snapshot
            || video.finalizing
        appContainer.classList.toggle('lgs-video-crop-input-mode', cropInputMode)

        return () => appContainer.classList.remove('lgs-video-crop-input-mode')
    }, [video.editing, video.preRecording, video.recordingHQ, video.snapshot, video.finalizing])

    return (
        <div id="lgs-tools-ui">
            {video.editing ? (
                <>
                    <Cropper overlay source={lgs.canvas}
                             context={$cropper} className="video-cropper"
                             hideVideoWidgets={false}
                             hideWidgetPanel={replay.simplePreparationActive === true}
                             simplePreparationActive={replay.simplePreparationActive === true}
                             renderRatioWidget={false}
                             options={{infoComponent: <VideoSettingsInfo/>}}/>
                    {!(video.timelinePreviewActive === true && replay.recordingSync === true) && (
                        <VideoRecordingSettingsWidget id="video-recording-settings-widget"/>
                    )}
                    {renderLinkedTimeline && (
                        <DynamicWidget
                            id="replay-timeline-widget"
                            props={{
                                group:        JOURNEY_WIDGETS,
                                widgetsBoard: SCENE_WIDGETS_BOARD,
                            }}
                        />
                    )}
                    <WidgetContextMenu/>
                </>
            ) : (

                <>
                    {(video.preRecording || video.recordingHQ || video.snapshot || video.finalizing) &&
                        <VideoRecordingScreenArea/>}
                    <CameraAndTargetPanel/>
                    {usage && <JourneyToolbarWidget id={JOURNEY_TOOLBAR_WIDGET}/>}
                 </>
             )}

            <SceneWidgetsRenderer/>
            <DockedWidgetDrawer/>
            <DetachedWidgetPortal/>
        </div>
    )
}
