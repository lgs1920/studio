/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayTimelineContent.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {ReplayTimelinePreview} from '@Components/MainUI/video/ReplayTimelinePreview'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useEffect, useRef} from 'react'

/**
 * Renders the Replay Timeline content without a widget host.
 *
 * @param {Object} props - Timeline properties.
 * @param {string} props.id - Widget instance identifier.
 * @param {React.MutableRefObject|null} [props.previewRef=null] - Optional preview imperative ref.
 * @param {boolean} [props.detached=false] - Whether the content is rendered in an external window.
 * @returns {JSX.Element} Replay Timeline content.
 */
export const ReplayTimelineContent = ({id, previewRef = null, detached = false}) => {
    const widgetState = useOptionalSnapshot(lgs.stores.ui.widget)
    const localPreviewRef = useRef(null)
    const contentElementRef = useRef(null)
    const timelinePreviewRef = previewRef ?? localPreviewRef
    const keyboardZoomActive = widgetState.current?.id === id

    useEffect(() => () => {
        __.ui.widgetManager.invalidateRuntimeById?.(id)
    }, [id])

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            timelinePreviewRef.current?.handleResize?.()
        })

        return () => cancelAnimationFrame(frame)
    }, [id])

    useEffect(() => {
        const element = contentElementRef.current
        if (!element || typeof ResizeObserver === 'undefined') {
            return undefined
        }

        const observer = new ResizeObserver(() => {
            timelinePreviewRef.current?.handleResize?.()
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [id])

    return (
        <div ref={contentElementRef} className="lgs-replay-timeline-content">
            <ReplayTimelinePreview keyboardZoomActive={keyboardZoomActive} detached={detached} ref={timelinePreviewRef}/>
        </div>
    )
}

ReplayTimelineContent.displayName = 'ReplayTimelineContent'
