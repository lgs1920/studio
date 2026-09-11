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
 * Last modified: 2026-09-11
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
import {JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS_BOARD} from '@Core/constants'
import {
    dockWidget,
    getDockedWidgetDimensions,
    undockWidget,
} from '@Core/ui/widget-manager/WidgetDockManager'
import {LGS1920_ICON_LIBRARY} from '@Utils/useWebAwesomeKits'
import {useCallback, useContext, useMemo, useRef} from 'react'
import {useSnapshot} from 'valtio'
import {ReplayTimelineContent} from './ReplayTimelineContent'

const REPLAY_TIMELINE_FREE_RATIO = {value: '0x0', aspectRatio: 0, locked: false}

/**
 * Render application actions injected into the generic timeline header.
 *
 * @param {Object} props - Action properties.
 * @param {string} props.id - Widget instance identifier.
 * @param {boolean} props.docked - Whether the widget is in the drawer.
 * @param {boolean} props.detached - Whether the widget is in an external window.
 * @returns {JSX.Element} Header actions.
 */
const TimelineWidgetHeaderActions = ({id, docked, detached}) => {
    const windowManager = __.ui.widgetWindowManager
    const widget = useSnapshot(lgs.stores.ui.widget)
    const hasDetachedWidget = Boolean(widget.undocked?.id)
    const hasDockedWidget = Boolean(widget.docked?.id)
    const canDetach = !detached && !hasDetachedWidget
    const canDock = !docked && !hasDockedWidget
    const canUndock = docked && !detached

    const moveToDrawer = useCallback(() => {
        if (detached) {
            void windowManager?.attachWidgetToDrawer?.()
            return
        }
        dockWidget(id)
    }, [detached, id, windowManager])

    const moveToExternalWindow = useCallback(() => {
        if (!windowManager?.canDetachWidget?.(id)) return
        if (docked) {
            const dimensions = getDockedWidgetDimensions(id)
            if (!undockWidget(id)) return
            void windowManager.detachWidget(id, {dimensions, useConfigDimensions: true})
            return
        }
        void windowManager.detachWidget(id)
    }, [docked, id, windowManager])

    const moveToWidget = useCallback(() => {
        undockWidget(id)
    }, [id])

    const returnToWidget = useCallback(() => {
        void windowManager?.reattachWidget?.()
    }, [windowManager])

    return (
        <>
            {canUndock && (
                <WidgetWindowActionButton icon="arrow-up-from-bracket" label="Reattach to widget" onClick={moveToWidget}/>
            )}
            {canDetach && (
                <WidgetWindowActionButton icon="picture-in-picture" label="Open in Picture-in-Picture" onClick={moveToExternalWindow}/>
            )}
            {canDock && (
                <WidgetWindowActionButton icon="arrow-down-to-bracket" label="Open in drawer"
                                          size="m" onClick={moveToDrawer}/>
            )}
            {detached && (
                <WidgetWindowActionButton icon="picture-in-picture-out" library={LGS1920_ICON_LIBRARY}
                                          label="Reattach to widget" size="m" onClick={returnToWidget}/>
            )}
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

    const headerActions = <TimelineWidgetHeaderActions id={id}
                                                       docked={docked}
                                                       detached={detached}/>
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
