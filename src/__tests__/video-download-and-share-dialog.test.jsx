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
    RecordingInfo: ({mediaData}) => (
        <div
            data-testid="recording-info"
            data-dimensions={`${mediaData?.dimensions?.width ?? 0}x${mediaData?.dimensions?.height ?? 0}`}
            data-quality={mediaData?.quality?.name ?? ''}
        />
    ),
}))

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({children}) => <>{children}</>,
}))

vi.mock('@Components/MainUI/video/videoEditingCleanup', () => ({
    cancelVideoEditing: vi.fn(),
    prepareVideoCaptureUi: vi.fn(),
}))

vi.mock('@Core/ui/replay/ReplayDeferredExporter', () => ({
    exportReplayDeferredMp4: vi.fn(async ({dimensions} = {}) => ({
        blob: new Blob(['hq-video'], {type: 'video/mp4'}),
        mimeType: 'video/mp4',
        extension: 'mp4',
        filename: 'recording-master.mp4',
        frameCount: 30,
        plan: {
            label: 'recording-master',
            dimensions,
            renderSpec: {fps: 30},
            videoTimeline: {durationMillis: 1000},
        },
    })),
}))

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error:   vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', async () => {
    const React = await vi.importActual('react')

    return {
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaButtonGroup: ({children, ...props}) => <div role="group" {...props}>{children}</div>,
    WaDialog: ({children, open, onWaHide, lightDismiss, ...props}) => {
        const wasOpen = React.useRef(open)
        const manualHideDispatched = React.useRef(false)
        const dialogElement = {id: 'video-preview-dialog'}
        const nestedElement = {id: 'nested-webawesome-element'}

        React.useEffect(() => {
            if (wasOpen.current && !open) {
                if (manualHideDispatched.current) {
                    manualHideDispatched.current = false
                }
                else {
                    onWaHide?.({
                        target:        dialogElement,
                        currentTarget: dialogElement,
                        detail:        {source: dialogElement},
                    })
                    onWaHide?.({
                        target:        dialogElement,
                        currentTarget: dialogElement,
                        detail:        {source: dialogElement},
                    })
                }
            }
            wasOpen.current = open
        }, [open, onWaHide])

        if (!open) {
            return null
        }

        return (
            <div data-testid="video-preview-dialog" {...props}>
                <button
                    type="button"
                    aria-label="Native dialog close"
                    onClick={() => {
                        manualHideDispatched.current = true
                        onWaHide?.({
                            target:        dialogElement,
                            currentTarget: dialogElement,
                            detail:        {source: 'close-button'},
                        })
                    }}
                />
                <button
                    type="button"
                    aria-label="Escape dialog close"
                    onClick={() => {
                        manualHideDispatched.current = true
                        onWaHide?.({
                            target:        dialogElement,
                            currentTarget: dialogElement,
                            detail:        {source: 'keyboard'},
                        })
                    }}
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
    WaDropdown: ({children, onWaSelect, ...props}) => (
        <div
            {...props}
            onClick={(event) => {
                const item = event.target.closest?.('[data-wa-dropdown-value]')
                if (!item) {
                    return
                }
                onWaSelect?.({
                    detail: {
                        item: {
                            value: item.getAttribute('data-wa-dropdown-value'),
                        },
                    },
                })
            }}
        >
            {children}
        </div>
    ),
    WaDropdownItem: ({children, value, ...props}) => (
        <button type="button" data-wa-dropdown-value={value} {...props}>{children}</button>
    ),
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaInput: ({children, value = '', onInput}) => (
        <label>
            {children}
            <input aria-label="File name input" value={value} onInput={onInput} readOnly/>
        </label>
    ),
    WaTooltip: ({children}) => <>{children}</>,
    }
})

