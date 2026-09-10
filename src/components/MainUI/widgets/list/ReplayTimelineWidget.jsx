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
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay Timeline widget host for linked video preparation.
 */

import {REPLAY_TIMELINE_UI} from '@Components/MainUI/video/replayTimelineUtils'
import {Widget} from '@Components/MainUI/widgets/Widget'
import {WidgetWindowActionButton} from '@Components/MainUI/widgets/WidgetWindowActionButton'
import {DockedWidgetContainerContext} from '@Components/MainUI/widgets/WidgetDockContext'
import {cancelVideoEditing} from '@Components/MainUI/video/videoEditingCleanup'
import {JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS_BOARD} from '@Core/constants'
import {
    canDockWidget,
    dockWidget,
} from '@Core/ui/widget-manager/WidgetDockManager'
import {useCallback, useContext, useMemo, useRef} from 'react'
import {ReplayTimelineContent} from './ReplayTimelineContent'

const REPLAY_TIMELINE_FREE_RATIO = {value: '0x0', aspectRatio: 0, locked: false}

/**
 * Render application actions injected into the generic timeline header.
 *
 * @param {Object} props - Action properties.
 * @param {string} props.id - Widget instance identifier.
 * @param {boolean} props.docked - Whether the widget is in the drawer.
 * @param {boolean} props.detached - Whether the widget is in an external window.
 * @param {Function} props.onClose - Close action callback.
 * @returns {JSX.Element} Header actions.
 */
const TimelineWidgetHeaderActions = ({id, docked, detached, onClose}) => {
    const windowManager = __.ui.widgetWindowManager
    const canDetach = !detached && Boolean(windowManager?.canDetachWidget?.(id))
    const canDock = Boolean(id && canDockWidget(id))

    const selectWidgetFrame = useCallback(() => {
        if (docked || detached) return
        const current = lgs.stores.ui.widget.current ?? {}
        const rotation = Number(__.ui.widgetManager.getWidgetConfig(id)?.rotate)
        lgs.stores.ui.widget.current = {
            ...current,
            id,
            rotate: Number.isFinite(rotation) ? rotation : (Number(current.rotate) || 0),
            keyboardUpdate: (Number(current.keyboardUpdate) || 0) + 1,
        }
    }, [detached, docked, id])

    const moveToDrawer = useCallback(() => {
        if (detached) {
            void windowManager?.attachWidgetToDrawer?.()
            return
        }
        dockWidget(id)
    }, [detached, id, windowManager])

    const moveToExternalWindow = useCallback(() => {
        if (!windowManager?.canDetachWidget?.(id)) return
        void windowManager.detachWidget(id)
    }, [id, windowManager])

    const returnToWidget = useCallback(() => {
        void windowManager?.reattachWidget?.()
    }, [windowManager])

    if (docked) return null

    return (
        <>
            {!detached && (
                <WidgetWindowActionButton icon="crosshairs-simple" label="Show widget frame" onClick={selectWidgetFrame}/>
            )}
            {canDetach && (
                <WidgetWindowActionButton icon="picture-in-picture" label="Open in Picture-in-Picture" onClick={moveToExternalWindow}/>
            )}
            {canDock && (
                <WidgetWindowActionButton icon="arrow-down-to-bracket" label="Open in drawer" onClick={moveToDrawer}/>
            )}
            {detached && (
                <WidgetWindowActionButton icon="arrow-up-from-bracket" label="Reattach to widget" onClick={returnToWidget}/>
            )}
            <WidgetWindowActionButton icon="xmark" label="Close timeline" onClick={onClose}/>
        </>
    )
}

/**
 * Render the Replay Timeline in its scene, dock, or detached host.
 *
 * @param {Object} props - Widget properties.
 * @param {string} props.id - Widget instance identifier.
 * @param {number|string} [props.zIndex] - Optional widget stacking order.
 * @param {boolean} [props.docked=false] - Render the widget in the bottom dock.
 * @param {boolean} [props.detached=false] - Render only the widget content in the external window.
 * @returns {JSX.Element} Hosted Replay Timeline widget.
 */
export const ReplayTimelineWidget = ({id, zIndex, docked = false, detached = false}) => {
    return <HostedReplayTimelineWidget id={id} zIndex={zIndex} docked={docked} detached={detached}/>
}

/**
 * Build the Timeline configuration for its current host and render its content.
 *
 * @param {Object} props - Timeline host properties.
 * @param {string} props.id - Widget instance identifier.
 * @param {number|string} [props.zIndex] - Optional widget stacking order.
 * @param {boolean} props.docked - Whether the Timeline is rendered in the drawer.
 * @param {boolean} props.detached - Whether only the Timeline content is rendered externally.
 * @returns {JSX.Element} Timeline content in the selected host.
 */
const HostedReplayTimelineWidget = ({id, zIndex, docked, detached}) => {
    const container = useMemo(() => lgs.canvas, [])
    const dockContainer = useContext(DockedWidgetContainerContext)
    const timelinePreviewRef = useRef(null)

    const config = useMemo(() => ({
        container: docked ? dockContainer : container,
        docked,
        captureExclude: ['[data-widget-capture="exclude"]'],
        contextMenu: {
            canReset:    true,
            canEdit:     false,
            canRemove:   false,
            canPosition: true,
            canSnapshot: false,
            canDockable: true,
            canDetach:   true,
        },
        top:           docked ? '0px' : '50%',
        left:          docked ? '0px' : '50%',
        attachTo:      docked ? 'top-left' : 'center',
        handle:        'lgs1920-timeline',
        type:          LGS_VISUAL_WIDGET,
        group:         JOURNEY_WIDGETS,
        id,
        ratio:         REPLAY_TIMELINE_FREE_RATIO,
        constrainResizeToContent: true,
        persist:       !docked,
        transient:     true,
        mandatory:     false,
        canLock:       false,
        draggable:     !docked,
        min:           {width: REPLAY_TIMELINE_UI.minWidth, height: REPLAY_TIMELINE_UI.minHeight},
        max:           {width: REPLAY_TIMELINE_UI.maxWidth, height: REPLAY_TIMELINE_UI.maxHeight},
        resizable:     !docked,
        scalable:      false,
        snap:          false,
        widgetsBoard:  SCENE_WIDGETS_BOARD,
        zIndex,
        showControlBox: !docked,
    }), [container, dockContainer, docked, id, zIndex])

    const handleClose = useCallback(async () => {
        if (detached) {
            await __.ui.widgetWindowManager?.reattachWidget?.()
        }
        cancelVideoEditing()
    }, [detached])
    const headerActions = <TimelineWidgetHeaderActions id={id}
                                                       docked={docked}
                                                       detached={detached}
                                                       onClose={handleClose}/>
    const content = <ReplayTimelineContent id={id}
                                           previewRef={timelinePreviewRef}
                                           detached={detached}
                                           headerActions={headerActions}/>
    if (detached) {
        return <div className="lgs-detached-widget-host">{content}</div>
    }

    return <Widget isVisible config={config} childRef={timelinePreviewRef}>{content}</Widget>
}

ReplayTimelineWidget.displayName = 'ReplayTimelineWidget'
