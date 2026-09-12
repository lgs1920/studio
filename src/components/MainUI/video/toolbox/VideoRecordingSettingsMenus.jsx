/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsMenus.jsx
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

import {CropRatioEditorToolbar} from '@Components/ToolsUI/cropper/widgets/CropRatioEditorToolbar'
import {VideoPresetToolbar} from './VideoPresetToolbar'
import {memo} from 'react'

/**
 * Render one reusable video settings menu.
 *
 * The menu content is shared by the existing video settings popups and the
 * timeline drawer. The host decides whether the content is displayed in a
 * popup or as part of the drawer layout.
 *
 * @param {Object} props - Menu properties.
 * @param {'ratio'|'preset'} props.menu - Menu to render.
 * @param {Object} props.context - Cropper state proxy.
 * @param {string} props.cropzoneId - Crop zone widget identifier.
 * @param {boolean} [props.mainTheme=false] - Use the main application theme.
 * @param {boolean} [props.inlineCustom=false] - Show custom preset controls inline.
 * @returns {JSX.Element} Reusable menu content.
 */
export const VideoRecordingSettingsMenuContent = memo(({
    menu,
    context,
    cropzoneId,
    mainTheme = false,
    inlineCustom = false,
}) => {
    if (menu === 'ratio') {
        return <CropRatioEditorToolbar context={context}
                                       cropzoneId={cropzoneId}
                                       embedded
                                       mainTheme={mainTheme}/>
    }

    return <VideoPresetToolbar embedded
                               inlineCustom={inlineCustom}
                               idPrefix={inlineCustom ? 'timeline-video-preset' : 'video-preset'}
                               mainTheme={mainTheme}/>
})

VideoRecordingSettingsMenuContent.displayName = 'VideoRecordingSettingsMenuContent'

/**
 * Render both video settings menus as selectable groups for the timeline drawer.
 *
 * @param {Object} props - Menu properties.
 * @param {string} [props.className] - Additional class for the slotted host.
 * @param {Object} props.context - Cropper state proxy.
 * @param {string} props.cropzoneId - Crop zone widget identifier.
 * @param {boolean} [props.mainTheme=false] - Use the main application theme.
 * @param {string} [props.slot] - Slot name used by the timeline host.
 * @returns {JSX.Element} Drawer menu groups.
 */
export const VideoRecordingSettingsMenus = memo(({className = '', context, cropzoneId, mainTheme = false, slot}) => (
    <div slot={slot}
         className={`video-recording-settings-menu ${mainTheme ? 'wa-theme-lgs1920' : 'wa-theme-lgs1920-on-map'} ${className}`.trim()}
         role="group"
         aria-label="Video settings">
        <section aria-labelledby="timeline-video-ratio-label">
            <h3 id="timeline-video-ratio-label">{'Aspect ratio'}</h3>
            <VideoRecordingSettingsMenuContent menu="ratio"
                                               context={context}
                                               cropzoneId={cropzoneId}
                                               mainTheme={mainTheme}/>
        </section>
        <section aria-labelledby="timeline-video-preset-label">
            <h3 id="timeline-video-preset-label">{'Preset'}</h3>
            <VideoRecordingSettingsMenuContent menu="preset"
                                               context={context}
                                               cropzoneId={cropzoneId}
                                               inlineCustom
                                               mainTheme={mainTheme}/>
        </section>
    </div>
))

VideoRecordingSettingsMenus.displayName = 'VideoRecordingSettingsMenus'
