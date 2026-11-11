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
 * Last modified: 2026-11-08
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

    it('persists the new resolution profiles and keeps Native HQ selectable', async () => {
        const {container} = render(<VideoExportRenderOptions/>)
        const selects = [...container.querySelectorAll('wa-select')]
        const [resolution, renderer] = selects

        // React's jsdom SSR wrapper emits blank wa-option value attributes; restore the
        // option values before exercising Web Awesome's select change behavior.
        const optionValues = [
            ['720p', '1080p', '1440p', '4k-uhd', 'automatic', 'custom'],
            ['visible', 'isolated'],
            ['standard', 'high', 'maximum'],
            ['adaptive', 'strict'],
        ]
        selects.forEach((select, selectIndex) => {
            [...select.querySelectorAll('wa-option')].forEach((option, optionIndex) => {
                option.setAttribute('value', optionValues[selectIndex][optionIndex])
            })
        })

        expect(renderer).not.toBeNull()
        expect(resolution).not.toBeNull()
        expect(renderer.hasAttribute('disabled')).toBe(false)
        expect(resolution.querySelector('[slot="hint"]')).toBeNull()

        await act(async () => {
            resolution.value = '720p'
            resolution.dispatchEvent(new Event('change', {bubbles: true, composed: true}))
        })
        await waitFor(() => expect(lgs.settings.ui.video.resolutionProfile).toBe('720p'))

        await act(async () => {
            resolution.value = '1440p'
            resolution.dispatchEvent(new Event('change', {bubbles: true, composed: true}))
        })
        await waitFor(() => expect(lgs.settings.ui.video.resolutionProfile).toBe('1440p'))
        lgs.stores.ui.video.ratio = '9x16'
        const portraitRenderSpec = buildReplayVideoRenderSpec({
            cropRect: {left: 0, top: 0, width: 563, height: 1001},
            sourceCanvas: {width: 900, height: 1600},
            video: lgs.stores.ui.video,
            settings: lgs.settings.ui.video,
        })
        expect(portraitRenderSpec.dimensions).toEqual({width: 1440, height: 2560})
        lgs.stores.ui.video.ratio = '16x9'

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
