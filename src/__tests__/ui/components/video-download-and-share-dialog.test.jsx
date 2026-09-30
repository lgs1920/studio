/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-download-and-share-dialog.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-17
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REPLAY_DEFERRED_EXPORT_READY_EVENT } from '@Core/ui/replay/ReplayRecordingMonitor'

vi.mock('@Components/MainUI/video/RecordingInfo', () => ({
    RecordingInfo: ({mediaData}) => (
        <div
            data-testid="recording-info"
            data-dimensions={`${mediaData?.dimensions?.width ?? 0}x${mediaData?.dimensions?.height ?? 0}`}
            data-quality={mediaData?.quality?.name ?? ''}
            data-metadata-status={mediaData?.metadata?.status ?? ''}
        />
    ),
}))

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({children}) => <>{children}</>,
}))

vi.mock('@Components/MainUI/video/videoEditingCleanup', () => ({
    cancelVideoEditing: vi.fn(),
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
                    aria-label="Forced dialog self close"
                    onClick={() => {
                        manualHideDispatched.current = true
                        onWaHide?.({
                            target:        dialogElement,
                            currentTarget: dialogElement,
                            detail:        {source: dialogElement},
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

import { cancelVideoEditing } from '@Components/MainUI/video/videoEditingCleanup'
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
            metadata: {
                status: 'ready',
                artist: 'LGS1920',
                album:  'Your Adventures',
                genre:  'Adventures Replay',
                publisher: 'LGS1920 Studio',
                encodedBy: 'Mediabunny',
                comment: 'Journey title\nRecorded on 2026-08-19',
                title: 'Journey title',
                description: 'Journey title',
                raw: {
                    '©pub': 'LGS1920 Studio',
                    '©too': 'Mediabunny',
                },
            },
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
            .mockImplementation(() => 'blob:extra')
        globalThis.URL.revokeObjectURL = vi.fn()
        globalThis.requestAnimationFrame = vi.fn((callback) => callback())
        globalThis.cancelAnimationFrame = vi.fn()
        globalThis.navigator.share = vi.fn(async () => undefined)

        globalThis.__ = {
            mediaCapture: recorder,
            ui: {
                replay: {
                    restorePlaybackScene: vi.fn(),
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
                replay: {
                    recordingSync: true,
                },
                ui: {
                    video: {
                        preRecording: false,
                        recording:    false,
                        recordingHQ:  false,
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

    const openDialog = async () => {
        render(<VideoDownloadAndShareDialog/>)
        await act(async () => {
            window.dispatchEvent(new CustomEvent(REPLAY_DEFERRED_EXPORT_READY_EVENT, {
                detail: {
                    blob: new Blob(['video'], {type: 'video/mp4'}),
                    filename: 'recording.mp4',
                    mediaData: recorder.mediaData,
                },
            }))
        })
        expect(screen.queryByTestId('video-preview-dialog')).not.toBeNull()
    }

    const expectDialogCleanup = async () => {
        await waitFor(() => {
            expect(screen.queryByTestId('video-preview-dialog')).toBeNull()
        })
        expect(globalThis.__.ui.replay.restorePlaybackScene).toHaveBeenCalledTimes(1)
        expect(globalThis.__.ui.replay.restorePlaybackScene).toHaveBeenCalledWith({force: true})
        expect(cancelVideoEditing).toHaveBeenCalledTimes(1)
        expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:recording')
        expect(recorder.releaseMedia).toHaveBeenCalledTimes(1)
        expect(globalThis.lgs.stores.ui.video.finalizing).toBe(false)
        expect(screen.queryByTestId('video-preview-dialog')).toBeNull()
    }

    it('uses the same cleanup for the footer close button', async () => {
        await openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Close'}))
        })

        await expectDialogCleanup()
    })

    it('uses the same cleanup for the native dialog close button', async () => {
        await openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Native dialog close'}))
        })

        await expectDialogCleanup()
    })

    it('uses the same cleanup for an Escape dialog close', async () => {
        await openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Escape dialog close'}))
        })

        await expectDialogCleanup()
    })

    it('waits for replay scene focus restoration before opening the preview dialog', async () => {
        let resolveRestore
        globalThis.__.ui.replay.restorePlaybackScene.mockImplementationOnce(() => new Promise(resolve => {
            resolveRestore = resolve
        }))

        render(<VideoDownloadAndShareDialog/>)
        await act(async () => {
            window.dispatchEvent(new CustomEvent(REPLAY_DEFERRED_EXPORT_READY_EVENT, {
                detail: {
                    blob: new Blob(['video'], {type: 'video/mp4'}),
                    filename: 'recording.mp4',
                    mediaData: recorder.mediaData,
                },
            }))
            await Promise.resolve()
        })

        expect(screen.queryByTestId('video-preview-dialog')).toBeNull()
        expect(globalThis.__.ui.replay.restorePlaybackScene).toHaveBeenCalledWith({force: true})

        await act(async () => {
            resolveRestore()
        })

        expect(screen.queryByTestId('video-preview-dialog')).not.toBeNull()
    })

    it('cleans up when the dialog itself reports an external forced close', async () => {
        await openDialog()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Forced dialog self close'}))
        })

        await expectDialogCleanup()
    })

    it('ignores hide events bubbling from nested Web Awesome components', async () => {
        await openDialog()

        fireEvent.click(screen.getByRole('button', {name: 'Nested component hide'}))

        expect(cancelVideoEditing).not.toHaveBeenCalled()
        expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled()
        expect(recorder.releaseMedia).not.toHaveBeenCalled()
        expect(screen.queryByTestId('video-preview-dialog')).not.toBeNull()
    })

    it('shares the Replay export by default', async () => {
        await openDialog()


        expect(screen.getByLabelText('File name input').value).toBe('recording')
        expect(screen.getByRole('button', {name: 'Share'}).getAttribute('appearance')).toBe('filled')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Share'}))
        })

        expect(globalThis.navigator.share).toHaveBeenCalledTimes(1)
        expect(globalThis.navigator.share.mock.calls[0][0].files[0]).toBeInstanceOf(File)
        expect(globalThis.navigator.share.mock.calls[0][0].files[0].name).toBe('recording.mp4')
    })

    it('downloads the available Replay video without a version suffix', async () => {
        await openDialog()
        const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

        expect(screen.getByRole('button', {name: 'Download'}).getAttribute('appearance')).toBe('filled')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Download'}))
        })

        expect(anchorClick).toHaveBeenCalledOnce()
        expect(anchorClick.mock.instances[0]?.download).toBe('recording.mp4')
    })

    it('previews and downloads the frame-by-frame Replay export', async () => {
        render(<VideoDownloadAndShareDialog/>)
        const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

        await act(async () => {
            window.dispatchEvent(new CustomEvent(REPLAY_DEFERRED_EXPORT_READY_EVENT, {
                detail: {
                    blob: new Blob(['frame-by-frame video'], {type: 'video/mp4'}),
                    filename: 'journey-replay.mp4',
                    mediaData: {
                        size: 20,
                        duration: 2000,
                        fps: 30,
                        dimensions: {width: 1280, height: 720},
                        quality: {name: 'High'},
                        ratio: {label: '16:9'},
                        metadata: {status: 'ready'},
                        mimeType: 'video/mp4',
                        extension: 'mp4',
                    },
                },
            }))
        })

        expect(screen.getByLabelText('File name input').value).toBe('journey-replay')
        expect(screen.getByTestId('recording-info').getAttribute('data-dimensions')).toBe('1280x720')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Download'}))
        })

        expect(anchorClick).toHaveBeenCalledTimes(1)
        expect(anchorClick.mock.instances[0]?.download).toBe('journey-replay.mp4')
    })

    it('preserves video metadata in the recording information', async () => {
        recorder.mediaData.metadata = {
            status: 'published',
            artist: 'LGS1920',
        }

        await openDialog()

        expect(screen.getByTestId('recording-info').getAttribute('data-metadata-status')).toBe('published')
    })

})
