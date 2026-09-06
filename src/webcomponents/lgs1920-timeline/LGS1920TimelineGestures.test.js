// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920TimelineGestures.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-06
 * Last modified: 2026-09-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/components/button/button.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/card/card.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/color-picker/color-picker.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/icon.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/input/input.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/popup/popup.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/split-panel/split-panel.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/tooltip/tooltip.js', () => ({}))

import {LGS1920Timeline} from './LGS1920Timeline'

const timelineState = {
    durationMillis: 10_000,
    tracks: [
        {
            id: 'main#one',
            label: 'Main track',
            icon: 'film',
            colorClasses: ['wa-neutral', 'wa-neutral-blue'],
            canHide: true,
            clips: [{id: 'clip-one', kind: 'video', label: 'Opening clip', start: 1, end: 4}],
        },
        {
            id: 'camera',
            label: 'Camera',
            icon: 'video',
            colorClasses: ['wa-neutral', 'wa-neutral-green'],
            fixed: true,
            movable: false,
            clips: [{id: 'camera-clip', kind: 'video', label: 'Camera clip', start: 0, end: 1}],
        },
    ],
}

/** Apply controlled timeline properties for an interaction test. */
const configureTimeline = (timeline, options = {}) => {
    timeline.timeline = {
        durationMillis: timelineState.durationMillis,
        visible: true,
        ...(options.timeline ?? {}),
    }
    timeline.tracks = options.tracks ?? timelineState.tracks
    timeline.currentTimeMillis = options.currentTimeMillis ?? 0
    timeline.playing = options.playing ?? false
    timeline.clipOptions = options.clipOptions ?? []
}

/** Create a pointer event with an explicit pointer identifier. */
const createPointerEvent = (type, options = {}) => {
    const event = new MouseEvent(type, {bubbles: true, cancelable: true, button: 0, ...options})
    Object.defineProperty(event, 'pointerId', {value: options.pointerId ?? 1})
    return event
}

afterEach(() => document.body.replaceChildren())

/** Mount a timeline with one clip and a stable measured surface. */
const mount = (config = {}) => {
    const timeline = new LGS1920Timeline()
    configureTimeline(timeline, {
        timeline: {snap: false, ...config},
        tracks: [
            {id: 'source', clips: [{id: 'clip', start: 1, end: 4}]},
            {id: 'target', clips: [{id: 'blocker', start: 5, end: 8}]},
        ],
    })
    document.body.append(timeline)
    const surface = timeline.shadowRoot.querySelector('[data-surface]')
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 900, bottom: 200, width: 900})
    return timeline
}

/** Dispatch a pointer gesture step at a timeline coordinate. */
const pointer = (type, x, y = 50, pointerId = 1) => window.dispatchEvent(
    createPointerEvent(type, {clientX: x, clientY: y, pointerId}),
)

/** Begin a clip-body drag at its current visual start. */
const begin = (timeline, x = 60) => timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
    .dispatchEvent(createPointerEvent('pointerdown', {clientX: x, clientY: 50}))

describe('timeline gesture integrity', () => {
    it('keeps a committed extension through another move and an Escape cancellation', () => {
        const timeline = mount()
        begin(timeline)
        pointer('pointermove', 500)
        pointer('pointerup', 500)
        expect(timeline.timeline.durationMillis).toBe(15_000)
        expect(timeline.timeline.rangeEndMillis).toBe(15_000)

        begin(timeline, 500)
        pointer('pointermove', 460)
        pointer('pointerup', 460)
        expect(timeline.timeline.durationMillis).toBe(15_000)
        expect(timeline.tracks[0].clips[0]).toMatchObject({start: 11, end: 14})

        begin(timeline, 460)
        pointer('pointermove', 740)
        expect(timeline.timeline.durationMillis).toBe(21_000)
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))
        expect(timeline.timeline.durationMillis).toBe(15_000)
        expect(timeline.timeline.rangeEndMillis).toBe(15_000)
        expect(timeline.tracks[0].clips[0]).toMatchObject({start: 11, end: 14})
    })

    it('rolls back a valid preview when released over an occupied track', () => {
        const timeline = mount()
        const changes = vi.fn()
        const after = vi.fn()
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        timeline.addEventListener('lgs1920-timeline-after-clip-change', after)
        begin(timeline)
        pointer('pointermove', 100)
        pointer('pointermove', 220, 70)
        pointer('pointerup', 220, 70)
        expect(changes).not.toHaveBeenCalled()
        expect(after.mock.calls[0][0].detail.committed).toBe(false)
        expect(timeline.tracks[0].clips[0]).toMatchObject({start: 1, end: 4})
        expect(timeline.timeline.rangeEndMillis).toBe(10_000)
    })

    it('uses release coordinates even when no final pointermove arrives', () => {
        const timeline = mount()
        begin(timeline)
        pointer('pointermove', 220, 70)
        pointer('pointerup', 100, 70)
        expect(timeline.tracks[0].clips).toEqual([])
        expect(timeline.tracks[1].clips[0]).toMatchObject({id: 'clip', start: 2, end: 5})
    })

    it('ignores another pointer ending while a clip drag is active', () => {
        const timeline = mount()
        const changes = vi.fn()
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        begin(timeline)
        pointer('pointermove', 100)
        pointer('pointerup', 100, 50, 2)
        expect(changes).not.toHaveBeenCalled()
        pointer('pointermove', 140)
        pointer('pointerup', 140)
        expect(changes).toHaveBeenCalledOnce()
        expect(timeline.tracks[0].clips[0]).toMatchObject({start: 3, end: 6})
    })

    it('reorders tracks against their content positions in a scrolled legend', () => {
        const timeline = mount()
        timeline.tracks = Array.from({length: 20}, (_, index) => ({id: 'row-' + index, label: 'Row ' + index, clips: []}))
        const legend = timeline.shadowRoot.querySelector('[part="legend-viewport"]')
        vi.spyOn(legend, 'getBoundingClientRect').mockReturnValue({top: 0, bottom: 100, height: 100})
        legend.scrollTop = 120
        const label = timeline.shadowRoot.querySelector('slot[name="track-label-row-5"]')
        label.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 12}))
        pointer('pointermove', 10, 60)
        pointer('pointerup', 10, 60)
        expect(timeline.tracks.findIndex(track => track.id === 'row-5')).toBe(8)
    })

    it('does not extend a user-selected playback range', () => {
        const timeline = mount({rangeEndMillis: 8_000})
        begin(timeline)
        pointer('pointerup', 500)
        expect(timeline.timeline.durationMillis).toBe(15_000)
        expect(timeline.timeline.rangeEndMillis).toBe(8_000)
    })

    it('clamps a move to an explicitly fixed timeline while preserving clip duration', () => {
        const timeline = mount({durationPolicy: 'fixed'})
        begin(timeline)
        pointer('pointerup', 500)
        expect(timeline.timeline.durationMillis).toBe(10_000)
        expect(timeline.tracks[0].clips[0]).toMatchObject({start: 7, end: 10})
    })

    it('does not change range or duration when an extending keyboard resize is vetoed', () => {
        const timeline = mount({keyboardStepSeconds: 10})
        timeline.addEventListener('lgs1920-timeline-before-clip-change', event => event.preventDefault())
        timeline.shadowRoot.querySelector('[data-clip-id="clip"] [data-clip-handle="end"]')
            .dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))
        expect(timeline.timeline.durationMillis).toBe(10_000)
        expect(timeline.timeline.rangeEndMillis).toBe(10_000)
        expect(timeline.tracks[0].clips[0]).toMatchObject({start: 1, end: 4})
    })
})
