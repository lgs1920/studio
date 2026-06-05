/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: crop-zone-widget-sync.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-06-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

let capturedConfig = null

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({config, children}) => {
        capturedConfig = config
        return <div data-testid="widget">{children}</div>
    },
}))

vi.mock('@Components/ToolsUI/cropper/widgets/CropZone', () => ({
    CropZone: () => <div data-testid="crop-zone"/>,
}))

import { CropZoneWidget } from '@Components/ToolsUI/cropper/widgets/CropZoneWidget'

describe('CropZoneWidget sync mode', () => {
    beforeEach(() => {
        capturedConfig = null

        globalThis.__ = {
            device: {
                isPortrait: false,
            },
            ui: {
                widgetManager: {
                    getElementById: vi.fn(() => document.createElement('div')),
                    toCenter: vi.fn(),
                },
            },
        }

        globalThis.lgs = {
            configuration: {
                videoFormats: [
                    {value: '16x9'},
                    {value: '9x16'},
                ],
            },
            settings: {
                ui: {
                    video: {
                        ratio: '16x9',
                    },
                },
            },
            gutter: {
                xs: 8,
            },
            stores: {
                ui: {
                    video: proxy({
                        editing: true,
                        step: 0,
                    }),
                },
                flythrough: proxy({
                    recordingSync: false,
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('keeps the cropper draggable when video is not linked to flythrough', () => {
        const context = proxy({id: 'video-crop-zone'})

        render(<CropZoneWidget context={context}/>)

        expect(capturedConfig.draggable).toBe(true)
        expect(__.ui.widgetManager.toCenter).not.toHaveBeenCalled()
    })

    it('centers and locks the cropper only when video is linked to flythrough', () => {
        lgs.stores.flythrough.recordingSync = true
        const context = proxy({id: 'video-crop-zone'})

        render(<CropZoneWidget context={context}/>)

        expect(capturedConfig.draggable).toBe(false)
        expect(__.ui.widgetManager.toCenter).toHaveBeenCalledTimes(1)
        expect(__.ui.widgetManager.toCenter).toHaveBeenCalledWith(expect.any(HTMLDivElement), 0)
    })
})
