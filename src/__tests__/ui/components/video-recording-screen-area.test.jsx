/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-screen-area.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy, useSnapshot} from 'valtio'
import {VideoRecordingScreenArea} from '@Components/MainUI/video/VideoRecordingScreenArea'
import {VideoDownloadAndShareDialog} from '@Components/MainUI/video/VideoDownloadAndShareDialog'
import {exportReplayDeferredMp4} from '@Core/ui/replay/ReplayDeferredExporter'
import {
    REPLAY_DEFERRED_EXPORT_CANCEL_EVENT,
    REPLAY_DEFERRED_EXPORT_READY_EVENT,
    stopReplayRecordingMonitor,
} from '@Core/ui/replay/ReplayRecordingMonitor'

vi.mock('@Components/MainUI/video/VideoSettingsInfo', () => ({VideoSettingsInfo: () => null}))
vi.mock('@Components/ToolsUI/cropper/CropOverlay', () => ({CropOverlay: () => null}))
vi.mock('@Components/ToolsUI/cropper/widgets/DefinedCropZone', () => ({DefinedCropZone: () => null}))
vi.mock('@Components/MainUI/video/WidgetMountErrorDialog', () => ({WidgetMountErrorDialog: () => null}))
vi.mock('@Components/MainUI/video/RecordingInfo', () => ({RecordingInfo: () => null}))
vi.mock('@Components/LGSPopup', () => ({LGSPopup: ({children}) => <>{children}</>}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaDialog: ({open, children}) => open ? <div data-testid="completed-video-dialog">{children}</div> : null,
    WaButton: ({children, onClick}) => <button type="button" onClick={onClick}>{children}</button>,
    WaIcon: () => null,
    WaInput: ({value}) => <input aria-label="Video file name" value={value} readOnly/>,
    WaTooltip: ({children}) => <>{children}</>,
}))
vi.mock('@Core/ui/replay/ReplayVideoOverlayComposer', () => ({
    buildReplayVideoComposerOverlays: vi.fn(),
    flushReplayVideoOverlayCanvases: vi.fn(),
    isReplayVideoWidgetReady: () => true,
}))
vi.mock('@Core/ui/replay/ReplayVideoWidgetPolicy', () => ({getReplayVideoWidgetKeys: () => []}))
vi.mock('@Core/ui/replay/ReplayVideoRenderSpec', () => ({
    buildReplayVideoRenderSpec: () => ({fps: 2, dimensions: {width: 320, height: 180}}),
}))
vi.mock('@Core/ui/replay/ReplayDeferredExporter', () => ({
    exportReplayDeferredMp4: vi.fn(),
    exportReplayDeferredDryRun: vi.fn(),
}))
vi.mock('@Core/ui/replay/ReplayRecordingMonitor', async importOriginal => ({
    ...(await importOriginal()),
    stopReplayRecordingMonitor: vi.fn(),
}))
vi.mock('@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer', () => ({CanvasOverlayComposer: vi.fn()}))
vi.mock('@Components/MainUI/video/videoEditingCleanup', () => ({
    prepareVideoCaptureUi: vi.fn(),
    restoreVideoCaptureUi: vi.fn(),
    cancelVideoEditing: vi.fn(),
    cancelVideoRecording: vi.fn(async ({invalidateRecording}) => invalidateRecording()),
}))
vi.mock('@Utils/UIToast', () => ({UIToast: {error: vi.fn()}}))

/** Create a manually settled export result without scheduling timers. */
const pendingExport = () => {
    let resolve
    const promise = new Promise(settle => { resolve = settle })
    return {promise, resolve}
}

/** Build the valid media result delivered by the deferred exporter. */
const videoResult = filename => ({
    blob: new Blob([filename], {type: 'video/mp4'}),
    filename,
    frameCount: 3,
    plan: {dimensions: {width: 320, height: 180}, outputDurationMillis: 1500},
})

/** Mirror the production ToolsUI capture mount condition while retaining the MainUI media dialog. */
const RecordingLifecycle = () => {
    const video = useSnapshot(lgs.stores.ui.video)
    return <>
        {(video.preRecording || video.exporting || video.snapshot || video.finalizing) && <VideoRecordingScreenArea/>}
        <VideoDownloadAndShareDialog/>
    </>
}

