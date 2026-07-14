/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-download-and-share-dialog.test.jsx
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

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'

vi.mock('@Components/MainUI/video/RecordingInfo', () => ({
    RecordingInfo: () => <div data-testid="recording-info"/>,
}))

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({children}) => <>{children}</>,
}))

vi.mock('@Components/MainUI/video/videoEditingCleanup', () => ({
    cancelVideoEditing: vi.fn(),
}))

vi.mock('@Core/ui/replay/ReplayDeferredExporter', () => ({
    exportReplayDeferredMp4: vi.fn(async () => ({
        blob: new Blob(['hq-video'], {type: 'video/mp4'}),
        mimeType: 'video/mp4',
        extension: 'mp4',
        filename: 'recording-master.mp4',
        plan: {label: 'recording-master'},
    })),
}))

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error:   vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaDialog: ({children, open, onWaHide, ...props}) => {
        if (!open) {
            return null
        }

        const dialogElement = {id: 'video-preview-dialog'}
        const nestedElement = {id: 'nested-webawesome-element'}
        return (
            <div data-testid="video-preview-dialog" {...props}>
                <button
                    type="button"
                    aria-label="Native dialog close"
                    onClick={() => onWaHide?.({
                        target:        dialogElement,
                        currentTarget: dialogElement,
                        detail:        {source: 'close-button'},
                    })}
                />
                <button
                    type="button"
                    aria-label="Escape dialog close"
                    onClick={() => onWaHide?.({
                        target:        dialogElement,
                        currentTarget: dialogElement,
                        detail:        {source: 'keyboard'},
                    })}
                />
                <button
                    type="button"
                    aria-label="Nested component hide"
                    onClick={() => onWaHide?.({
                        target:        nestedElement,
                        currentTarget: dialogElement,
                        detail:        {source: nestedElement},
                    })}
                />
                {children}
            </div>
        )
    },
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaInput: ({children, value = '', onInput}) => (
        <label>
            {children}
            <input aria-label="File name input" value={value} onInput={onInput} readOnly/>
        </label>
    ),
    WaTooltip: ({children}) => <>{children}</>,
}))

import { cancelVideoEditing } from '@Components/MainUI/video/videoEditingCleanup'
import { exportReplayDeferredMp4 } from '@Core/ui/replay/ReplayDeferredExporter'
import { VideoDownloadAndShareDialog } from '@Components/MainUI/video/VideoDownloadAndShareDialog'

class FakeRecorder extends EventTarget {
    constructor() {
        super()
        this.mediaData = {
            extension: 'mp4',
            mimeType:  'video/mp4',
            size:      12,
            duration:  1000,
            dimensions: {
                width:  640,
                height: 360,
            },
            quality: {name: 'HD'},
            ratio:   {label: '16:9'},
        }
        this.filename = vi.fn(() => 'recording')
        this.isVideo = vi.fn(() => true)
        this.releaseMedia = vi.fn(async () => undefined)
        this.download = vi.fn(async () => undefined)
    }
}

describe('VideoDownloadAndShareDialog', () => {
    let recorder

    beforeEach(() => {
        vi.clearAllMocks()
        recorder = new FakeRecorder()
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:recording')
        globalThis.URL.revokeObjectURL = vi.fn()
        globalThis.navigator.share = vi.fn(async () => undefined)

        globalThis.__ = {
            recorder,
            ui: {
                replay: {
                    restorePlaybackScene: vi.fn(),
                },
            },
            app: {
                canShare: vi.fn(() => true),
            },
        }
        globalThis.lgs = {
            gutter: {
                xs: 8,
            },
            settings: {
                ui: {
                    video: {
                        format: 'mp4',
                        image:  'png',
                    },
                },
            },
            stores: {
                ui: {
                    video: {
                        preRecording: false,
                        recording:    false,
                        paused:       false,
                        finalizing:   true,
                    },
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    const openDialog = () => {
        render(<VideoDownloadAndShareDialog/>)
        act(() => {
            recorder.dispatchEvent(new CustomEvent(ScreenMediaRecorder.events.STOP, {
                detail: {
                    blob: new Blob(['video'], {type: 'video/mp4'}),
                },
            }))
        })
        expect(screen.queryByTestId('video-preview-dialog')).not.toBeNull()
    }

    const expectDialogCleanup = () => {
        expect(globalThis.__.ui.replay.restorePlaybackScene).toHaveBeenCalledTimes(1)
        expect(cancelVideoEditing).toHaveBeenCalledTimes(1)
        expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording')
        expect(recorder.releaseMedia).toHaveBeenCalledTimes(1)
        expect(globalThis.lgs.stores.ui.video.finalizing).toBe(false)
        expect(screen.queryByTestId('video-preview-dialog')).toBeNull()
    }

    it('uses the same cleanup for the footer close button', () => {
        openDialog()

        fireEvent.click(screen.getByRole('button', {name: 'Close'}))

        expectDialogCleanup()
    })

    it('uses the same cleanup for the native dialog close button', () => {
        openDialog()

        fireEvent.click(screen.getByRole('button', {name: 'Native dialog close'}))

        expectDialogCleanup()
    })

    it('uses the same cleanup for an Escape dialog close', () => {
        openDialog()

        fireEvent.click(screen.getByRole('button', {name: 'Escape dialog close'}))

        expectDialogCleanup()
    })

    it('ignores hide events bubbling from nested Web Awesome components', () => {
        openDialog()

        fireEvent.click(screen.getByRole('button', {name: 'Nested component hide'}))

        expect(cancelVideoEditing).not.toHaveBeenCalled()
        expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled()
        expect(recorder.releaseMedia).not.toHaveBeenCalled()
        expect(screen.queryByTestId('video-preview-dialog')).not.toBeNull()
    })

    it('exports the replay master mp4 before sharing the final video', async () => {
        globalThis.lgs.stores.replay = {
            deferredExportPlan: {runtime: {contextKey: 'ctx-1'}},
        }

        openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Share'}))
        })

        expect(exportReplayDeferredMp4).toHaveBeenCalledTimes(1)
        expect(globalThis.navigator.share).toHaveBeenCalledTimes(1)
        expect(globalThis.navigator.share.mock.calls[0][0].files[0]).toBeInstanceOf(File)
        expect(globalThis.navigator.share.mock.calls[0][0].files[0].name).toBe('recording.mp4')
    })
})
