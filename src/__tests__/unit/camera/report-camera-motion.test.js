import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stopReportCameraMotion } from '@Utils/ExportAsReport/snapshots'

describe('report camera motion', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                cameraManager: {
                    isRotating: vi.fn(() => true),
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }
        globalThis.lgs = {
            scene: {
                requestRender: vi.fn(),
            },
            stores: {
                ui: {
                    mainUI: {
                        panorama: {
                            active: true,
                            target:  {slug: 'panorama-target'},
                        },
                    },
                },
            },
        }
        globalThis.requestAnimationFrame = vi.fn(callback => {
            callback(0)
            return 1
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
        delete globalThis.__
        delete globalThis.lgs
        delete globalThis.requestAnimationFrame
    })

    it('stops camera motion before taking report snapshots', async () => {
        await stopReportCameraMotion()

        expect(globalThis.__.ui.cameraManager.stopRotate).toHaveBeenCalledOnce()
        expect(globalThis.lgs.stores.ui.mainUI.panorama.active).toBe(false)
        expect(globalThis.lgs.stores.ui.mainUI.panorama.target).toBe(false)
        expect(globalThis.lgs.scene.requestRender).toHaveBeenCalled()
    })
})
