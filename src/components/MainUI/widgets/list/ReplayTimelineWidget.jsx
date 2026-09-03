/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayTimelineWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-09-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay Timeline widget host for linked video preparation.
 */

import {ReplayTimelinePreview} from '@Components/MainUI/video/ReplayTimelinePreview'
import {REPLAY_TIMELINE_UI} from '@Components/MainUI/video/replayTimelineUtils'
import {Widget} from '@Components/MainUI/widgets/Widget'
import {JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS_BOARD} from '@Core/constants'
import {constrainWidgetDimensions} from '@Core/ui/widget-manager/widgetResizeUtils'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

const REPLAY_TIMELINE_FREE_RATIO = {value: '0x0', aspectRatio: 0, locked: false}

/**
 * Render the Replay Timeline inside the standard movable and resizable widget host.
 *
 * @param {Object} props - Widget properties.
 * @param {string} props.id - Widget instance identifier.
 * @param {number|string} [props.zIndex] - Optional widget stacking order.
 * @returns {JSX.Element} Hosted Replay Timeline widget.
 */
export const ReplayTimelineWidget = ({id, zIndex}) => {
    const container = useMemo(() => lgs.canvas, [])
    const widgetState = useOptionalSnapshot(lgs.stores.ui.widget)
    const timelinePreviewRef = useRef(null)
    const keyboardZoomActive = widgetState.current?.id === id
    const [minimumDimensions, setMinimumDimensions] = useState({
        width:  REPLAY_TIMELINE_UI.minWidth,
        height: REPLAY_TIMELINE_UI.minHeight,
    })
    const handleMinimumDimensionsChange = useCallback((dimensions) => {
        setMinimumDimensions(current => current.width === dimensions.width && current.height === dimensions.height
            ? current
            : {width: dimensions.width, height: dimensions.height})
    }, [])

    useEffect(() => {
        let cancelled = false
        let frame = 0

        const syncNaturalTimelineSize = () => {
            if (cancelled) {
                return
            }

            const manager = __.ui?.widgetManager
            if (!manager) {
                return
            }

            const element = manager?.getElementById?.(id)
            const config = manager?.getWidgetConfig?.(id)
            const content = element?.querySelector?.('.replay-timeline-preview')

            if (!element || !config || !content) {
                frame = requestAnimationFrame(syncNaturalTimelineSize)
                return
            }

            const savedWidth = Number(config.dimensions?.width)
            const savedHeight = Number(config.dimensions?.height)
            const runtimeConfig = Object.assign({}, config, {
                min: {
                    width:  minimumDimensions.width,
                    height: minimumDimensions.height,
                },
            })

            element.style.width = ''
            element.style.height = ''

            const rect = content.getBoundingClientRect()
            if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
                frame = requestAnimationFrame(syncNaturalTimelineSize)
                return
            }

            const dimensions = constrainWidgetDimensions({
                config: runtimeConfig,
                element,
                width:  Number.isFinite(savedWidth) && savedWidth > 0 ? savedWidth : rect.width,
                height: Number.isFinite(savedHeight) && savedHeight > 0 ? savedHeight : rect.height,
            })
            const dimensionsChanged = dimensions.width !== savedWidth || dimensions.height !== savedHeight

            config.min = runtimeConfig.min
            config.dimensions = dimensions
            element.style.width = `${dimensions.width}px`
            element.style.height = `${dimensions.height}px`
            manager.setConfig(id, config)
            if (dimensionsChanged) {
                void manager.saveWidgetPosition?.(id, config)
            }
            manager.getMoveable?.(id)?.current?.updateRect?.()
        }

        frame = requestAnimationFrame(syncNaturalTimelineSize)

        return () => {
            cancelled = true
            cancelAnimationFrame(frame)
        }
    }, [id, minimumDimensions])

    useEffect(() => () => {
        __.ui.widgetManager.invalidateRuntimeById?.(id)
    }, [id])

    const config = useMemo(() => ({
        container,
        contextMenu: {
            canReset:    true,
            canEdit:     false,
            canRemove:   false,
            canPosition: true,
            canSnapshot: false,
        },
        top:           '50%',
        left:          '50%',
        attachTo:      'center',
        handle:        'lgs1920-timeline',
        type:          LGS_VISUAL_WIDGET,
        group:         JOURNEY_WIDGETS,
        id,
        ratio:         REPLAY_TIMELINE_FREE_RATIO,
        constrainResizeToContent: true,
        persist:       true,
        transient:     true,
        mandatory:     false,
        draggable:     true,
        min:           minimumDimensions,
        max:           {width: REPLAY_TIMELINE_UI.maxWidth, height: REPLAY_TIMELINE_UI.maxHeight},
        resizable:     true,
        scalable:      false,
        snap:          false,
        widgetsBoard:  SCENE_WIDGETS_BOARD,
        zIndex,
    }), [container, id, minimumDimensions, zIndex])

    return (
        <Widget isVisible config={config} childRef={timelinePreviewRef}>
            <ReplayTimelinePreview keyboardZoomActive={keyboardZoomActive}
                                   onMinimumDimensionsChange={handleMinimumDimensionsChange}
                                   ref={timelinePreviewRef}/>
        </Widget>
    )
}

ReplayTimelineWidget.displayName = 'ReplayTimelineWidget'
