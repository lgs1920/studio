/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: crop-zone-cleanup.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
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

vi.mock('@Components/ToolsUI/cropper/widgets/CropZoneInfo', () => ({
    CropZoneInfo: () => null,
}))

import { CropZone } from '@Components/ToolsUI/cropper/widgets/CropZone'

describe('CropZone cleanup', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                widgetManager: {
                    syncCropDimensionsFromElement: vi.fn(),
                },
            },
        }

        globalThis.lgs = {
            stores: {
                ui: {
                    video: proxy({
                        editing: true,
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

    it('does not persist crop dimensions on unmount because the toolbar owns exit persistence', () => {
        const {unmount} = render(<CropZone context={{id: 'video-crop-zone'}}/>)

        unmount()

        expect(__.ui.widgetManager.syncCropDimensionsFromElement).not.toHaveBeenCalled()
    })
})
