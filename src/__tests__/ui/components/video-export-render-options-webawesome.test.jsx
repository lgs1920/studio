/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-export-render-options-webawesome.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {proxy} from 'valtio'
import {VideoExportRenderOptions} from '@Components/MainUI/video/toolbox/VideoExportRenderOptions'
import {buildReplayVideoRenderSpec} from '@Core/ui/replay/ReplayVideoRenderSpec'

describe('VideoExportRenderOptions with the real Web Awesome select', () => {
    beforeEach(() => {
        globalThis.lgs = {
            stores: {ui: {video: proxy({})}},
            settings: {ui: {video: proxy({})}},
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
    })

    it('keeps Native HQ selectable after choosing 4K UHD and exports the exact profile', async () => {
        const {container} = render(<VideoExportRenderOptions/>)
        const selects = [...container.querySelectorAll('wa-select')]
        const [renderer, resolution] = selects

        expect(renderer).not.toBeNull()
        expect(resolution).not.toBeNull()
        expect(renderer.hasAttribute('disabled')).toBe(false)

        await act(async () => {
            resolution.value = '4k-uhd'
            resolution.dispatchEvent(new Event('change', {bubbles: true, composed: true}))
        })
        await waitFor(() => expect(lgs.stores.ui.video.resolutionProfile).toBe('4k-uhd'))
        expect(renderer.hasAttribute('disabled')).toBe(false)

        await act(async () => {
            renderer.value = 'isolated'
            renderer.dispatchEvent(new Event('change', {bubbles: true, composed: true}))
        })
        await waitFor(() => expect(lgs.stores.ui.video.renderHostMode).toBe('isolated'))
        expect(lgs.settings.ui.video.resolutionProfile).toBe('4k-uhd')
        expect(lgs.settings.ui.video.renderHostMode).toBe('isolated')

        const renderSpec = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 1920, height: 1080},
            sourceCanvas: {width: 1920, height: 1080},
            video: lgs.stores.ui.video,
            settings: lgs.settings.ui.video,
        })

        expect(renderSpec.renderHostMode).toBe('isolated')
        expect(renderSpec.dimensions).toEqual({width: 3840, height: 2160})
    })
})
