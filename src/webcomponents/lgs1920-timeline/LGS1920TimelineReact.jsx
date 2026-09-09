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
 * Last modified: 2026-09-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {useEffect, useRef} from 'react'
import {LGS1920Timeline} from './LGS1920Timeline'

const EVENT_CALLBACKS = [
    ['before-play', 'onBeforePlay'],
    ['play', 'onPlay'],
    ['after-play', 'onAfterPlay'],
    ['before-pause', 'onBeforePause'],
    ['pause', 'onPause'],
    ['after-pause', 'onAfterPause'],
    ['before-stop', 'onBeforeStop'],
    ['stop', 'onStop'],
    ['after-stop', 'onAfterStop'],
    ['before-restart', 'onBeforeRestart'],
    ['restart', 'onRestart'],
    ['after-restart', 'onAfterRestart'],
    ['before-seek', 'onBeforeSeek'],
    ['seek', 'onSeek'],
    ['after-seek', 'onAfterSeek'],
    ['before-track-visibility-change', 'onBeforeTrackVisibilityChange'],
    ['track-visibility-change', 'onTrackVisibilityChange'],
    ['after-track-visibility-change', 'onAfterTrackVisibilityChange'],
    ['before-dblclick', 'onBeforeDblClick'],
    ['dblclick', 'onDblClick'],
    ['after-dblclick', 'onAfterDblClick'],
    ['before-add-clip', 'onBeforeAddClip'],
    ['add-clip', 'onAddClip'],
    ['after-add-clip', 'onAfterAddClip'],
    ['before-add-track', 'onBeforeAddTrack'],
    ['add-track', 'onAddTrack'],
    ['after-add-track', 'onAfterAddTrack'],
    ['before-remove-track', 'onBeforeRemoveTrack'],
    ['remove-track', 'onRemoveTrack'],
    ['after-remove-track', 'onAfterRemoveTrack'],
    ['before-remove-clip', 'onBeforeRemoveClip'],
    ['remove-clip', 'onRemoveClip'],
    ['after-remove-clip', 'onAfterRemoveClip'],
    ['before-reorder', 'onBeforeReorder'],
    ['reorder', 'onReorder'],
    ['after-reorder', 'onAfterReorder'],
    ['before-track-label-change', 'onBeforeTrackLabelChange'],
    ['track-label-change', 'onTrackLabelChange'],
    ['after-track-label-change', 'onAfterTrackLabelChange'],
    ['before-clip-change', 'onBeforeClipChange'],
    ['clip-change-start', 'onClipChangeStart'],
    ['clip-changing', 'onClipChanging'],
    ['clip-change', 'onClipChange'],
    ['after-clip-change', 'onAfterClipChange'],
    ['before-clip-visibility-change', 'onBeforeClipVisibilityChange'],
    ['clip-visibility-change', 'onClipVisibilityChange'],
    ['after-clip-visibility-change', 'onAfterClipVisibilityChange'],
    ['before-clip-extend', 'onBeforeClipExtend'],
    ['clip-extend', 'onClipExtend'],
    ['after-clip-extend', 'onAfterClipExtend'],
    ['before-clip-color-change', 'onBeforeClipColorChange'],
    ['clip-color-change', 'onClipColorChange'],
    ['after-clip-color-change', 'onAfterClipColorChange'],
    ['clip-select', 'onClipSelect'],
    ['before-clip-action', 'onBeforeClipAction'],
    ['clip-action', 'onClipAction'],
    ['after-clip-action', 'onAfterClipAction'],
    ['before-drag', 'onBeforeDrag'],
    ['drag', 'onDrag'],
    ['after-drag', 'onAfterDrag'],
    ['before-range-change', 'onBeforeRangeChange'],
    ['range-change-start', 'onRangeChangeStart'],
    ['range-changing', 'onRangeChanging'],
    ['range-change', 'onRangeChange'],
    ['after-range-change', 'onAfterRangeChange'],
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
 * @param {Array|null} [props.clipOptions=null] - Clip insertion options, or null for the generic option.
 * @param {Function} [props.onPlay] - Play callback receiving event detail.
 * @param {Function} [props.onBeforePlay] - Cancelable play request callback.
 * @param {Function} [props.onAfterPlay] - Play completion callback.
 * @param {Function} [props.onPause] - Pause callback receiving event detail.
 * @param {Function} [props.onBeforePause] - Cancelable pause request callback.
 * @param {Function} [props.onAfterPause] - Pause completion callback.
 * @param {Function} [props.onStop] - Stop callback receiving event detail.
 * @param {Function} [props.onBeforeStop] - Cancelable stop request callback.
 * @param {Function} [props.onAfterStop] - Stop completion callback.
 * @param {Function} [props.onRestart] - Restart callback receiving event detail.
 * @param {Function} [props.onBeforeRestart] - Cancelable restart request callback.
 * @param {Function} [props.onAfterRestart] - Restart completion callback.
 * @param {Function} [props.onSeek] - Seek callback receiving event detail.
 * @param {Function} [props.onBeforeSeek] - Cancelable seek request callback.
 * @param {Function} [props.onAfterSeek] - Seek completion callback.
 * @param {Function} [props.onTrackVisibilityChange] - Track visibility callback.
 * @param {Function} [props.onBeforeTrackVisibilityChange] - Cancelable track visibility callback.
 * @param {Function} [props.onAfterTrackVisibilityChange] - Track visibility completion callback.
 * @param {Function} [props.onDblClick] - Clip double-click callback.
 * @param {Function} [props.onBeforeDblClick] - Cancelable clip double-click callback.
 * @param {Function} [props.onAfterDblClick] - Clip double-click completion callback.
 * @param {Function} [props.onAddClip] - Clip insertion callback.
 * @param {Function} [props.onBeforeAddClip] - Cancelable clip insertion callback.
 * @param {Function} [props.onAfterAddClip] - Clip insertion completion callback.
 * @param {Function} [props.onBeforeRemoveClip] - Cancelable clip removal request callback.
 * @param {Function} [props.onRemoveClip] - Committed clip removal callback.
 * @param {Function} [props.onAfterRemoveClip] - Clip removal completion callback.
 * @param {Function} [props.onAddTrack] - Track creation callback.
 * @param {Function} [props.onBeforeAddTrack] - Cancelable track creation callback.
 * @param {Function} [props.onAfterAddTrack] - Track creation completion callback.
 * @param {Function} [props.onRemoveTrack] - Track removal callback.
 * @param {Function} [props.onBeforeRemoveTrack] - Cancelable track removal callback.
 * @param {Function} [props.onAfterRemoveTrack] - Track removal completion callback.
 * @param {Function} [props.onReorder] - Track reorder callback.
 * @param {Function} [props.onBeforeReorder] - Cancelable track reorder callback.
 * @param {Function} [props.onAfterReorder] - Track reorder completion callback.
 * @param {Function} [props.onTrackLabelChange] - Track label callback.
 * @param {Function} [props.onBeforeTrackLabelChange] - Cancelable track label callback.
 * @param {Function} [props.onAfterTrackLabelChange] - Track label completion callback.
 * @param {Function} [props.onClipChangeStart] - Clip edit start callback.
 * @param {Function} [props.onBeforeClipChange] - Cancelable clip edit callback.
 * @param {Function} [props.onClipChanging] - Live clip edit callback.
 * @param {Function} [props.onClipChange] - Committed clip edit callback.
 * @param {Function} [props.onAfterClipChange] - Clip edit completion callback.
 * @param {Function} [props.onBeforeClipVisibilityChange] - Cancelable clip visibility callback.
 * @param {Function} [props.onClipVisibilityChange] - Clip visibility callback.
 * @param {Function} [props.onAfterClipVisibilityChange] - Clip visibility completion callback.
 * @param {Function} [props.onBeforeClipExtend] - Cancelable clip extension callback.
 * @param {Function} [props.onClipExtend] - Clip extension callback.
 * @param {Function} [props.onAfterClipExtend] - Clip extension completion callback.
 * @param {Function} [props.onBeforeClipColorChange] - Cancelable clip color callback.
 * @param {Function} [props.onClipColorChange] - Clip color callback.
 * @param {Function} [props.onAfterClipColorChange] - Clip color completion callback.
 * @param {Function} [props.onClipSelect] - Clip selection callback.
 * @param {Function} [props.onBeforeClipAction] - Cancelable custom clip action callback.
 * @param {Function} [props.onClipAction] - Custom clip action callback.
 * @param {Function} [props.onAfterClipAction] - Custom clip action completion callback.
 * @param {Function} [props.onBeforeDrag] - Drag start callback.
 * @param {Function} [props.onDrag] - Live drag callback.
 * @param {Function} [props.onAfterDrag] - Drag completion callback.
 * @param {Function} [props.onRangeChangeStart] - Video range edit start callback.
 * @param {Function} [props.onBeforeRangeChange] - Cancelable video range edit callback.
 * @param {Function} [props.onRangeChanging] - Live video range edit callback.
 * @param {Function} [props.onRangeChange] - Committed video range edit callback.
 * @param {Function} [props.onAfterRangeChange] - Video range edit completion callback.
 * @param {React.ReactNode} [props.children] - Slotted Web Component children.
 * @returns {JSX.Element} Web Component React adapter.
 */
export const LGS1920TimelineReact = ({
    timeline = {},
    tracks = [],
    currentTimeMillis = 0,
    playing = false,
    clipOptions = null,
    onBeforePlay,
    onPlay,
    onAfterPlay,
    onBeforePause,
    onPause,
    onAfterPause,
    onBeforeStop,
    onStop,
    onAfterStop,
    onBeforeRestart,
    onRestart,
    onAfterRestart,
    onBeforeSeek,
    onSeek,
    onAfterSeek,
    onBeforeTrackVisibilityChange,
    onTrackVisibilityChange,
    onAfterTrackVisibilityChange,
    onBeforeDblClick,
    onDblClick,
    onAfterDblClick,
    onBeforeAddClip,
    onAddClip,
    onAfterAddClip,
    onBeforeAddTrack,
    onBeforeRemoveClip,
    onRemoveClip,
    onAfterRemoveClip,
    onAddTrack,
    onAfterAddTrack,
    onBeforeRemoveTrack,
    onRemoveTrack,
    onAfterRemoveTrack,
    onBeforeReorder,
    onReorder,
    onAfterReorder,
    onBeforeTrackLabelChange,
    onTrackLabelChange,
    onAfterTrackLabelChange,
    onBeforeClipChange,
    onClipChangeStart,
    onClipChanging,
    onClipChange,
    onAfterClipChange,
    onBeforeClipVisibilityChange,
    onClipVisibilityChange,
    onAfterClipVisibilityChange,
    onBeforeClipExtend,
    onClipExtend,
    onAfterClipExtend,
    onBeforeClipColorChange,
    onClipColorChange,
    onAfterClipColorChange,
    onClipSelect,
    onBeforeClipAction,
    onClipAction,
    onAfterClipAction,
    onBeforeDrag,
    onDrag,
    onAfterDrag,
    onBeforeRangeChange,
    onRangeChangeStart,
    onRangeChanging,
    onRangeChange,
    onAfterRangeChange,
    children,
}) => {
    const _element = useRef(null)

    useEffect(() => {
        const element = _element.current
        if (!element) return
        element.timeline = timeline
        element.tracks = tracks
        element.clipOptions = clipOptions
    }, [clipOptions, timeline, tracks])

    useEffect(() => {
        const element = _element.current
        if (!element) return
        element.currentTimeMillis = currentTimeMillis
    }, [currentTimeMillis])

    useEffect(() => {
        const element = _element.current
        if (!element) return
        element.playing = playing
    }, [playing])

    useEffect(() => {
        const element = _element.current
        if (!element) return undefined
        const callbacks = {
            onBeforePlay,
            onPlay,
            onAfterPlay,
            onBeforePause,
            onPause,
            onAfterPause,
            onBeforeStop,
            onStop,
            onAfterStop,
            onBeforeRestart,
            onRestart,
            onAfterRestart,
            onBeforeSeek,
            onSeek,
            onAfterSeek,
            onBeforeTrackVisibilityChange,
            onTrackVisibilityChange,
            onAfterTrackVisibilityChange,
            onBeforeDblClick,
            onDblClick,
            onAfterDblClick,
            onBeforeAddClip,
            onAddClip,
            onAfterAddClip,
            onBeforeAddTrack,
            onBeforeRemoveClip,
            onRemoveClip,
            onAfterRemoveClip,
            onAddTrack,
            onAfterAddTrack,
            onBeforeRemoveTrack,
            onRemoveTrack,
            onAfterRemoveTrack,
            onBeforeReorder,
            onReorder,
            onAfterReorder,
            onBeforeTrackLabelChange,
            onTrackLabelChange,
            onAfterTrackLabelChange,
            onBeforeClipChange,
            onClipChangeStart,
            onClipChanging,
            onClipChange,
            onAfterClipChange,
            onBeforeClipVisibilityChange,
            onClipVisibilityChange,
            onAfterClipVisibilityChange,
            onBeforeClipExtend,
            onClipExtend,
            onAfterClipExtend,
            onBeforeClipColorChange,
            onClipColorChange,
            onAfterClipColorChange,
            onClipSelect,
            onBeforeClipAction,
            onClipAction,
            onAfterClipAction,
            onBeforeDrag,
            onDrag,
            onAfterDrag,
            onBeforeRangeChange,
            onRangeChangeStart,
            onRangeChanging,
            onRangeChange,
            onAfterRangeChange,
        }
        const listeners = EVENT_CALLBACKS.map(([name, propName]) => {
            const listener = event => callbacks[propName]?.(event.detail, event)
            element.addEventListener(`lgs1920-timeline-${name}`, listener)
            return {name, listener}
        })
        return () => listeners.forEach(({name, listener}) => element.removeEventListener(`lgs1920-timeline-${name}`, listener))
    }, [onAddClip, onAddTrack, onAfterAddClip, onAfterAddTrack, onAfterClipAction, onAfterClipChange, onAfterClipColorChange, onAfterClipExtend, onAfterClipVisibilityChange, onAfterDblClick, onAfterDrag, onAfterPause, onAfterPlay, onAfterRemoveClip, onAfterRemoveTrack, onAfterReorder, onAfterRestart, onAfterRangeChange, onAfterSeek, onAfterStop, onAfterTrackLabelChange, onAfterTrackVisibilityChange, onBeforeAddClip, onBeforeAddTrack, onBeforeClipAction, onBeforeClipChange, onBeforeClipColorChange, onBeforeClipExtend, onBeforeClipVisibilityChange, onBeforeDblClick, onBeforeDrag, onBeforePause, onBeforePlay, onBeforeRemoveClip, onBeforeRemoveTrack, onBeforeReorder, onBeforeRestart, onBeforeSeek, onBeforeStop, onBeforeTrackLabelChange, onBeforeTrackVisibilityChange, onBeforeRangeChange, onClipAction, onClipChange, onClipChangeStart, onClipChanging, onClipColorChange, onClipExtend, onClipSelect, onClipVisibilityChange, onDblClick, onDrag, onPause, onPlay, onRangeChange, onRangeChangeStart, onRangeChanging, onRemoveClip, onRemoveTrack, onReorder, onRestart, onSeek, onStop, onTrackLabelChange, onTrackVisibilityChange])

    return (
        <lgs1920-timeline ref={_element}>
            {children}
        </lgs1920-timeline>
    )
}

LGS1920TimelineReact.displayName = 'LGS1920TimelineReact'

export {LGS1920Timeline}