import { cancelVideoEditing, prepareVideoCaptureUi } from '@Components/MainUI/video/videoEditingCleanup'
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
        globalThis.URL.createObjectURL = vi.fn()
            .mockImplementationOnce(() => 'blob:recording')
            .mockImplementationOnce(() => 'blob:hq')
            .mockImplementation(() => 'blob:extra')
        globalThis.URL.revokeObjectURL = vi.fn()
        globalThis.requestAnimationFrame = vi.fn((callback) => callback())
        globalThis.cancelAnimationFrame = vi.fn()
        globalThis.navigator.share = vi.fn(async () => undefined)

        globalThis.__ = {
            recorder,
            ui: {
                replay: {
                    restorePlaybackScene: vi.fn(),
                },
                replayVideoSync: {
                    stopJourneyReplay: vi.fn(),
                },
                widgetManager: {
                    syncCropDimensionsFromElement: vi.fn(async () => null),
                    getWidgetConfig: vi.fn(() => null),
                },
            },
            device: {
                dpr:     1,
                browser: 'chromium',
                mobile:  false,
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
        globalThis.requestAnimationFrame = undefined
        globalThis.cancelAnimationFrame = undefined
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
        expect(globalThis.__.ui.replay.restorePlaybackScene).toHaveBeenCalledWith({force: true})
        expect(globalThis.__.ui.replayVideoSync.stopJourneyReplay).toHaveBeenCalledWith({deferSceneRestore: false})
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

    it('shares the live recording by default', async () => {
        openDialog()

        expect(screen.getByLabelText('File name input').value).toBe('recording-draft')
        expect(screen.getByRole('button', {name: 'Share'}).getAttribute('appearance')).toBe('filled')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Share'}))
        })

        expect(exportReplayDeferredMp4).not.toHaveBeenCalled()
        expect(globalThis.navigator.share).toHaveBeenCalledTimes(1)
        expect(globalThis.navigator.share.mock.calls[0][0].files[0]).toBeInstanceOf(File)
        expect(globalThis.navigator.share.mock.calls[0][0].files[0].name).toBe('recording-draft.mp4')
    })

    it('forces the live draft filename on download', async () => {
        openDialog()

        expect(screen.getByRole('button', {name: 'Download'}).getAttribute('appearance')).toBe('filled')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Download'}))
        })

        expect(recorder.download).toHaveBeenCalledWith({
            filename: 'recording-draft.mp4',
        })
    })

    it('creates an HQ video from the final dialog and switches to HQ actions once ready', async () => {
        globalThis.lgs.stores.replay = {
            deferredExportPlan: {
                dimensions: {width: 320, height: 180},
                runtime:    {contextKey: 'ctx-1'},
            },
        }

        openDialog()

        expect(screen.getByTestId('recording-info').getAttribute('data-dimensions')).toBe('640x360')
        expect(screen.getByTestId('recording-info').getAttribute('data-quality')).toBe('HD')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Create HQ video'}))
        })

        expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1)
        expect(exportReplayDeferredMp4).toHaveBeenCalledTimes(1)
        expect(exportReplayDeferredMp4.mock.calls[0]?.[0]).toMatchObject({
            dimensions: {width: 320, height: 180},
            filename:   'recording.mp4',
        })
        expect(document.querySelector('video.main-video')?.getAttribute('src')).toBe('blob:hq')
        expect(screen.getByLabelText('File name input').value).toBe('recording')
        expect(screen.queryByRole('button', {name: 'Create HQ video'})).toBeNull()
        expect(screen.getByRole('button', {name: 'Share HQ'}).getAttribute('appearance')).toBe('filled')
        expect(screen.getByTestId('recording-info').getAttribute('data-dimensions')).toBe('320x180')
        expect(screen.getByTestId('recording-info').getAttribute('data-quality')).toBe('HQ')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Share HQ'}))
        })

        expect(globalThis.navigator.share).toHaveBeenCalledTimes(1)
        expect(globalThis.navigator.share.mock.calls[0][0].files[0]).toBeInstanceOf(File)
        expect(globalThis.navigator.share.mock.calls[0][0].files[0].name).toBe('recording.mp4')
        await expect(globalThis.navigator.share.mock.calls[0][0].files[0].text()).resolves.toBe('hq-video')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Share draft video'}))
        })

        expect(globalThis.navigator.share).toHaveBeenCalledTimes(2)
        expect(globalThis.navigator.share.mock.calls[1][0].files[0]).toBeInstanceOf(File)
        expect(globalThis.navigator.share.mock.calls[1][0].files[0].name).toBe('recording-draft.mp4')
        await expect(globalThis.navigator.share.mock.calls[1][0].files[0].text()).resolves.toBe('video')
    })

    it('recomputes HQ dimensions from the current crop before exporting', async () => {
        const sourceCanvas = document.createElement('canvas')
        sourceCanvas.width = 1280
        sourceCanvas.height = 720
        sourceCanvas.getBoundingClientRect = vi.fn(() => ({
            left:   0,
            top:    0,
            width:  640,
            height: 360,
        }))
        globalThis.__.device.dpr = 2
        globalThis.__.ui.widgetManager.getWidgetConfig.mockReturnValue({
            cropDimensions: {left: 0, top: 0, width: 640, height: 360},
        })
        globalThis.lgs.canvas = sourceCanvas
        globalThis.lgs.stores.ui.video.fps = 0
        globalThis.lgs.stores.ui.video.quality = 0
        globalThis.lgs.stores.replay = {
            deferredExportPlan: {
                dimensions: {width: 960, height: 540},
                runtime:    {contextKey: 'stale-dimensions'},
            },
        }

        openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Create HQ video'}))
        })

        expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1)
        expect(globalThis.__.ui.widgetManager.syncCropDimensionsFromElement).toHaveBeenCalledWith(
            'video-crop-zone',
            false,
            'before-hq-export',
        )
        expect(exportReplayDeferredMp4).toHaveBeenCalledWith(expect.objectContaining({
            dimensions: {width: 1280, height: 720},
            captureMode: 'speed',
        }))
        expect(globalThis.lgs.stores.replay.videoCropRect).toEqual({
            left:   0,
            top:    0,
            width:  640,
            height: 360,
        })
    })

    it('downloads HQ and draft videos from the split button once HQ is ready', async () => {
        globalThis.lgs.stores.replay = {
            deferredExportPlan: {
                dimensions: {width: 320, height: 180},
                runtime:    {contextKey: 'ctx-1'},
            },
        }

        openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Create HQ video'}))
        })
        expect(screen.queryByRole('button', {name: 'Create HQ video'})).toBeNull()
        expect(screen.getByRole('button', {name: 'Download HQ'}).getAttribute('appearance')).toBe('filled')

        const originalCreateElement = document.createElement.bind(document)
        const anchor = {
            href:     '',
            download: '',
            click:    vi.fn(),
        }
        vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
            if (tagName === 'a') {
                return anchor
            }

            return originalCreateElement(tagName, options)
        })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Download HQ'}))
        })

        expect(anchor.download).toBe('recording.mp4')
        expect(anchor.click).toHaveBeenCalledTimes(1)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Download draft video'}))
        })

        expect(recorder.download).toHaveBeenCalledWith({
            filename: 'recording-draft.mp4',
        })
    })

    it('restores the live dialog when HQ creation is aborted', async () => {
        let abortController = null
        exportReplayDeferredMp4.mockImplementationOnce(({signal, abortController: controller}) => {
            abortController = controller
            return new Promise((_, reject) => {
                if (signal?.aborted) {
                    reject(new DOMException('The HQ export was aborted.', 'AbortError'))
                    return
                }

                signal?.addEventListener?.('abort', () => {
                    reject(new DOMException('The HQ export was aborted.', 'AbortError'))
                }, {once: true})
            })
        })

        globalThis.lgs.stores.replay = {
            deferredExportPlan: {runtime: {contextKey: 'ctx-1'}},
        }

        openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Create HQ video'}))
        })

        expect(screen.queryByTestId('video-preview-dialog')).toBeNull()

        await act(async () => {
            abortController.abort()
        })

        expect(screen.queryByTestId('video-preview-dialog')).not.toBeNull()
        expect(screen.getByLabelText('File name input').value).toBe('recording-draft')
        expect(screen.getByRole('button', {name: 'Share'})).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Share HQ'})).toBeNull()
    })

    it('switches the app back into editing mode while HQ creation is running', async () => {
        let resolveExport = null
        exportReplayDeferredMp4.mockImplementationOnce(() => new Promise((resolve) => {
            resolveExport = resolve
        }))

        globalThis.lgs.stores.replay = {
            deferredExportPlan: {runtime: {contextKey: 'ctx-1'}},
        }

        openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Create HQ video'}))
        })

        expect(globalThis.lgs.stores.ui.video.editing).toBe(true)
        expect(globalThis.lgs.stores.ui.video.finalizing).toBe(true)
        expect(screen.queryByTestId('video-preview-dialog')).toBeNull()

        await act(async () => {
            resolveExport({
                blob: new Blob(['hq-video'], {type: 'video/mp4'}),
                mimeType: 'video/mp4',
                extension: 'mp4',
                filename: 'recording-master.mp4',
                plan: {label: 'recording-master'},
            })
        })

        expect(globalThis.lgs.stores.ui.video.editing).toBe(false)
        expect(globalThis.lgs.stores.ui.video.finalizing).toBe(false)
        expect(screen.queryByTestId('video-preview-dialog')).not.toBeNull()
    })
})
