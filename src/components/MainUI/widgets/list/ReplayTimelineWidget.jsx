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
 * Last modified: 2026-09-04
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
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useEffect, useMemo, useRef} from 'react'

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
        min:           {width: REPLAY_TIMELINE_UI.minWidth, height: REPLAY_TIMELINE_UI.minHeight},
        max:           {width: REPLAY_TIMELINE_UI.maxWidth, height: REPLAY_TIMELINE_UI.maxHeight},
        resizable:     true,
        scalable:      false,
        snap:          false,
        widgetsBoard:  SCENE_WIDGETS_BOARD,
        zIndex,
    }), [container, id, zIndex])

    return (
        <Widget isVisible config={config} childRef={timelinePreviewRef}>
            <ReplayTimelinePreview keyboardZoomActive={keyboardZoomActive} ref={timelinePreviewRef}/>
        </Widget>
    )
}

ReplayTimelineWidget.displayName = 'ReplayTimelineWidget'
