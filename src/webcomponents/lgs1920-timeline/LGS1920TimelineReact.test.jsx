// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineReact.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, render} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/components/button/button.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/card/card.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/color-picker/color-picker.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/icon.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/input/input.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/popup/popup.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/split-panel/split-panel.js', () => ({}))

import {LGS1920TimelineReact} from './LGS1920TimelineReact'

const timelineConfig = {
    durationMillis: 5_000,
    visible: true,
}

const tracks = []

afterEach(() => cleanup())

describe('LGS1920TimelineReact', () => {
    it('bridges controlled state, slots, and Web Component events', () => {
        const onSeek = vi.fn()
        const onDblClick = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                timeline={timelineConfig}
                tracks={tracks}
                currentTimeMillis={0}
                playing={false}
                clipOptions={[]}
                onSeek={onSeek}
                onDblClick={onDblClick}>
                <span slot="header">React header</span>
            </LGS1920TimelineReact>,
        )
        const element = container.querySelector('lgs1920-timeline')
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-seek', {
            bubbles: true,
            composed: true,
            detail: {timeMillis: 1_000},
        }))

        expect(element.shadowRoot.querySelector('slot[name="header"]').assignedElements()[0].textContent).toBe('React header')
        expect(onSeek).toHaveBeenCalledOnce()
        expect(onSeek.mock.calls[0][0].timeMillis).toBe(1_000)

        element.dispatchEvent(new CustomEvent('lgs1920-timeline-dblclick', {
            bubbles: true,
            composed: true,
            detail: {clip: {id: 'clip#001'}},
        }))

        expect(onDblClick).toHaveBeenCalledOnce()
        expect(onDblClick.mock.calls[0][0].clip.id).toBe('clip#001')
    })

    it('forwards clip double-click events to the React callback', () => {
        const onClipDoubleClick = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                timeline={timelineConfig}
                onClipDoubleClick={onClipDoubleClick}/>,
        )
        const element = container.querySelector('lgs1920-timeline')
        const detail = {clip: {id: 'clip#001'}, context: {type: 'clip', clipId: 'clip#001'}}
        const event = new CustomEvent('lgs1920-timeline-dblclick', {detail})
        element.dispatchEvent(event)

        expect(onClipDoubleClick).toHaveBeenCalledWith(detail, event)
    })

    it('maps clip editing events to React callbacks', () => {
        const onClipChangeStart = vi.fn()
        const onClipChanging = vi.fn()
        const onClipChange = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                timeline={timelineConfig}
                tracks={tracks}
                onClipChangeStart={onClipChangeStart}
                onClipChanging={onClipChanging}
                onClipChange={onClipChange}/>,
        )
        const element = container.querySelector('lgs1920-timeline')
        const detail = {clipId: 'clip#001', type: 'resize', edge: 'end'}
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-clip-change-start', {detail}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-clip-changing', {detail}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-clip-change', {detail}))

        expect(onClipChangeStart).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
        expect(onClipChanging).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
        expect(onClipChange).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
    })

    it('maps clip context-menu events to React callbacks', () => {
        const onClipVisibilityChange = vi.fn()
        const onClipExtend = vi.fn()
        const onClipColorChange = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                timeline={timelineConfig}
                onClipVisibilityChange={onClipVisibilityChange}
                onClipExtend={onClipExtend}
                onClipColorChange={onClipColorChange}/>,
        )
        const element = container.querySelector('lgs1920-timeline')
        const details = {
            visibility: {clipId: 'clip#001', visible: false},
            extend: {clipId: 'clip#001', start: 0, end: 2},
            color: {clipId: 'clip#001', timelineColor: 'red'},
        }
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-clip-visibility-change', {detail: details.visibility}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-clip-extend', {detail: details.extend}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-clip-color-change', {detail: details.color}))

        expect(onClipVisibilityChange).toHaveBeenCalledWith(details.visibility, expect.any(CustomEvent))
        expect(onClipExtend).toHaveBeenCalledWith(details.extend, expect.any(CustomEvent))
        expect(onClipColorChange).toHaveBeenCalledWith(details.color, expect.any(CustomEvent))
    })

    it('bridges track creation and removal events', () => {
        const onAddTrack = vi.fn()
        const onRemoveTrack = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                timeline={timelineConfig}
                onAddTrack={onAddTrack}
                onRemoveTrack={onRemoveTrack}/>,
        )
        const element = container.querySelector('lgs1920-timeline')
        const addDetail = {key: 'widget', trackId: 'widget#one'}
        const removeDetail = {trackId: 'widget#one'}
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-add-track', {detail: addDetail}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-remove-track', {detail: removeDetail}))

        expect(onAddTrack).toHaveBeenCalledWith(addDetail, expect.any(CustomEvent))
        expect(onRemoveTrack).toHaveBeenCalledWith(removeDetail, expect.any(CustomEvent))
    })

    it('maps clip removal events to React callbacks', () => {
        const onBeforeRemoveClip = vi.fn()
        const onRemoveClip = vi.fn()
        const onAfterRemoveClip = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                timeline={timelineConfig}
                onBeforeRemoveClip={onBeforeRemoveClip}
                onRemoveClip={onRemoveClip}
                onAfterRemoveClip={onAfterRemoveClip}/>,
        )
        const element = container.querySelector('lgs1920-timeline')
        const detail = {clipId: 'clip#001', trackId: 'track#one'}
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-before-remove-clip', {detail}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-remove-clip', {detail}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-after-remove-clip', {detail}))

        expect(onBeforeRemoveClip).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
        expect(onRemoveClip).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
        expect(onAfterRemoveClip).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
    })

    it('maps the track and clip drag lifecycle to React callbacks', () => {
        const onBeforeDrag = vi.fn()
        const onDrag = vi.fn()
        const onAfterDrag = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                timeline={timelineConfig}
                onBeforeDrag={onBeforeDrag}
                onDrag={onDrag}
                onAfterDrag={onAfterDrag}/>,
        )
        const element = container.querySelector('lgs1920-timeline')
        const details = [
            {context: {type: 'track', trackId: 'track#one'}},
            {context: {type: 'clip', trackId: 'track#one', clipId: 'clip#one'}},
            {context: {type: 'clip', trackId: 'track#two', clipId: 'clip#one'}, committed: true},
        ]
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-before-drag', {detail: details[0]}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-drag', {detail: details[1]}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-after-drag', {detail: details[2]}))

        expect(onBeforeDrag).toHaveBeenCalledWith(details[0], expect.any(CustomEvent))
        expect(onDrag).toHaveBeenCalledWith(details[1], expect.any(CustomEvent))
        expect(onAfterDrag).toHaveBeenCalledWith(details[2], expect.any(CustomEvent))
    })

    it('maps global video range events to React callbacks', () => {
        const onRangeChangeStart = vi.fn()
        const onRangeChanging = vi.fn()
        const onRangeChange = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                timeline={timelineConfig}
                tracks={tracks}
                onRangeChangeStart={onRangeChangeStart}
                onRangeChanging={onRangeChanging}
                onRangeChange={onRangeChange}/>,
        )
        const element = container.querySelector('lgs1920-timeline')
        const detail = {rangeStartMillis: 0, rangeEndMillis: 4_000}
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-range-change-start', {detail}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-range-changing', {detail}))
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-range-change', {detail}))

        expect(onRangeChangeStart).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
        expect(onRangeChanging).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
        expect(onRangeChange).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
    })

    it('maps the stop event to the React callback', () => {
        const onStop = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact timeline={timelineConfig} onStop={onStop}/>,
        )
        const element = container.querySelector('lgs1920-timeline')
        const detail = {source: 'timeline-stop', timeMillis: 1_000}
        element.dispatchEvent(new CustomEvent('lgs1920-timeline-stop', {detail}))

        expect(onStop).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
    })

    it('maps every canonical before and after lifecycle callback', () => {
        const lifecycle = [
            ['before-play', 'onBeforePlay'], ['after-play', 'onAfterPlay'],
            ['before-pause', 'onBeforePause'], ['after-pause', 'onAfterPause'],
            ['before-stop', 'onBeforeStop'], ['after-stop', 'onAfterStop'],
            ['before-restart', 'onBeforeRestart'], ['after-restart', 'onAfterRestart'],
            ['before-seek', 'onBeforeSeek'], ['after-seek', 'onAfterSeek'],
            ['before-track-visibility-change', 'onBeforeTrackVisibilityChange'],
            ['after-track-visibility-change', 'onAfterTrackVisibilityChange'],
            ['before-dblclick', 'onBeforeDblClick'], ['after-dblclick', 'onAfterDblClick'],
            ['before-add-clip', 'onBeforeAddClip'], ['after-add-clip', 'onAfterAddClip'],
            ['before-add-track', 'onBeforeAddTrack'], ['after-add-track', 'onAfterAddTrack'],
            ['before-remove-track', 'onBeforeRemoveTrack'], ['after-remove-track', 'onAfterRemoveTrack'],
            ['before-reorder', 'onBeforeReorder'], ['after-reorder', 'onAfterReorder'],
            ['before-track-label-change', 'onBeforeTrackLabelChange'],
            ['after-track-label-change', 'onAfterTrackLabelChange'],
            ['before-clip-change', 'onBeforeClipChange'], ['after-clip-change', 'onAfterClipChange'],
            ['before-range-change', 'onBeforeRangeChange'], ['after-range-change', 'onAfterRangeChange'],
        ]
        const callbacks = Object.fromEntries(lifecycle.map(([, propName]) => [propName, vi.fn()]))
        const {container} = render(<LGS1920TimelineReact timeline={timelineConfig} {...callbacks}/>)
        const element = container.querySelector('lgs1920-timeline')

        lifecycle.forEach(([name, propName]) => {
            const detail = {name}
            element.dispatchEvent(new CustomEvent(`lgs1920-timeline-${name}`, {detail}))
            expect(callbacks[propName]).toHaveBeenCalledWith(detail, expect.any(CustomEvent))
        })
    })
})
