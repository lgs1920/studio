/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-preset-toolbar.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-12
 * Last modified: 2026-09-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: () => null,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoFPSToolbar', () => ({
    VideoFPSToolbar: () => <div data-testid="fps-choices"/>,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoQualityToolbar', () => ({
    VideoQualityToolbar: () => <div data-testid="quality-choices"/>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: () => <span/>,
}))

import {VideoPresetToolbar} from '@Components/MainUI/video/toolbox/VideoPresetToolbar'

describe('VideoPresetToolbar', () => {
    beforeEach(() => {
        globalThis.lgs = {
            settings: {
                ui: {
                    toolbars: proxy({opacity: 1}),
                    video:    proxy({fps: 0, quality: 0}),
                },
            },
            stores: {
                ui: {
                    video: proxy({fps: 0, quality: 0}),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
    })

    it('exposes every preset and expands custom FPS and quality choices inline', () => {
        render(<VideoPresetToolbar embedded
                                   idPrefix="timeline-video-preset"
                                   inlineCustom
                                   mainTheme/>)

        expect(screen.getByRole('button', {name: 'Low'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Med'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'High'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Ultra'})).not.toBeNull()
        const customButton = screen.getByRole('button', {name: 'Flex'})
        expect(customButton.id).toBe('timeline-video-preset-custom')
        expect(screen.queryByTestId('fps-choices')).toBeNull()

        fireEvent.click(customButton)

        expect(screen.getByTestId('fps-choices')).not.toBeNull()
        expect(screen.getByTestId('quality-choices')).not.toBeNull()
    })
})
