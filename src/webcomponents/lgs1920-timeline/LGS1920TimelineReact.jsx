/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineReact.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {useEffect, useRef} from 'react'
import {LGS1920Timeline} from './LGS1920Timeline'

const EVENT_CALLBACKS = [
    ['play', 'onPlay'],
    ['pause', 'onPause'],
    ['restart', 'onRestart'],
    ['seek', 'onSeek'],
    ['track-visibility-change', 'onTrackVisibilityChange'],
    ['dblclick', 'onDblClick'],
    ['add-clip', 'onAddClip'],
    ['reorder', 'onReorder'],
    ['track-label-change', 'onTrackLabelChange'],
    ['context-menu-open', 'onContextMenuOpen'],
    ['clip-label-edit-request', 'onClipLabelEditRequest'],
    ['clip-visibility-change', 'onClipVisibilityChange'],
    ['clip-change-start', 'onClipChangeStart'],
    ['clip-changing', 'onClipChanging'],
    ['clip-change', 'onClipChange'],
    ['range-change-start', 'onRangeChangeStart'],
    ['range-changing', 'onRangeChanging'],
    ['range-change', 'onRangeChange'],
]

/**
 * React adapter for the controlled `lgs1920-timeline` Web Component.
 *
 * This adapter only bridges React properties and event callbacks. The Web
 * Component remains responsible for DOM rendering and pointer interaction.
 *
 * @param {Object} props - React component properties.
 * @param {Object} [props.timeline={}] - Global timeline configuration.
 * @param {Array} [props.tracks=[]] - Public track definitions.
 * @param {number} [props.currentTimeMillis=0] - Current logical time.
 * @param {boolean} [props.playing=false] - Whether playback is active.
 * @param {Array} [props.clipOptions=[]] - Clip insertion options.
 * @param {Function} [props.onPlay] - Play callback receiving event detail.
 * @param {Function} [props.onPause] - Pause callback receiving event detail.
 * @param {Function} [props.onRestart] - Restart callback receiving event detail.
 * @param {Function} [props.onSeek] - Seek callback receiving event detail.
 * @param {Function} [props.onTrackVisibilityChange] - Track visibility callback.
 * @param {Function} [props.onDblClick] - Clip double-click callback.
 * @param {Function} [props.onAddClip] - Clip insertion callback.
 * @param {Function} [props.onReorder] - Track reorder callback.
 * @param {Function} [props.onTrackLabelChange] - Track label callback.
 * @param {Function} [props.onContextMenuOpen] - Context-menu callback.
 * @param {Function} [props.onClipLabelEditRequest] - Clip label callback.
 * @param {Function} [props.onClipVisibilityChange] - Clip visibility callback.
 * @param {Function} [props.onClipChangeStart] - Clip edit start callback.
 * @param {Function} [props.onClipChanging] - Live clip edit callback.
 * @param {Function} [props.onClipChange] - Committed clip edit callback.
 * @param {Function} [props.onRangeChangeStart] - Video range edit start callback.
 * @param {Function} [props.onRangeChanging] - Live video range edit callback.
 * @param {Function} [props.onRangeChange] - Committed video range edit callback.
 * @param {React.ReactNode} [props.children] - Slotted Web Component children.
 * @returns {JSX.Element} Web Component React adapter.
 */
export const LGS1920TimelineReact = ({
    timeline = {},
    tracks = [],
    currentTimeMillis = 0,
    playing = false,
    clipOptions = [],
    onPlay,
    onPause,
    onRestart,
    onSeek,
    onTrackVisibilityChange,
    onDblClick,
    onAddClip,
    onReorder,
    onTrackLabelChange,
    onContextMenuOpen,
    onClipLabelEditRequest,
    onClipVisibilityChange,
    onClipChangeStart,
    onClipChanging,
    onClipChange,
    onRangeChangeStart,
    onRangeChanging,
    onRangeChange,
    children,
}) => {
    const _element = useRef(null)

    useEffect(() => {
        const element = _element.current
        if (!element) return
        element.timeline = timeline
        element.tracks = tracks
        element.currentTimeMillis = currentTimeMillis
        element.playing = playing
        element.clipOptions = clipOptions
    }, [clipOptions, currentTimeMillis, playing, timeline, tracks])

    useEffect(() => {
        const element = _element.current
        if (!element) return undefined
        const callbacks = {
            onPlay,
            onPause,
            onRestart,
            onSeek,
            onTrackVisibilityChange,
            onDblClick,
            onAddClip,
            onReorder,
            onTrackLabelChange,
            onContextMenuOpen,
            onClipLabelEditRequest,
            onClipVisibilityChange,
            onClipChangeStart,
            onClipChanging,
            onClipChange,
            onRangeChangeStart,
            onRangeChanging,
            onRangeChange,
        }
        const listeners = EVENT_CALLBACKS.map(([name, propName]) => {
            const listener = event => callbacks[propName]?.(event.detail, event)
            element.addEventListener(`lgs1920-timeline-${name}`, listener)
            return {name, listener}
        })
        return () => listeners.forEach(({name, listener}) => element.removeEventListener(`lgs1920-timeline-${name}`, listener))
    }, [onAddClip, onClipChange, onClipChangeStart, onClipChanging, onClipLabelEditRequest, onClipVisibilityChange, onContextMenuOpen, onDblClick, onPause, onPlay, onRangeChange, onRangeChangeStart, onRangeChanging, onReorder, onRestart, onSeek, onTrackLabelChange, onTrackVisibilityChange])

    return (
        <lgs1920-timeline ref={_element}>
            {children}
        </lgs1920-timeline>
    )
}

LGS1920TimelineReact.displayName = 'LGS1920TimelineReact'

export {LGS1920Timeline}
