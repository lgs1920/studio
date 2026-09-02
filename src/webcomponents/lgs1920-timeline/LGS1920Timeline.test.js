// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920Timeline.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/components/button/button.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/button-group/button-group.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/card/card.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/icon.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/input/input.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/popup/popup.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/split-panel/split-panel.js', () => ({}))

import {LGS1920Timeline} from './LGS1920Timeline'
import {formatRulerTime} from './LGS1920TimelineUtils.js'

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

const createPointerEvent = (type, options = {}) => {
    const event = new MouseEvent(type, {bubbles: true, cancelable: true, button: 0, ...options})
    Object.defineProperty(event, 'pointerId', {value: options.pointerId ?? 1})
    return event
}

afterEach(() => document.body.replaceChildren())

describe('lgs1920-timeline Web Component', () => {
    it('formats ruler labels according to the timeline duration', () => {
        expect(formatRulerTime(0)).toBe('0')
        expect(formatRulerTime(3)).toBe('3')
        expect(formatRulerTime(16)).toBe('16')
        expect(formatRulerTime(63)).toBe('1:03')
        expect(formatRulerTime(603)).toBe('10:03')
        expect(formatRulerTime(3723)).toBe('1:02:03')
    })

    it('keeps the initial ruler wide enough for five seconds', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {durationMillis: 1_000}})
        document.body.append(timeline)

        expect(timeline.shadowRoot.querySelector('[data-surface] [part="canvas"]').style.width).toBe('260px')
    })

    it('renders inside Shadow DOM with named slots and CSS customization tokens', () => {
        const timeline = new LGS1920Timeline()
        const heading = document.createElement('span')
        heading.slot = 'header'
        heading.textContent = 'Custom timeline'
        const headerAction = document.createElement('wa-button')
        headerAction.slot = 'header-actions'
        const timelineAction = document.createElement('wa-button')
        timelineAction.slot = 'timeline-actions'
        timeline.append(heading, headerAction, timelineAction)
        timeline.style.setProperty('--lgs-timeline-playhead-color', 'rebeccapurple')
        configureTimeline(timeline)
        document.body.append(timeline)

        expect(customElements.get('lgs1920-timeline')).toBe(LGS1920Timeline)
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline"]').tagName).toBe('WA-CARD')
        expect(timeline.shadowRoot.querySelector('slot[name="header"]').assignedElements()).toEqual([heading])
        expect(timeline.shadowRoot.querySelector('slot[name="header-actions"]').assignedElements()).toEqual([headerAction])
        expect(timeline.shadowRoot.querySelector('slot[name="timeline-actions"]').assignedElements()).toEqual([timelineAction])
        expect(timeline.shadowRoot.querySelector('slot[name="footer"]')).not.toBeNull()
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__legend-row.wa-neutral-blue')).not.toBeNull()
        const blueClip = timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__clip.wa-neutral-blue')
        const greenLegendIcon = timeline.shadowRoot.querySelector('[data-row-id="camera"] .lgs1920-wa-timeline__icon-frame')
        expect(blueClip).not.toBeNull()
        expect(blueClip.style.backgroundColor).toBe('var(--wa-color-blue-50)')
        expect(blueClip.style.borderColor).toBe('var(--wa-color-blue-60)')
        expect(blueClip.querySelector('slot[name="clip-icon-clip-one"]')).not.toBeNull()
        expect(blueClip.querySelector('slot[name="clip-icon-clip-one"] wa-icon').getAttribute('name')).toBe('film')
        expect(blueClip.style.getPropertyValue('--lgs-timeline-clip-handle-color'))
            .toContain('var(--wa-color-blue-on)')
        expect(greenLegendIcon).toBeNull()
        expect(timeline.shadowRoot.querySelectorAll('[data-clip-handle]')).toHaveLength(4)
        expect(timeline.style.getPropertyValue('--lgs-timeline-playhead-color')).toBe('rebeccapurple')
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')).not.toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="legend"]')).not.toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="surface"]').closest('wa-card')).not.toBeNull()
        expect(timeline.shadowRoot.querySelectorAll('[data-scroll-view="surface"] ~ [data-scrollbar-track]')).toHaveLength(2)
        expect(timeline.shadowRoot.querySelectorAll('[data-scrollbar-shell="legend"] [data-scrollbar-track]')).toHaveLength(1)
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__legend-rows').style.transform).toBe('')
    })

    it('synchronizes the title and track vertical scroll views in both directions', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {currentTimeMillis: 1_000})
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
        const legend = timeline.shadowRoot.querySelector('[data-scroll-view="legend"]')
        const tracksViewport = timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')
        Object.defineProperties(tracksViewport, {
            clientHeight: {configurable: true, value: 100},
            scrollHeight: {configurable: true, value: 300},
        })
        Object.defineProperties(surface, {
            clientWidth: {configurable: true, value: 100},
            scrollWidth: {configurable: true, value: 300},
        })
        const verticalTrack = timeline.shadowRoot.querySelector('[data-scrollbar-shell="surface"] [data-scrollbar-track="vertical"]')
        const horizontalTrack = timeline.shadowRoot.querySelector('[data-scrollbar-shell="surface"] [data-scrollbar-track="horizontal"]')
        Object.defineProperties(verticalTrack, {clientHeight: {configurable: true, value: 100}})
        Object.defineProperties(horizontalTrack, {clientWidth: {configurable: true, value: 100}})
        Object.defineProperty(tracksViewport, 'scrollTop', {configurable: true, writable: true, value: 24})
        tracksViewport.dispatchEvent(new Event('scroll'))
        expect(legend.scrollTop).toBe(24)
        expect(verticalTrack.hidden).toBe(false)
        expect(verticalTrack.querySelector('[data-scrollbar-thumb]').style.height).toBe('34px')
        expect(horizontalTrack.hidden).toBe(false)

        Object.defineProperty(legend, 'scrollTop', {configurable: true, writable: true, value: 48})
        legend.dispatchEvent(new Event('scroll'))
        expect(tracksViewport.scrollTop).toBe(48)
    })

    it('auto-hides inactive scrollbar rails using the CSS-configured delay', () => {
        vi.useFakeTimers()
        try {
            const timeline = new LGS1920Timeline()
            timeline.style.setProperty('--lgs-timeline-scrollbar-auto-hide-delay', '250ms')
            configureTimeline(timeline)
            document.body.append(timeline)

            const shells = [...timeline.shadowRoot.querySelectorAll('[data-scrollbar-shell]')]
            const tracksViewport = timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')
            expect(shells.every(shell => !shell.classList.contains('lgs1920-wa-timeline__scroll-shell--idle'))).toBe(true)

            vi.advanceTimersByTime(249)
            expect(shells.every(shell => !shell.classList.contains('lgs1920-wa-timeline__scroll-shell--idle'))).toBe(true)
            vi.advanceTimersByTime(1)
            expect(shells.every(shell => shell.classList.contains('lgs1920-wa-timeline__scroll-shell--idle'))).toBe(true)

            tracksViewport.dispatchEvent(new Event('scroll'))
            expect(shells.every(shell => !shell.classList.contains('lgs1920-wa-timeline__scroll-shell--idle'))).toBe(true)
            vi.advanceTimersByTime(250)
            expect(shells.every(shell => shell.classList.contains('lgs1920-wa-timeline__scroll-shell--idle'))).toBe(true)
        } finally {
            vi.useRealTimers()
        }
    })

    it('keeps scrollbar rails visible during external gestures', () => {
        vi.useFakeTimers()
        try {
            const timeline = new LGS1920Timeline()
            timeline.style.setProperty('--lgs-timeline-scrollbar-auto-hide-delay', '250ms')
            configureTimeline(timeline)
            document.body.append(timeline)

            const shells = [...timeline.shadowRoot.querySelectorAll('[data-scrollbar-shell]')]
            timeline.setScrollbarsInteractionActive(true)
            vi.advanceTimersByTime(1_000)
            expect(shells.every(shell => !shell.classList.contains('lgs1920-wa-timeline__scroll-shell--idle'))).toBe(true)

            timeline.setScrollbarsInteractionActive(false)
            vi.advanceTimersByTime(250)
            expect(shells.every(shell => shell.classList.contains('lgs1920-wa-timeline__scroll-shell--idle'))).toBe(true)

        } finally {
            vi.useRealTimers()
        }
    })

    it('leaves split-panel repositioning to the native component', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const splitPanel = timeline.shadowRoot.querySelector('[part="split-panel"]')
        const layout = timeline.shadowRoot.querySelector('[data-layout]')
        const surface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
        const tracksViewport = timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')
        splitPanel.position = 35
        splitPanel.positionInPixels = 180
        splitPanel.dispatchEvent(new Event('wa-reposition'))

        expect(timeline.shadowRoot.querySelector('[part="split-panel"]')).toBe(splitPanel)
        expect(layout.style.getPropertyValue('--lgs-timeline-legend-width')).toBe('')
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')).toBe(surface)
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')).toBe(tracksViewport)

        timeline.setZoom(20)

        expect(timeline.shadowRoot.querySelector('[part="split-panel"]').position).toBe(35)
    })

    it('observes the timeline host instead of the split-panel surface', () => {
        const observe = vi.fn()
        class ResizeObserverMock {
            disconnect = vi.fn()
            observe = observe
        }
        vi.stubGlobal('ResizeObserver', ResizeObserverMock)
        try {
            const timeline = new LGS1920Timeline()
            configureTimeline(timeline)
            document.body.append(timeline)

            const surface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
            expect(observe).toHaveBeenCalledWith(timeline)
            expect(observe).not.toHaveBeenCalledWith(surface)
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('uses configurable minimum and maximum track title widths', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {
                legendMinWidth: 160,
                legendMaxWidth: 240,
            },
        })
        document.body.append(timeline)

        const splitPanel = timeline.shadowRoot.querySelector('[part="split-panel"]')
        const layout = timeline.shadowRoot.querySelector('[part="layout"]')
        expect(splitPanel.hasAttribute('position-in-pixels')).toBe(false)
        expect(splitPanel.style.getPropertyValue('--min')).toBe('160px')
        expect(splitPanel.style.getPropertyValue('--max')).toBe('min(240px, calc(100% - 160px))')
        expect(layout.style.getPropertyValue('--lgs-timeline-legend-width')).toBe('')
        expect(timeline.timeline.legendMinWidth).toBe(160)
        expect(timeline.timeline.legendMaxWidth).toBe(240)
    })

    it('updates playback state without rebuilding the scrollable track views', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
        const tracksViewport = timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')
        Object.defineProperty(surface, 'scrollLeft', {configurable: true, writable: true, value: 72})
        Object.defineProperty(tracksViewport, 'scrollTop', {configurable: true, writable: true, value: 36})

        timeline.currentTimeMillis = 1_000
        timeline.playing = true

        expect(timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')).toBe(surface)
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')).toBe(tracksViewport)
        expect(surface.scrollLeft).toBe(72)
        expect(tracksViewport.scrollTop).toBe(36)
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-play"]')
            .getAttribute('aria-label')).toBe('Pause timeline')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-play"] wa-icon')
            .getAttribute('name')).toBe('pause')
    })

    it('exposes the title-column ruler as a replaceable slot with a fallback', () => {
        const timeline = new LGS1920Timeline()
        const customRuler = document.createElement('div')
        customRuler.slot = 'legend-ruler'
        customRuler.textContent = 'Custom title ruler'
        timeline.append(customRuler)
        configureTimeline(timeline)
        document.body.append(timeline)

        const rulerSlot = timeline.shadowRoot.querySelector('slot[name="legend-ruler"]')
        expect(rulerSlot.assignedElements()).toEqual([customRuler])
        expect(timeline.shadowRoot.querySelector('[part="legend-ruler"]')).toBeNull()

        customRuler.remove()
        expect(rulerSlot.assignedElements()).toEqual([])
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__legend-ruler')).not.toBeNull()
    })

    it('renders the legend and surface as Web Awesome cards', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const splitPanel = timeline.shadowRoot.querySelector('[part="split-panel"]')
        const legend = splitPanel.querySelector('[slot="start"]')
        const surface = splitPanel.querySelector('[data-surface]')
        expect(legend.tagName).toBe('WA-CARD')
        expect(surface.tagName).toBe('WA-CARD')
        expect(legend.getAttribute('appearance')).toBe('plain')
        expect(surface.getAttribute('appearance')).toBe('plain')
    })

    it('fits row heights to the rendered timeline layout instead of the full host', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)
        const layout = timeline.shadowRoot.querySelector('[part="layout"]')
        vi.spyOn(layout, 'getBoundingClientRect').mockReturnValue({height: 300})

        timeline.handleResize()

        const renderedLayout = timeline.shadowRoot.querySelector('[part="layout"]')
        expect(renderedLayout.style.getPropertyValue('--lgs-timeline-row-height')).toBe('125px')
    })

    it('emits playback, seeking, track visibility, and clip events', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {currentTimeMillis: 1_000})
        document.body.append(timeline)
        const events = ['play', 'restart', 'seek', 'track-visibility-change', 'dblclick']
            .map(name => `lgs1920-timeline-${name}`)
        const listeners = Object.fromEntries(events.map(name => [name, vi.fn()]))
        events.forEach(name => timeline.addEventListener(name, listeners[name]))

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-play"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-restart"]').click()
        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, width: 1_000})
        surface.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 200}))
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-visibility"]').click()
        timeline.shadowRoot.querySelector('[data-clip-id="clip-one"]').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))

        expect(listeners['lgs1920-timeline-play']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-timeline-restart']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-timeline-seek']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-timeline-track-visibility-change']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-timeline-dblclick']).toHaveBeenCalledOnce()
        expect(timeline.shadowRoot.querySelector('[data-clip-id="clip-one"]')
            .classList.contains('lgs1920-wa-timeline__clip--track-hidden')).toBe(true)
        expect(timeline.shadowRoot.querySelectorAll('[data-row-id="main#one"] [data-clip-id]')).toHaveLength(1)
        expect(listeners['lgs1920-timeline-dblclick'].mock.calls[0][0].detail.context).toEqual({
            type: 'clip',
            pisteId: 'main#one',
            clipId: 'clip-one',
        })
    })

    it('marks every clip of a hidden track as track-hidden', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{
                id: 'hidden-track',
                label: 'Hidden track',
                canHide: true,
                clips: [
                    {id: 'hidden-one', label: 'One', start: 0, end: 1},
                    {id: 'hidden-two', label: 'Two', start: 1, end: 2},
                ],
            }],
        })
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-visibility"]').click()

        const clips = [...timeline.shadowRoot.querySelectorAll('[data-row-id="hidden-track"] [data-clip-id]')]
        expect(clips).toHaveLength(2)
        expect(clips.every(clip => clip.classList.contains('lgs1920-wa-timeline__clip--track-hidden'))).toBe(true)
    })

    it('renders icon transport controls and exposes the FPS slot', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {
                fps: 30,
                frameCount: 301,
                currentFrameIndex: 30,
            },
            currentTimeMillis: 1_000,
        })
        document.body.append(timeline)
        const restart = vi.fn()
        const seek = vi.fn()
        const play = vi.fn()
        const pause = vi.fn()
        const stop = vi.fn()
        timeline.addEventListener('lgs1920-timeline-restart', restart)
        timeline.addEventListener('lgs1920-timeline-seek', seek)
        timeline.addEventListener('lgs1920-timeline-play', play)
        timeline.addEventListener('lgs1920-timeline-pause', pause)
        timeline.addEventListener('lgs1920-timeline-stop', stop)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-restart"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-previous-frame"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-next-frame"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-end"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-play"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-stop"]').click()

        expect(restart.mock.calls[0][0].detail).toMatchObject({
            source: 'go-to-start',
            timeMillis: 0,
            settled: true,
        })
        expect(seek.mock.calls.map(([event]) => event.detail.source)).toEqual([
            'step-backward',
            'step-forward',
            'go-to-end',
        ])
        expect(seek.mock.calls[0][0].detail).toMatchObject({
            frameIndex: 29,
            frameIntervalMillis: 1000 / 30,
            timeMillis: 29 * (1000 / 30),
            settled: true,
        })
        expect(play).toHaveBeenCalledOnce()
        expect(pause).not.toHaveBeenCalled()
        expect(stop.mock.calls[0][0].detail).toMatchObject({
            source: 'timeline-stop',
            timeMillis: 1_000,
        })

        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-restart"] wa-icon').getAttribute('name'))
            .toBe('backward-step')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-end"] wa-icon').getAttribute('name'))
            .toBe('forward-step')

        expect(timeline.shadowRoot.querySelector('slot[name="additional-menu"]')).not.toBeNull()
        expect([...timeline.shadowRoot.querySelectorAll('[role="menuitem"]')]).toHaveLength(0)
    })

    it('keeps native mouse and pointer events inside the timeline host', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        const parentListener = vi.fn()
        const parent = document.createElement('div')
        parent.addEventListener('click', parentListener)
        parent.addEventListener('pointerdown', parentListener)
        parent.addEventListener('contextmenu', parentListener)
        parent.addEventListener('keydown', parentListener)
        parent.append(timeline)
        document.body.append(parent)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        surface.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}))
        surface.dispatchEvent(createPointerEvent('pointerdown', {composed: true}))
        surface.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, composed: true}))
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true, cancelable: true, composed: true}))
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true, composed: true}))

        expect(parentListener).not.toHaveBeenCalled()
    })

    it('keeps native split-panel pointer continuation events available', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const splitPanel = timeline.shadowRoot.querySelector('[part="split-panel"]')
        const divider = document.createElement('div')
        divider.setAttribute('part', 'divider')
        splitPanel.append(divider)
        const documentListener = vi.fn()
        document.addEventListener('pointermove', documentListener)

        try {
            divider.dispatchEvent(new MouseEvent('mousedown', {button: 0, bubbles: true, cancelable: true}))
            splitPanel.dispatchEvent(createPointerEvent('pointermove', {clientX: 160, bubbles: true, composed: true}))
            expect(documentListener).toHaveBeenCalledOnce()

            window.dispatchEvent(createPointerEvent('pointerup'))
            splitPanel.dispatchEvent(createPointerEvent('pointermove', {clientX: 180, bubbles: true, composed: true}))
            expect(documentListener).toHaveBeenCalledOnce()
        } finally {
            document.removeEventListener('pointermove', documentListener)
        }
    })


    it('preserves active external desktop and mobile gestures across the timeline host', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        const continuationTypes = [
            'mousemove',
            'mouseup',
            'pointermove',
            'pointerup',
            'pointercancel',
            'touchmove',
            'touchend',
            'touchcancel',
        ]
        const startTypes = ['mousedown', 'pointerdown', 'touchstart']
        const listeners = Object.fromEntries(
            [...continuationTypes, ...startTypes].map(eventType => [eventType, vi.fn()]),
        )
        const parent = document.createElement('div')
        Object.entries(listeners).forEach(([eventType, listener]) => parent.addEventListener(eventType, listener))
        parent.append(timeline)
        document.body.append(parent)
        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        const dispatch = eventType => surface.dispatchEvent(new Event(eventType, {
            bubbles: true,
            cancelable: true,
            composed: true,
        }))

        timeline.setExternalInteractionActive(true)
        continuationTypes.forEach(dispatch)
        startTypes.forEach(dispatch)

        continuationTypes.forEach(eventType => expect(listeners[eventType]).toHaveBeenCalledOnce())
        startTypes.forEach(eventType => expect(listeners[eventType]).not.toHaveBeenCalled())

        timeline.setExternalInteractionActive(false)
        continuationTypes.forEach(dispatch)

        continuationTypes.forEach(eventType => expect(listeners[eventType]).toHaveBeenCalledOnce())
    })

    it('renders display-only timelines without controls or interaction events', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {
                editable: false,
                interactive: false,
            },
            tracks: [{
                id: 'display-only',
                label: 'Display only',
                canHide: true,
                clips: [{id: 'display-only-clip', label: 'Clip', start: 0, end: 2}],
            }],
        })
        document.body.append(timeline)
        const events = ['play', 'restart', 'seek', 'track-visibility-change', 'dblclick']
        const listeners = Object.fromEntries(events.map(name => [name, vi.fn()]))
        events.forEach(name => timeline.addEventListener(`lgs1920-timeline-${name}`, listeners[name]))

        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-play"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-restart"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('tabindex')).toBe('-1')

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, width: 1_000})
        surface.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 200}))
        timeline.shadowRoot.querySelector('[data-clip-id="display-only-clip"]')
            .dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))

        Object.values(listeners).forEach(listener => expect(listener).not.toHaveBeenCalled())
    })

    it('supports global and contextual slots for repeated track and clip content', () => {
        const timeline = new LGS1920Timeline()
        const globalClipIcon = document.createElement('wa-icon')
        globalClipIcon.slot = 'clip-icon'
        globalClipIcon.setAttribute('name', 'film')
        const contextualLabel = document.createElement('span')
        contextualLabel.slot = 'track-label-main#one'
        contextualLabel.textContent = 'Custom main track'
        timeline.append(globalClipIcon, contextualLabel)
        configureTimeline(timeline)
        document.body.append(timeline)

        const row = timeline.shadowRoot.querySelector('[data-row-id="main#one"]')
        expect(row.querySelector('slot[name="track-label-main#one"]').assignedElements()).toEqual([contextualLabel])
        expect(row.querySelector('[part="legend-icon"]')).toBeNull()
        expect(row.querySelector('[part="track-actions"]')).not.toBeNull()
        expect(row.firstElementChild).toBe(row.querySelector('[part="track-actions"]'))
        expect(row.querySelector('slot[name="drag-trigger-main#one"]')).not.toBeNull()
        expect(row.querySelector('slot[name="visibility-main#one"]')).not.toBeNull()
        expect(row.querySelector('[part="visibility-placeholder"]')).toBeNull()

        const fixedRow = timeline.shadowRoot.querySelector('[data-row-id="camera"]')
        expect(fixedRow.querySelector('[part="visibility-placeholder"]')).not.toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-clip-id="clip-one"] slot[name="clip-icon-clip-one"]')).not.toBeNull()
    })

    it('accepts public timeline, track, clip, and insertion properties', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            currentTimeMillis: 2_000,
            clipOptions: [{group: 'media', key: 'video', label: 'Video clip'}],
        })
        document.body.append(timeline)

        expect(timeline.timeline.durationMillis).toBe(10_000)
        expect(timeline.tracks).toHaveLength(2)
        expect(timeline.tracks[0].clips).toEqual(timelineState.tracks[0].clips)
        expect(timeline.tracks[0].actions).toBeUndefined()
        expect(timeline.currentTimeMillis).toBe(2_000)
        expect(timeline.playing).toBe(false)
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]').click()
        const clipMenu = timeline.shadowRoot.querySelector('wa-popup')
        expect(clipMenu.getAttribute('anchor')).toBe('lgs1920-timeline-clip-menu-trigger')
        expect(clipMenu.getAttribute('placement')).toBe('right-start')
    })

    it('keeps the visual playhead controlled by setTime without emitting seek', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)
        const seek = vi.fn()
        timeline.addEventListener('lgs1920-timeline-seek', seek)
        timeline.setTime(5_000)

        expect(timeline.shadowRoot.querySelector('[data-playhead]').style.left).toBe('220px')
        expect(timeline.shadowRoot.querySelector('[data-current-time]').textContent).toBe('0:05')
        expect(seek).not.toHaveBeenCalled()
    })

    it('renders timeline handles in the ruler overlay with recessed grip dots', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const overlay = timeline.shadowRoot.querySelector('[data-overlay]')
        const startHandle = overlay.querySelector('[data-range-handle="start"]')
        const endHandle = overlay.querySelector('[data-range-handle="end"]')
        const playhead = overlay.querySelector('[data-playhead]')

        expect(overlay).not.toBeNull()
        expect(startHandle).not.toBeNull()
        expect(endHandle).not.toBeNull()
        expect(playhead).not.toBeNull()
        expect(startHandle.querySelector('wa-icon').getAttribute('name')).toBe('grip-dots-vertical')
        expect(endHandle.querySelector('wa-icon').getAttribute('name')).toBe('grip-dots-vertical')
        expect(playhead.querySelector('wa-icon').getAttribute('name')).toBe('grip-dots-vertical')
    })

    it('renders and edits the global video range handles', () => {
        const timeline = new LGS1920Timeline()
        const rangeChanges = vi.fn()
        configureTimeline(timeline, {
            timeline: {
                rangeStartMillis: 1_000,
                rangeEndMillis: 8_000,
            },
        })
        timeline.addEventListener('lgs1920-timeline-range-change', rangeChanges)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const endHandle = timeline.shadowRoot.querySelector('[data-range-handle="end"]')
        expect(endHandle.getAttribute('part')).toBe('timeline-end-handle')
        expect(endHandle.getAttribute('aria-valuenow')).toBe('8000')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 340, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 260, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 260, clientY: 50}))

        expect(rangeChanges).toHaveBeenCalledOnce()
        expect(rangeChanges.mock.calls[0][0].detail.rangeEndMillis).toBe(6_000)
    })

    it('drags both global range handles and snaps them to the timeline limits', () => {
        const timeline = new LGS1920Timeline()
        const rangeChanges = vi.fn()
        configureTimeline(timeline, {
            timeline: {
                rangeStartMillis: 1_000,
                rangeEndMillis: 8_000,
            },
        })
        timeline.addEventListener('lgs1920-timeline-range-change', rangeChanges)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const startHandle = timeline.shadowRoot.querySelector('[data-range-handle="start"]')
        startHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 100, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 100, clientY: 50}))

        expect(rangeChanges.mock.calls[0][0].detail.rangeStartMillis).toBe(2_000)
        const endHandle = timeline.shadowRoot.querySelector('[data-range-handle="end"]')
        endHandle.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        const resetStartHandle = timeline.shadowRoot.querySelector('[data-range-handle="start"]')
        resetStartHandle.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))

        expect(timeline.shadowRoot.querySelector('[data-range-handle="start"]').getAttribute('aria-valuenow')).toBe('0')
        expect(timeline.shadowRoot.querySelector('[data-range-handle="end"]').getAttribute('aria-valuenow')).toBe('10000')
        expect(rangeChanges).toHaveBeenCalledTimes(3)
    })

    it('auto-scrolls the ruler for a range handle with accelerating time steps', () => {
        const originalRequestAnimationFrame = globalThis.requestAnimationFrame
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame
        const originalWindowRequestAnimationFrame = window.requestAnimationFrame
        const originalWindowCancelAnimationFrame = window.cancelAnimationFrame
        const now = vi.spyOn(Date, 'now').mockReturnValue(0)
        let nextFrame = null
        globalThis.requestAnimationFrame = callback => {
            nextFrame = callback
            return 1
        }
        globalThis.cancelAnimationFrame = () => {}
        window.requestAnimationFrame = globalThis.requestAnimationFrame
        window.cancelAnimationFrame = globalThis.cancelAnimationFrame
        try {
            const timeline = new LGS1920Timeline()
            configureTimeline(timeline, {
                timeline: {
                    durationMillis: 600_000,
                    rangeStartMillis: 1_000,
                    rangeEndMillis: 500_000,
                },
            })
            document.body.append(timeline)

            const surface = timeline.shadowRoot.querySelector('[data-surface]')
            vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
            Object.defineProperty(surface, 'scrollLeft', {configurable: true, writable: true, value: 0})
            const endHandle = timeline.shadowRoot.querySelector('[data-range-handle="end"]')
            nextFrame()
            nextFrame = null
            endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 580, clientY: 50}))
            expect(nextFrame).toEqual(expect.any(Function))

            window.dispatchEvent(createPointerEvent('pointermove', {clientX: 580, clientY: 50}))
            now.mockReturnValue(1_000)
            nextFrame()
            const firstStep = surface.scrollLeft
            now.mockReturnValue(1_500)
            nextFrame()
            const secondStep = surface.scrollLeft - firstStep
            expect(Number.parseFloat(endHandle.style.left) - surface.scrollLeft).toBeCloseTo(599, 5)
            now.mockReturnValue(3_500)
            nextFrame()
            const thirdStep = surface.scrollLeft - firstStep - secondStep

            expect(firstStep).toBeGreaterThan(0)
            expect(secondStep).toBeGreaterThan(firstStep)
            expect(thirdStep).toBeGreaterThan(secondStep)

            window.dispatchEvent(createPointerEvent('pointerup', {clientX: 580, clientY: 50}))
        } finally {
            globalThis.requestAnimationFrame = originalRequestAnimationFrame
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame
            window.requestAnimationFrame = originalWindowRequestAnimationFrame
            window.cancelAnimationFrame = originalWindowCancelAnimationFrame
            now.mockRestore()
        }
    })

    it('does not auto-scroll beyond the visible minimum or maximum time limit', () => {
        const originalRequestAnimationFrame = globalThis.requestAnimationFrame
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame
        const originalWindowRequestAnimationFrame = window.requestAnimationFrame
        const originalWindowCancelAnimationFrame = window.cancelAnimationFrame
        let frameRequested = false
        globalThis.requestAnimationFrame = () => {
            frameRequested = true
            return 1
        }
        globalThis.cancelAnimationFrame = () => {}
        window.requestAnimationFrame = globalThis.requestAnimationFrame
        window.cancelAnimationFrame = globalThis.cancelAnimationFrame
        try {
            const timeline = new LGS1920Timeline()
            configureTimeline(timeline, {
                timeline: {
                    durationMillis: 60_000,
                    rangeStartMillis: 0,
                    rangeEndMillis: 50_000,
                },
                currentTimeMillis: 0,
            })
            document.body.append(timeline)

            const surface = timeline.shadowRoot.querySelector('[data-surface]')
            vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
            Object.defineProperty(surface, 'scrollLeft', {configurable: true, writable: true, value: 80})
            frameRequested = false
            const startHandle = timeline.shadowRoot.querySelector('[data-range-handle="start"]')
            startHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 1, clientY: 50}))

            expect(frameRequested).toBe(false)
            expect(surface.scrollLeft).toBe(80)
        } finally {
            globalThis.requestAnimationFrame = originalRequestAnimationFrame
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame
            window.requestAnimationFrame = originalWindowRequestAnimationFrame
            window.cancelAnimationFrame = originalWindowCancelAnimationFrame
        }
    })

    it('keeps a range handle draggable when its grip overlaps the playhead grip', () => {
        const timeline = new LGS1920Timeline()
        const rangeChanges = vi.fn()
        const seeks = vi.fn()
        configureTimeline(timeline, {
            timeline: {
                rangeStartMillis: 1_000,
                rangeEndMillis: 8_000,
            },
        })
        timeline.addEventListener('lgs1920-timeline-range-change', rangeChanges)
        timeline.addEventListener('lgs1920-timeline-seek', seeks)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const startHandle = timeline.shadowRoot.querySelector('[data-range-handle="start"]')
        const endHandle = timeline.shadowRoot.querySelector('[data-range-handle="end"]')
        vi.spyOn(startHandle, 'getBoundingClientRect').mockReturnValue({left: 100, width: 10})
        vi.spyOn(endHandle, 'getBoundingClientRect').mockReturnValue({left: 400, width: 10})
        const playheadGrip = timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__playhead-grip')
        playheadGrip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 105, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 140, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 140, clientY: 50}))

        expect(rangeChanges).toHaveBeenCalledOnce()
        expect(rangeChanges.mock.calls[0][0].detail.rangeStartMillis).toBeGreaterThan(1_000)
        expect(seeks).not.toHaveBeenCalled()
    })

    it('keeps range-handle arrow shortcuts local and prevents browser defaults', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {
                rangeStartMillis: 1_000,
                rangeEndMillis: 8_000,
            },
        })
        const parentListener = vi.fn()
        const parent = document.createElement('div')
        parent.addEventListener('keydown', parentListener)
        parent.append(timeline)
        document.body.append(parent)

        const startHandle = timeline.shadowRoot.querySelector('[data-range-handle="start"]')
        const event = new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true, composed: true})
        startHandle.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-range-handle="start"]').getAttribute('aria-valuenow')).toBe('1100')
        expect(parentListener).not.toHaveBeenCalled()
    })

    it('drags and keys the playhead only within the selected range', () => {
        const timeline = new LGS1920Timeline()
        const seeks = vi.fn()
        configureTimeline(timeline, {
            timeline: {
                rangeStartMillis: 2_000,
                rangeEndMillis: 8_000,
            },
            currentTimeMillis: 4_000,
        })
        timeline.addEventListener('lgs1920-timeline-seek', seeks)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const playhead = timeline.shadowRoot.querySelector('[data-playhead]')
        const grip = playhead.querySelector('.lgs1920-wa-timeline__playhead-grip')
        grip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 0, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 500, clientY: 50}))

        expect(timeline.currentTimeMillis).toBe(8_000)
        expect(seeks).toHaveBeenCalled()

        timeline.currentTimeMillis = 9_000
        expect(timeline.currentTimeMillis).toBe(8_000)
        timeline.setTime(0)
        expect(timeline.currentTimeMillis).toBe(2_000)

        playhead.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(timeline.currentTimeMillis).toBe(2_100)
        playhead.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true, cancelable: true}))
        expect(timeline.currentTimeMillis).toBe(2_000)
        const altMinimum = new KeyboardEvent('keydown', {key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true})
        playhead.dispatchEvent(altMinimum)
        expect(timeline.currentTimeMillis).toBe(2_000)
        const altMaximum = new KeyboardEvent('keydown', {key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true})
        playhead.dispatchEvent(altMaximum)
        expect(timeline.currentTimeMillis).toBe(8_000)
        expect(altMinimum.defaultPrevented).toBe(true)
        expect(altMaximum.defaultPrevented).toBe(true)
    })

    it('emits a public snapshot when a track label changes', () => {
        const timeline = new LGS1920Timeline()
        const labelChanges = vi.fn()
        timeline.addEventListener('lgs1920-timeline-track-label-change', labelChanges)
        timeline.timeline = {durationMillis: 12_000, visible: true}
        timeline.tracks = [{
            id: 'map#main',
            label: 'Map',
            editable: true,
            clips: [{id: 'map-clip', label: 'Map clip', start: 1, end: 4}],
        }]
        document.body.append(timeline)

        const labelSlot = timeline.shadowRoot.querySelector('slot[name="track-label-map#main"]')
        labelSlot.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        const input = timeline.shadowRoot.querySelector('[data-edit-row-id="map#main"]')
        expect(input.getAttribute('aria-label')).toBe('Edit Map')
        expect(input.getAttribute('label')).toBeNull()
        input.value = 'Journey map'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        input.dispatchEvent(new Event('change', {bubbles: true}))

        expect(labelChanges).toHaveBeenCalledOnce()
        expect(labelChanges.mock.calls[0][0].detail.data.timeline.durationMillis).toBe(12_000)
        expect(labelChanges.mock.calls[0][0].detail.trackId).toBe('map#main')
        expect(labelChanges.mock.calls[0][0].detail.data.tracks[0].label).toBe('Journey map')
        expect(labelChanges.mock.calls[0][0].detail.data.tracks[0].clips[0].id).toBe('map-clip')
    })

    it('restores the previous track label when an empty edit is committed', () => {
        const timeline = new LGS1920Timeline()
        const labelChanges = vi.fn()
        timeline.addEventListener('lgs1920-timeline-track-label-change', labelChanges)
        timeline.timeline = {durationMillis: 12_000, visible: true}
        timeline.tracks = [{id: 'map', label: 'Map', editable: true, clips: []}]
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('slot[name="track-label-map"]')
            .dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        const input = timeline.shadowRoot.querySelector('[data-edit-row-id="map"]')
        input.value = '   '
        input.dispatchEvent(new Event('input', {bubbles: true}))
        input.dispatchEvent(new Event('change', {bubbles: true}))

        expect(labelChanges.mock.calls[0][0].detail.label).toBe('Map')
        expect(timeline.tracks[0].label).toBe('Map')
    })

    it('resizes clips through start and end handles and emits the committed change', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline)
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 220, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 220, clientY: 50}))

        expect(endHandle.getAttribute('part')).toBe('clip-end-handle')
        expect(changes).toHaveBeenCalledOnce()
        expect(changes.mock.calls[0][0].detail.type).toBe('resize')
        expect(changes.mock.calls[0][0].detail.edge).toBe('end')
        expect(changes.mock.calls[0][0].detail.clip.end).toBe(5)
    })

    it('moves a clip from one track to another and preserves its duration', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        const beforeDrag = vi.fn()
        const drag = vi.fn()
        const afterDrag = vi.fn()
        const tracks = [
            {id: 'source', label: 'Source', clips: [{id: 'move-me', kind: 'video', start: 1, end: 4}]},
            {id: 'target', label: 'Target', accepts: ['video'], clips: []},
        ]
        configureTimeline(timeline, {tracks})
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        timeline.addEventListener('lgs1920-timeline-before-drag', beforeDrag)
        timeline.addEventListener('lgs1920-timeline-drag', drag)
        timeline.addEventListener('lgs1920-timeline-after-drag', afterDrag)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="move-me"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 100, clientY: 70}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 100, clientY: 70}))

        expect(changes).toHaveBeenCalledOnce()
        expect(changes.mock.calls[0][0].detail.fromTrackId).toBe('source')
        expect(changes.mock.calls[0][0].detail.toTrackId).toBe('target')
        expect(changes.mock.calls[0][0].detail.clip.start).toBe(2)
        expect(changes.mock.calls[0][0].detail.clip.end).toBe(5)
        expect(changes.mock.calls[0][0].detail.tracks[1].clips[0].id).toBe('move-me')
        expect(beforeDrag).toHaveBeenCalledOnce()
        expect(drag).toHaveBeenCalled()
        expect(afterDrag).toHaveBeenCalledOnce()
        expect(beforeDrag.mock.calls[0][0].detail.context).toMatchObject({
            type: 'clip',
            pisteId: 'source',
            clipId: 'move-me',
        })
        expect(afterDrag.mock.calls[0][0].detail.context).toMatchObject({
            type: 'clip',
            pisteId: 'target',
            clipId: 'move-me',
        })
    })

    it('trims a moved clip to the available gap without creating an overlap', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            timeline: {collisionPolicy: 'prevent'},
            tracks: [
                {id: 'source', label: 'Source', clips: [{id: 'move-me', kind: 'video', start: 1, end: 5}]},
                {
                    id: 'target',
                    label: 'Target',
                    accepts: ['video'],
                    clips: [
                        {id: 'before', kind: 'video', start: 0, end: 2},
                        {id: 'after', kind: 'video', start: 5, end: 8},
                    ],
                },
            ],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="move-me"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 220, clientY: 70}))
        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="track"][data-row-id="target"]')
            .classList.contains('lgs1920-wa-timeline__track--clip-drop-rejected')).toBe(true)
        expect(clip.classList.contains('lgs1920-wa-timeline__clip--drop-rejected')).toBe(true)
        expect(clip.parentElement).toBe(timeline.shadowRoot.querySelector('[part="track"][data-row-id="target"]'))
        expect(clip.style.left).toBe('220px')

        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 140, clientY: 70}))
        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(false)
        expect(clip.classList.contains('lgs1920-wa-timeline__clip--drop-rejected')).toBe(false)
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 220, clientY: 70}))
        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(true)
        expect(clip.style.left).toBe('220px')
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 140, clientY: 70}))

        const detail = changes.mock.calls[0][0].detail
        const movedClip = detail.tracks.find(track => track.id === 'target').clips.find(value => value.id === 'move-me')
        expect(movedClip).toMatchObject({start: 3, end: 5})
        expect(movedClip.end - movedClip.start).toBe(2)
        expect(detail.tracks.find(track => track.id === 'target').clips)
            .toEqual(expect.arrayContaining([
                expect.objectContaining({id: 'before', start: 0, end: 2}),
                expect.objectContaining({id: 'after', start: 5, end: 8}),
            ]))
    })

    it('stops a clip resize at the neighboring clip boundary', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            timeline: {collisionPolicy: 'prevent'},
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [
                    {id: 'resizing', kind: 'video', start: 1, end: 4},
                    {id: 'next', kind: 'video', start: 5, end: 8},
                ],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="resizing"] [data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 260, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 260, clientY: 50}))

        expect(changes).toHaveBeenCalledOnce()
        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 1, end: 5})
    })

    it('inserts a clip on the configured track from the clip menu', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {
            timeline: {collisionPolicy: 'allow'},
            currentTimeMillis: 2_000,
            clipOptions: [{group: 'media', key: 'video', id: 'inserted', label: 'Inserted', duration: 3, trackId: 'main#one'}],
        })
        timeline.addEventListener('lgs1920-timeline-add-clip', additions)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]').click()
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__menu-item').getAttribute('variant'))
            .toBe('brand')
        timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__menu-item').click()

        expect(additions).toHaveBeenCalledOnce()
        expect(additions.mock.calls[0][0].detail.clip.id).toBe('inserted')
        expect(additions.mock.calls[0][0].detail.clip.start).toBe(2)
        expect(additions.mock.calls[0][0].detail.clip.end).toBe(5)
        expect(additions.mock.calls[0][0].detail.tracks[0].clips.some(clip => clip.id === 'inserted')).toBe(true)
    })

    it('applies ripple insertion and extends the timeline when configured', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {
            timeline: {
                durationPolicy: 'extend',
                collisionPolicy: 'ripple',
            },
            tracks: [{
                id: 'video',
                label: 'Video',
                clips: [
                    {id: 'first', kind: 'video', start: 0, end: 2},
                    {id: 'last', kind: 'video', start: 2, end: 10},
                ],
            }],
            currentTimeMillis: 1_000,
            clipOptions: [{group: 'media', key: 'video', id: 'inserted', label: 'Inserted', duration: 3, trackId: 'video'}],
        })
        timeline.addEventListener('lgs1920-timeline-add-clip', additions)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]').click()
        timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__menu-item').click()

        const detail = additions.mock.calls[0][0].detail
        expect(detail.durationMillis).toBe(13_000)
        expect(detail.tracks[0].clips.find(clip => clip.id === 'inserted')).toMatchObject({start: 2, end: 5})
        expect(detail.tracks[0].clips.find(clip => clip.id === 'last')).toMatchObject({start: 5, end: 13})
    })

    it('reorders tracks from the dedicated drag trigger and emits the drop index', () => {
        const timeline = new LGS1920Timeline()
        const reorders = vi.fn()
        const beforeDrag = vi.fn()
        const drag = vi.fn()
        const afterDrag = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {id: 'first', label: 'First', movable: true, clips: []},
                {id: 'second', label: 'Second', movable: true, clips: []},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-reorder', reorders)
        timeline.addEventListener('lgs1920-timeline-before-drag', beforeDrag)
        timeline.addEventListener('lgs1920-timeline-drag', drag)
        timeline.addEventListener('lgs1920-timeline-after-drag', afterDrag)
        document.body.append(timeline)

        const trigger = timeline.shadowRoot.querySelector('slot[name="drag-trigger-first"]')
        expect(trigger.querySelector('wa-icon').getAttribute('name')).toBe('grip-dots-vertical')
        trigger.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        const surface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
        const tracksViewport = timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')
        Object.defineProperty(surface, 'scrollLeft', {configurable: true, writable: true, value: 72})
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 100, right: 700, width: 600, top: 0, bottom: 200, height: 200})
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 70}))
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')).toBe(surface)
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')).toBe(tracksViewport)
        expect(surface.scrollLeft).toBe(72)
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 70}))

        expect(reorders).toHaveBeenCalledOnce()
        expect(reorders.mock.calls[0][0].detail.dropIndex).toBe(2)
        expect(reorders.mock.calls[0][0].detail.tracks[0].id).toBe('second')
        expect(timeline.shadowRoot.querySelector('[data-track-drop-indicator]').hidden).toBe(true)
        expect(beforeDrag.mock.calls[0][0].detail.context).toMatchObject({type: 'piste', pisteId: 'first'})
        expect(drag).toHaveBeenCalled()
        expect(afterDrag.mock.calls[0][0].detail).toMatchObject({
            committed: true,
            context: {type: 'piste', pisteId: 'first'},
        })
    })

    it('starts a row drag from the full track name area and marks the row success', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            currentTimeMillis: 3_500,
            tracks: [
                {id: 'first', label: 'First', movable: true, clips: []},
                {id: 'second', label: 'Second', movable: true, clips: []},
            ],
        })
        document.body.append(timeline)

        const nameArea = timeline.shadowRoot.querySelector('[data-row-id="first"] [part="legend-content"]')
        const pointerDown = createPointerEvent('pointerdown', {clientX: 10, clientY: 10})
        nameArea.dispatchEvent(pointerDown)

        expect(pointerDown.defaultPrevented).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-row-id="first"]')
            .classList.contains('lgs1920-wa-timeline__legend-row--dragging')).toBe(false)

        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 30}))

        expect(timeline.shadowRoot.querySelector('[data-row-id="first"]')
            .classList.contains('lgs1920-wa-timeline__legend-row--dragging')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="track"][data-row-id="first"]')
            .classList.contains('lgs1920-wa-timeline__track--dragging')).toBe(true)
        expect(timeline.currentTimeMillis).toBe(3_500)

        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 30}))
        expect(timeline.currentTimeMillis).toBe(3_500)

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 10}))
        expect(timeline.currentTimeMillis).toBe(3_500)
    })

    it('keeps a double-click on the track name available for editing', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'editable', label: 'Editable', editable: true, movable: true, clips: []}],
        })
        document.body.append(timeline)

        const labelSlot = timeline.shadowRoot.querySelector('slot[name="track-label-editable"]')
        labelSlot.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 10}))
        labelSlot.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 10}))
        labelSlot.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))

        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="editable"]')).not.toBeNull()
    })

    it.each([
        {
            name: 'before a locked first track',
            tracks: [
                {id: 'locked-bottom', label: 'Locked bottom', fixed: true, movable: false, clips: []},
                {id: 'moving', label: 'Moving', movable: true, clips: []},
                {id: 'top', label: 'Top', movable: true, clips: []},
            ],
            pointerY: -100,
        },
        {
            name: 'between two locked tracks',
            tracks: [
                {id: 'locked-bottom', label: 'Locked bottom', fixed: true, movable: false, clips: []},
                {id: 'locked-top', label: 'Locked top', fixed: true, movable: false, clips: []},
                {id: 'moving', label: 'Moving', movable: true, clips: []},
            ],
            pointerY: 12,
        },
        {
            name: 'after a locked last track',
            tracks: [
                {id: 'moving', label: 'Moving', movable: true, clips: []},
                {id: 'locked-top', label: 'Locked top', fixed: true, movable: false, clips: []},
            ],
            pointerY: 100,
        },
    ])('rejects row insertion $name', ({tracks, pointerY}) => {
        const timeline = new LGS1920Timeline()
        const reorders = vi.fn()
        const afterDrag = vi.fn()
        configureTimeline(timeline, {tracks})
        timeline.addEventListener('lgs1920-timeline-reorder', reorders)
        timeline.addEventListener('lgs1920-timeline-after-drag', afterDrag)
        document.body.append(timeline)

        const nameArea = timeline.shadowRoot.querySelector('[data-row-id="moving"] [part="legend-content"]')
        nameArea.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 0}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: pointerY}))

        expect(timeline.hasAttribute('data-row-drop-rejected')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-row-id="moving"]')
            .classList.contains('lgs1920-wa-timeline__legend-row--drop-rejected')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="track"][data-row-id="moving"]')
            .classList.contains('lgs1920-wa-timeline__track--drop-rejected')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-row-id="moving"][part="legend-row"]')
            .classList.contains('lgs1920-wa-timeline__legend-row--drag-placeholder')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="legend-row"][data-row-id="moving"][data-row-drag-silhouette]'))
            .not.toBeNull()
        expect(timeline.shadowRoot.querySelector('[part="track"][data-row-id="moving"][data-row-drag-silhouette]'))
            .not.toBeNull()

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: pointerY}))

        expect(timeline.hasAttribute('data-row-drop-rejected')).toBe(false)
        expect(reorders).not.toHaveBeenCalled()
        expect(timeline.tracks.map(track => track.id)).toEqual(tracks.map(track => track.id))
        expect(afterDrag.mock.calls[0][0].detail).toMatchObject({committed: false})
    })

    it('does not open context menus for tracks or clips', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const track = timeline.shadowRoot.querySelector('[data-row-id="main#one"]')
        track.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__context-menu')).toBeNull()

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip-one"]')
        clip.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__context-menu')).toBeNull()
    })
})
