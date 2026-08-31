// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: cropper-pass-through.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/MainUI/video/VideoSceneWidgetsPortal', () => ({
    VideoSceneWidgetsPortal: () => null,
}))

vi.mock('@Components/MainUI/widgets/WidgetsPanel', () => ({
    WidgetsPanel: () => null,
}))

vi.mock('@Components/ToolsUI/cropper/widgets/CropRatioEditorWidget', () => ({
    CropRatioEditorWidget: () => null,
}))

vi.mock('../../../components/ToolsUI/cropper/widgets/DefinedCropZone.jsx', () => ({
    DefinedCropZone: () => <div className="crop-zone defined-crop-zone"/>,
}))

vi.mock('../../../components/ToolsUI/cropper/widgets/CropZoneWidget.jsx', () => ({
    CropZoneWidget: () => <div className="crop-zone"/>,
}))

vi.mock('../../../components/ToolsUI/cropper/widgets/CropZoneInfoPopup.jsx', () => ({
    CropZoneInfoPopup: () => null,
}))

import { Cropper } from '@Components/ToolsUI/cropper/Cropper'
import { CropOverlay } from '@Components/ToolsUI/cropper/CropOverlay'

describe('Cropper pointer pass-through', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                widgetManager: {
                    getWidgetConfig: vi.fn(() => ({
                        cropDimensions: {
                            left:   20,
                            top:    30,
                            width:  640,
                            height: 360,
                        },
                    })),
                },
            },
        }
        globalThis.lgs = {
            stores: {
                ui: {
                    video: proxy({
                        editing:      true,
                        preRecording: false,
                        recording:    false,
                        snapshot:     false,
                        finalizing:   false,
                        cropper:      proxy({
                            ratioEditor:  false,
                            presetEditor: false,
                            widgetEditor: false,
                            id:           'video-crop-zone',
                        }),
                    }),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('lets Cesium receive pointer events through the crop window and blocks the overlay shell', () => {
        const context = proxy({
            id: 'video-crop-zone',
        })

        const {container} = render(<Cropper overlay context={context}/>)
        const cropperContainer = container.querySelector('.crop-container')
        const cropOverlay = container.querySelector('.crop-overlay')
        const blockers = container.querySelectorAll('.crop-overlay-blocker')

        expect(cropperContainer).not.toBeNull()
        expect(cropperContainer.style.pointerEvents).toBe('none')
        expect(cropOverlay).not.toBeNull()
        expect(cropOverlay.style.pointerEvents).toBe('none')
        expect(cropOverlay.children).toHaveLength(0)
        expect(container.querySelector('.crop-overlay-blockers')).not.toBeNull()
        expect(blockers).toHaveLength(4)
        expect(blockers[0].style.height).toBe('30px')
        expect(blockers[1].style.width).toBe('20px')
        expect(blockers[2].style.left).toBe('660px')
        expect(blockers[3].style.top).toBe('390px')
    })

    it('keeps preparation overlay blockers outside the clipped visual overlay', () => {
        const {container} = render(
            <CropOverlay
                crop={{left: 20, top: 30, width: 640, height: 360}}
                style={{clipPath: 'inset(0 0 0 0)'}}/>,
        )
        const cropOverlay = container.querySelector('.crop-overlay')
        const blockers = container.querySelector('.crop-overlay-blockers')

        expect(cropOverlay?.style.pointerEvents).toBe('none')
        expect(cropOverlay?.contains(blockers)).toBe(false)
        expect(blockers?.querySelectorAll('.crop-overlay-blocker')).toHaveLength(4)
    })

    it('does not create hit-test blockers when Cesium input is allowed', () => {
        const {container} = render(
            <CropOverlay
                crop={{left: 20, top: 30, width: 640, height: 360}}
                blockOutsideCrop={false}/>,
        )

        expect(container.querySelector('.crop-overlay-blockers')).toBeNull()
    })

})
