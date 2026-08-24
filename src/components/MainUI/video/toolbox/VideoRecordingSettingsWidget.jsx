/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoRecordingSettingsToolbar }         from '@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar'
import { LGS_TOOLBAR, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import { useEffect, useMemo } from 'react'
import { Widget }              from '@Components/MainUI/widgets/Widget'
import { useSnapshot } from 'valtio'

const VIDEO_RECORDING_SETTINGS_TOOLBAR_ZINDEX = 'var(--lgs-video-recording-settings-toolbar-zindex)'

/**
 * Component for the video recording setup HUD widget.
 * @component
 * @returns {JSX.Element} Video recording setup HUD
 */
export const VideoRecordingSettingsWidget = ({id}) => {
    const video = useSnapshot(lgs.stores.ui.video)

    useEffect(() => {
        const previous = lgs.stores.ui.widget.list.get(id) ?? {}
        lgs.stores.ui.widget.list.set(id, {
            ...previous,
            zIndex: VIDEO_RECORDING_SETTINGS_TOOLBAR_ZINDEX,
        })
    }, [id])

    useEffect(() => {
        if (!video.editing) {
            return undefined
        }

        let cancelled = false
        let frame = 0

        const syncNaturalToolbarSize = () => {
            if (cancelled) {
                return
            }

            const element = __.ui.widgetManager.getElementById(id)
            const config = __.ui.widgetManager.getWidgetConfig(id)

            if (!element || !config) {
                frame = requestAnimationFrame(syncNaturalToolbarSize)
                return
            }

            element.style.width = ''
            element.style.height = ''

            const rect = element.getBoundingClientRect()
            if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
                frame = requestAnimationFrame(syncNaturalToolbarSize)
                return
            }

            config.dimensions = {width: rect.width, height: rect.height}
            config.expandedInlineDimensions = {width: '', height: ''}

            __.ui.widgetManager.setConfig(id, config)
            __.ui.widgetManager.getMoveable(id)?.current?.updateRect?.()
            void __.ui.widgetManager.saveWidgetPosition(id, config)
        }

        frame = requestAnimationFrame(syncNaturalToolbarSize)

        return () => {
            cancelled = true
            cancelAnimationFrame(frame)
        }
    }, [id, video.editing])

    // Stabilize config with useMemo
    const config = useMemo(() => {
        return {
            left: '50%',
            top: '90%',
            attachTo: 'bottom',
            margin: lgs.gutter?.s ?? 8,
            canLock: false,
            canReduce: false,
            opacity:  lgs.settings.ui.toolbars.opacity,
            type:   LGS_TOOLBAR,
            zIndex:         VIDEO_RECORDING_SETTINGS_TOOLBAR_ZINDEX,
            id:             id,
            persist: false,
            showControlBox: false,
            group: VIDEO_TOOLS_WIDGETS,
        }
    }, [id])

    return (
        <Widget isVisible={true} className="video-recording-settings-widget-shell" config={config}>
            <VideoRecordingSettingsToolbar/>
        </Widget>
    )
}
