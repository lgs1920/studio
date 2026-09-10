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
import {DockedWidgetContainerContext} from '@Components/MainUI/widgets/WidgetDockContext'
import {JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS_BOARD} from '@Core/constants'
import {useContext, useMemo, useRef} from 'react'
import {ReplayTimelineContent} from './ReplayTimelineContent'

const REPLAY_TIMELINE_FREE_RATIO = {value: '0x0', aspectRatio: 0, locked: false}

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

    const content = <ReplayTimelineContent id={id} previewRef={timelinePreviewRef} detached={detached}/>
    if (detached) {
        return <div className="lgs-detached-widget-host">{content}</div>
    }

    return <Widget isVisible config={config} childRef={timelinePreviewRef}>{content}</Widget>
}

ReplayTimelineWidget.displayName = 'ReplayTimelineWidget'
