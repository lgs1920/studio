/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-settings-menus.test.jsx
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

import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/ToolsUI/cropper/widgets/CropRatioEditorToolbar', () => ({
    CropRatioEditorToolbar: props => (
        <div data-testid="ratio-menu-content"
             data-embedded={props.embedded}
             data-main-theme={props.mainTheme}/>
    ),
}))

vi.mock('@Components/MainUI/video/toolbox/VideoPresetToolbar', () => ({
    VideoPresetToolbar: props => (
        <div data-testid="preset-menu-content"
             data-embedded={props.embedded}
             data-inline-custom={props.inlineCustom}
             data-main-theme={props.mainTheme}/>
    ),
}))

import {VideoRecordingSettingsMenus} from '@Components/MainUI/video/toolbox/VideoRecordingSettingsMenus'

describe('VideoRecordingSettingsMenus', () => {
    afterEach(() => cleanup())

    it('renders the ratio and preset item groups directly in the drawer', () => {
        render(<VideoRecordingSettingsMenus context={{}}
                                            cropzoneId="video-crop-zone"
                                            mainTheme/>)

        expect(screen.getByRole('heading', {name: 'Aspect ratio'})).not.toBeNull()
        expect(screen.getByRole('heading', {name: 'Preset'})).not.toBeNull()
        expect(screen.getByTestId('ratio-menu-content')).toMatchObject({
            dataset: {embedded: 'true', mainTheme: 'true'},
        })
        expect(screen.getByTestId('preset-menu-content')).toMatchObject({
            dataset: {embedded: 'true', inlineCustom: 'true', mainTheme: 'true'},
        })
    })
})
