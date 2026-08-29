/**
 * Replay Timeline widget host for linked video preparation.
 */

import {ReplayTimelinePreview} from '@Components/MainUI/video/ReplayTimelinePreview'
import {Widget} from '@Components/MainUI/widgets/Widget'
import {JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS_BOARD} from '@Core/constants'
import {constrainWidgetDimensions} from '@Core/ui/widget-manager/widgetResizeUtils'
import {useEffect, useMemo} from 'react'

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

            element.style.width = ''
            element.style.height = ''

            const rect = content.getBoundingClientRect()
            if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
                frame = requestAnimationFrame(syncNaturalTimelineSize)
                return
            }

            const dimensions = constrainWidgetDimensions({
                config,
                element,
                width:  Number.isFinite(savedWidth) && savedWidth > 0 ? savedWidth : rect.width,
                height: Number.isFinite(savedHeight) && savedHeight > 0 ? savedHeight : rect.height,
            })
            const dimensionsChanged = dimensions.width !== savedWidth || dimensions.height !== savedHeight

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
    }, [id])

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
        handle:        '.replay-timeline-preview__header',
        type:          LGS_VISUAL_WIDGET,
        group:         JOURNEY_WIDGETS,
        id,
        ratio:         REPLAY_TIMELINE_FREE_RATIO,
        constrainResizeToContent: true,
        persist:       true,
        transient:     true,
        mandatory:     false,
        draggable:     true,
        min:           {width: 360, height: 66},
        max:           {width: 3840, height: 2160},
        resizeToContent: {minHeight: true},
        resizable:     true,
        scalable:      false,
        snap:          false,
        widgetsBoard:  SCENE_WIDGETS_BOARD,
        zIndex,
    }), [container, id, zIndex])

    return (
        <Widget isVisible config={config}>
            <ReplayTimelinePreview/>
        </Widget>
    )
}

ReplayTimelineWidget.displayName = 'ReplayTimelineWidget'