/** Install the persistent dialog environment around the real capture and media components. */
const installDialogEnvironment = restoration => {
    const capture = new EventTarget()
    Object.assign(capture, {
        filename: () => 'recording',
        isVideo: () => capture.type === 'video',
        releaseMedia: vi.fn(),
        mediaData: {},
    })
    __.mediaCapture = capture
    __.app = {canShare: () => true}
    __.ui.replay.restorePlaybackScene = vi.fn().mockReturnValueOnce(restoration.promise).mockResolvedValue(undefined)
    __.ui.contextMenu = {hide: vi.fn()}
    __.ui.drawerManager = {close: vi.fn()}
    lgs.gutter = {xs: 8}
    const NativeURL = globalThis.URL
    vi.stubGlobal('URL', class extends NativeURL {})
    URL.createObjectURL = vi.fn(() => 'blob:completed-recording')
    URL.revokeObjectURL = vi.fn()
    return capture
}

describe('Replay recording media handoff', () => {
    let readyListener

    beforeEach(() => {
        vi.clearAllMocks()
        const cropDimensions = {left: 0, top: 0, width: 320, height: 180}
        globalThis.lgs = {
            stores: {
                replay: proxy({recordingSync: true, deferredExportPlan: {runtime: {}}}),
                ui: {video: proxy({preRecording: true, snapshot: false, quality: 0, fps: 0})},
            },
            settings: {ui: {video: {}, replay: {}}},
            servers: {studio: {name: 'Studio'}},
            theJourney: {slug: 'recording-journey', title: 'Journey'},
        }
        globalThis.__ = {
            device: {},
            ui: {
                replay: {controller: {}},
                widgetManager: {
                    getWidgetConfig: () => ({cropDimensions}),
                    syncCropDimensionsFromElement: vi.fn(async () => undefined),
                    disposeByGroup: vi.fn(),
                },
            },
        }
        readyListener = vi.fn()
        window.addEventListener(REPLAY_DEFERRED_EXPORT_READY_EVENT, readyListener)
    })

    afterEach(() => {
        cleanup()
        window.removeEventListener(REPLAY_DEFERRED_EXPORT_READY_EVENT, readyListener)
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        delete globalThis.lgs
        delete globalThis.__
    })

    it('delivers a completed recording once', async () => {
        const recording = pendingExport()
        exportReplayDeferredMp4.mockReturnValueOnce(recording.promise)
        render(<VideoRecordingScreenArea/>)
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledOnce())
        await act(async () => recording.resolve(videoResult('completed.mp4')))

        expect(readyListener).toHaveBeenCalledOnce()
        expect(readyListener.mock.calls[0][0].detail.filename).toBe('completed.mp4')
        expect(readyListener.mock.calls[0][0].detail.mediaHandoffRevision).toBe(lgs.stores.ui.video.mediaHandoffRevision)
    })

    it('keeps the completed media dialog after the normal capture screen unmount', async () => {
        const recording = pendingExport()
        const restoration = pendingExport()
        exportReplayDeferredMp4.mockReturnValueOnce(recording.promise)
        const capture = installDialogEnvironment(restoration)
        const result = videoResult('completed.mp4')
        const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
        vi.stubGlobal('navigator', {share: vi.fn(async () => undefined)})
        const NativeFile = globalThis.File
        let sharedParts
        vi.stubGlobal('File', class extends NativeFile {
            /** Record the exact Blob supplied to the native sharing file. */
            constructor(parts, ...options) {
                super(parts, ...options)
                sharedParts = parts
            }
        })
        const {queryByTestId} = render(<RecordingLifecycle/>)
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledOnce())
        await act(async () => recording.resolve(result))

        expect(readyListener).toHaveBeenCalledOnce()
        expect(__.ui.replay.restorePlaybackScene).toHaveBeenCalledOnce()
        expect(__.ui.widgetManager.disposeByGroup).toHaveBeenCalled()
        expect(lgs.stores.ui.video.exporting).toBe(false)
        expect(readyListener.mock.calls[0][0].detail.mediaHandoffRevision).toBe(lgs.stores.ui.video.mediaHandoffRevision)
        expect(queryByTestId('completed-video-dialog')).toBeNull()
        await act(async () => restoration.resolve())

        expect(queryByTestId('completed-video-dialog')).not.toBeNull()
        expect(URL.revokeObjectURL).not.toHaveBeenCalled()
        expect(capture.releaseMedia).not.toHaveBeenCalled()
        expect(URL.createObjectURL).toHaveBeenCalledWith(result.blob)
        await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Download'})))
        expect(anchorClick).toHaveBeenCalledOnce()
        expect(anchorClick.mock.instances[0].href).toBe('blob:completed-recording')
        expect(anchorClick.mock.instances[0].download).toBe('completed.mp4')
        await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Share'})))
        expect(navigator.share).toHaveBeenCalledOnce()
        expect(sharedParts[0]).toBe(result.blob)
        expect(navigator.share.mock.calls[0][0].files[0].name).toBe('completed.mp4')
    })

    it('supersedes a pending delivered result when a new capture starts after remount', async () => {
        const previous = pendingExport()
        const current = pendingExport()
        const restoration = pendingExport()
        exportReplayDeferredMp4.mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise)
        installDialogEnvironment(restoration)
        const {queryByTestId} = render(<RecordingLifecycle/>)
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledOnce())
        await act(async () => previous.resolve(videoResult('previous.mp4')))
        const previousRevision = readyListener.mock.calls[0][0].detail.mediaHandoffRevision
        expect(__.ui.widgetManager.disposeByGroup).toHaveBeenCalled()
        await act(async () => { Object.assign(lgs.stores.ui.video, {editing: false, preRecording: true}) })
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledTimes(2))
        expect(lgs.stores.ui.video.mediaHandoffRevision).toBeGreaterThan(previousRevision)
        await act(async () => restoration.resolve())
        expect(queryByTestId('completed-video-dialog')).toBeNull()
        await act(async () => current.resolve(videoResult('current.mp4')))

        expect(queryByTestId('completed-video-dialog')).not.toBeNull()
        expect(screen.getByLabelText('Video file name').value).toBe('current')
    })

    it('invalidates delivered media on explicit cancellation while the scene restores', async () => {
        const recording = pendingExport()
        const restoration = pendingExport()
        exportReplayDeferredMp4.mockReturnValueOnce(recording.promise)
        const capture = installDialogEnvironment(restoration)
        const {cancelVideoRecording: cancelActualRecording} = await vi.importActual('@Components/MainUI/video/videoEditingCleanup')
        const {queryByTestId} = render(<RecordingLifecycle/>)
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledOnce())
        await act(async () => recording.resolve(videoResult('cancelled.mp4')))
        expect(__.ui.widgetManager.disposeByGroup).toHaveBeenCalled()
        await act(async () => cancelActualRecording())
        await act(async () => restoration.resolve())

        expect(queryByTestId('completed-video-dialog')).toBeNull()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:completed-recording')
        expect(capture.releaseMedia).toHaveBeenCalledOnce()
    })

    it('does not deliver an export resolved after cancellation', async () => {
        const recording = pendingExport()
        exportReplayDeferredMp4.mockReturnValueOnce(recording.promise)
        render(<VideoRecordingScreenArea/>)
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledOnce())
        await act(async () => window.dispatchEvent(new Event(REPLAY_DEFERRED_EXPORT_CANCEL_EVENT)))
        expect(exportReplayDeferredMp4.mock.calls[0][0].signal.aborted).toBe(true)
        await act(async () => recording.resolve(videoResult('cancelled.mp4')))

        expect(readyListener).not.toHaveBeenCalled()
    })

    it('keeps a newer result when an obsolete recording finishes later', async () => {
        const previous = pendingExport()
        const current = pendingExport()
        exportReplayDeferredMp4.mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise)
        render(<VideoRecordingScreenArea/>)
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledOnce())
        await act(async () => { lgs.stores.ui.video.preRecording = true })
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledTimes(2))
        expect(exportReplayDeferredMp4.mock.calls[0][0].signal.aborted).toBe(true)
        await act(async () => current.resolve(videoResult('current.mp4')))
        expect(readyListener).toHaveBeenCalledOnce()
        const monitorStops = stopReplayRecordingMonitor.mock.calls.length
        await act(async () => previous.resolve(videoResult('obsolete.mp4')))

        expect(readyListener).toHaveBeenCalledOnce()
        expect(readyListener.mock.calls[0][0].detail.filename).toBe('current.mp4')
        expect(stopReplayRecordingMonitor).toHaveBeenCalledTimes(monitorStops)
        expect(lgs.stores.ui.video.editing).toBe(true)
    })

    it('invalidates a recording when its screen is unmounted', async () => {
        const recording = pendingExport()
        exportReplayDeferredMp4.mockReturnValueOnce(recording.promise)
        const {unmount} = render(<VideoRecordingScreenArea/>)
        await waitFor(() => expect(exportReplayDeferredMp4).toHaveBeenCalledOnce())
        unmount()
        expect(exportReplayDeferredMp4.mock.calls[0][0].signal.aborted).toBe(true)
        await act(async () => recording.resolve(videoResult('unmounted.mp4')))

        expect(readyListener).not.toHaveBeenCalled()
    })
})
