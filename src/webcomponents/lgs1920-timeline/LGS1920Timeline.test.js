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
 * Last modified: 2026-09-09
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
import {rippleResizedClips} from './LGS1920TimelineEditing'
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

const testColorSwatches = Object.freeze([
    {color: '#ef4444', label: 'Red', palette: 'red'},
    {color: '#f97316', label: 'Orange', palette: 'orange'},
    {color: '#eab308', label: 'Yellow', palette: 'yellow'},
    {color: '#22c55e', label: 'Green', palette: 'green'},
    {color: '#06b6d4', label: 'Cyan', palette: 'cyan'},
    {color: '#3b82f6', label: 'Blue', palette: 'blue'},
    {color: '#6366f1', label: 'Indigo', palette: 'indigo'},
    {color: '#a855f7', label: 'Purple', palette: 'purple'},
    {color: '#ec4899', label: 'Pink', palette: 'pink'},
    {color: '#6b7280', label: 'Gray', palette: 'gray'},
])

const configureTimeline = (timeline, options = {}) => {
    timeline.timeline = {
        durationMillis: timelineState.durationMillis,
        visible: true,
        swatches: testColorSwatches,
        hostNoDragClass: 'test-no-drag',
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
    Object.defineProperty(event, 'pointerType', {value: options.pointerType ?? 'mouse'})
    return event
}

const createDataTransfer = () => {
    const values = new Map()
    return {
        effectAllowed: '',
        dropEffect: '',
        setData: (type, value) => values.set(type, value),
        getData: type => values.get(type) ?? '',
    }
}

const createDragEvent = (type, dataTransfer, options = {}) => {
    const event = new Event(type, {bubbles: true, cancelable: true})
    Object.defineProperties(event, {
        dataTransfer: {value: dataTransfer},
        clientX: {value: options.clientX ?? 0},
        relatedTarget: {value: options.relatedTarget ?? null},
    })
    return event
}

afterEach(() => document.body.replaceChildren())

describe('lgs1920-timeline Web Component', () => {
    it('applies selectable host interaction before connection', () => {
        const timeline = new LGS1920Timeline()

        timeline.setAttribute('data-widget-selectable', '')

        expect(timeline.timeline.hostInteraction).toBe('selectable')
    })

    it('marks click-consuming timeline surfaces as local widget interactions', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        expect(timeline.shadowRoot.querySelector('[data-surface]').classList.contains('test-no-drag')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="timeline-tools"]').classList.contains('lgs-widget-no-drag')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="transport"]').classList.contains('lgs-widget-no-drag')).toBe(true)
    })

    it('formats ruler labels according to the timeline duration', () => {
        expect(formatRulerTime(0)).toBe('0')
        expect(formatRulerTime(3)).toBe('3')
        expect(formatRulerTime(16)).toBe('16')
        expect(formatRulerTime(63)).toBe('1:03')
        expect(formatRulerTime(603)).toBe('10:03')
        expect(formatRulerTime(3723)).toBe('1:02:03')
    })

    it('opens in controlled horizontal fit mode when requested', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {horizontalFit: true}})
        document.body.append(timeline)

        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('-99.9')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-tools-horizontal-fit"] wa-icon').getAttribute('name'))
            .toBe('arrow-up-right-and-arrow-down-left-from-center')
    })

    it('emits cancelable before, main, and after events for transport actions', () => {
        const timeline = new LGS1920Timeline()
        const order = []
        configureTimeline(timeline, {currentTimeMillis: 1_000})
        timeline.addEventListener('lgs1920-timeline-before-play', event => order.push(`before:${event.type}`))
        timeline.addEventListener('lgs1920-timeline-play', event => order.push(event.type))
        timeline.addEventListener('lgs1920-timeline-after-play', event => order.push(`after:${event.type}`))
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-play"]').click()

        expect(order).toEqual([
            'before:lgs1920-timeline-before-play',
            'lgs1920-timeline-play',
            'after:lgs1920-timeline-after-play',
        ])

        const blocked = vi.fn(event => event.preventDefault())
        timeline.addEventListener('lgs1920-timeline-before-pause', blocked)
        const pause = vi.fn()
        const afterPause = vi.fn()
        timeline.addEventListener('lgs1920-timeline-pause', pause)
        timeline.addEventListener('lgs1920-timeline-after-pause', afterPause)
        timeline.playing = true
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-play"]').click()

        expect(blocked).toHaveBeenCalledOnce()
        expect(blocked.mock.calls[0][0].cancelable).toBe(true)
        expect(pause).not.toHaveBeenCalled()
        expect(afterPause).not.toHaveBeenCalled()
    })

    it('keeps the initial ruler wide enough for five seconds', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {durationMillis: 1_000}})
        document.body.append(timeline)

        expect(timeline.shadowRoot.querySelector('[data-surface] [part="canvas"]').style.width).toBe('240px')
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
        const customMenu = document.createElement('wa-button')
        customMenu.slot = 'custom-menu'
        const customMenuParent = document.createElement('div')
        const customMenuParentClick = vi.fn()
        customMenuParent.addEventListener('click', customMenuParentClick)
        timeline.append(heading, headerAction, timelineAction)
        timeline.append(customMenu)
        timeline.style.setProperty('--lgs-timeline-playhead-color', 'rebeccapurple')
        configureTimeline(timeline)
        customMenuParent.append(timeline)
        document.body.append(customMenuParent)

        expect(customElements.get('lgs1920-timeline')).toBe(LGS1920Timeline)
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline"]').tagName).toBe('WA-CARD')
        expect(timeline.shadowRoot.querySelector('slot[name="header"]').assignedElements()).toEqual([heading])
        expect(timeline.shadowRoot.querySelector('slot[name="header-actions"]').assignedElements()).toEqual([headerAction])
        expect(timeline.shadowRoot.querySelector('slot[name="timeline-actions"]').assignedElements()).toEqual([timelineAction])
        expect(timeline.shadowRoot.querySelector('slot[name="custom-menu"]').assignedElements()).toEqual([customMenu])
        const customMenuClick = vi.fn()
        customMenu.addEventListener('click', customMenuClick)
        customMenu.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}))
        expect(customMenuClick).toHaveBeenCalledTimes(1)
        expect(customMenuParentClick).toHaveBeenCalledTimes(1)
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
        const startHandle = timeline.shadowRoot.querySelector('[data-clip-id="clip-one"] [data-clip-handle="start"]')
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="clip-one"] [data-clip-handle="end"]')
        expect(startHandle.getAttribute('role')).toBe('slider')
        expect(startHandle.getAttribute('aria-valuemin')).toBe('0')
        expect(startHandle.getAttribute('aria-valuemax')).toBe('4000')
        expect(startHandle.getAttribute('aria-valuenow')).toBe('1000')
        expect(startHandle.getAttribute('aria-keyshortcuts'))
            .toBe('ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight')
        expect(endHandle.getAttribute('aria-valuemin')).toBe('1000')
        expect(endHandle.getAttribute('aria-valuemax')).toBe('10000')
        expect(endHandle.getAttribute('aria-valuenow')).toBe('4000')
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

    it('leaves split-panel repositioning to the native component', async () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

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
        expect(timeline.shadowRoot.querySelector('[part="split-panel"]').positionInPixels).toBe(180)
    })

    it('provides icon-only view buttons with Web Awesome tooltips', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const tools = timeline.shadowRoot.querySelector('[part="timeline-tools"]')
        const header = timeline.shadowRoot.querySelector('[part="header"]')
        const headerStart = timeline.shadowRoot.querySelector('[part="header-start"]')
        const customMenu = timeline.shadowRoot.querySelector('[part="custom-menu"]')
        const transport = timeline.shadowRoot.querySelector('[part="transport"]')
        const horizontal = tools.querySelector('[data-testid="lgs1920-wa-tools-horizontal-fit"]')
        const vertical = tools.querySelector('[data-testid="lgs1920-wa-tools-vertical-zoom"]')
        const tooltips = tools.querySelectorAll('wa-tooltip')
        expect(tools).not.toBeNull()
        expect(tools.parentElement).toBe(headerStart)
        expect(headerStart.contains(tools)).toBe(true)
        expect(customMenu.parentElement).toBe(header)
        expect(transport.parentElement).toBe(header)
        expect([...header.children]).toEqual([headerStart, customMenu, transport])
        expect(tools.querySelectorAll('.lgs1920-wa-timeline__timeline-tool')).toHaveLength(2)
        expect(tooltips).toHaveLength(2)
        expect(horizontal.getAttribute('variant')).toBe('brand')
        expect(vertical.getAttribute('variant')).toBe('brand')
        expect(horizontal.querySelector('wa-icon')).not.toBeNull()
        expect(horizontal.querySelector('wa-icon').getAttribute('name'))
            .toBe('arrow-down-left-and-arrow-up-right-to-center')
        expect(horizontal.querySelector('wa-icon').style.transform).toBe('rotate(45deg)')
        expect(horizontal.querySelector('slot')).toBeNull()
        expect(vertical.querySelector('wa-icon').getAttribute('name'))
            .toBe('arrow-up-right-and-arrow-down-left-from-center')
        expect(vertical.querySelector('wa-icon').style.transform).toBe('rotate(-45deg)')
        expect(tooltips[0].getAttribute('for')).toBe(horizontal.id)
        expect(tooltips[1].getAttribute('for')).toBe(vertical.id)

        horizontal.click()
        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('-99.9')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-tools-horizontal-fit"] wa-icon').getAttribute('name'))
            .toBe('arrow-up-right-and-arrow-down-left-from-center')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-tools-horizontal-fit"] wa-icon').style.transform)
            .toBe('rotate(45deg)')

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-tools-horizontal-fit"]').click()
        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('0')

        vertical.click()
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('64px')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-tools-vertical-zoom"] wa-icon').getAttribute('name'))
            .toBe('arrow-down-left-and-arrow-up-right-to-center')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-tools-vertical-zoom"] wa-icon').style.transform)
            .toBe('rotate(-45deg)')

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-tools-vertical-zoom"]').click()
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('24px')
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

    it('keeps the fitted ruler width when the timeline is closed and reopened', () => {
        let resizeCallback = null
        class ResizeObserverMock {
            /**
             * Capture the observer callback used by the timeline.
             *
             * @param {Function} callback - Resize callback.
             */
            constructor(callback) {
                resizeCallback = callback
            }

            /**
             * Disconnect the test observer.
             */
            disconnect() {}

            /**
             * Observe the test target.
             */
            observe() {}
        }
        vi.stubGlobal('ResizeObserver', ResizeObserverMock)
        try {
            const timeline = new LGS1920Timeline()
            configureTimeline(timeline, {timeline: {horizontalFit: true}})
            document.body.append(timeline)

            const initialSurface = timeline.shadowRoot.querySelector('[data-surface]')
            Object.defineProperty(initialSurface, 'clientWidth', {configurable: true, value: 600})
            timeline.handleResize()
            const initialZoom = timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')
            const initialCanvasWidth = timeline.shadowRoot.querySelector('[part="canvas"]').style.width
            expect(initialZoom).not.toBe('-99.9')

            timeline.timeline = Object.assign({}, timeline.timeline, {visible: false})
            resizeCallback()
            timeline.timeline = Object.assign({}, timeline.timeline, {visible: true})

            expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent'))
                .toBe(initialZoom)
            expect(timeline.shadowRoot.querySelector('[part="canvas"]').style.width).toBe(initialCanvasWidth)
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('uses configurable minimum and maximum track title widths', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {
                legendMinWidth: 160,
                legendWidth: 180,
                legendMaxWidth: 240,
            },
        })
        document.body.append(timeline)

        const splitPanel = timeline.shadowRoot.querySelector('[part="split-panel"]')
        const layout = timeline.shadowRoot.querySelector('[part="layout"]')
        expect(splitPanel.hasAttribute('position-in-pixels')).toBe(false)
        expect(splitPanel.style.getPropertyValue('--min')).toBe('160px')
        expect(splitPanel.style.getPropertyValue('--max')).toBe('min(240px, calc(100% - 160px))')
        expect(splitPanel.positionInPixels).toBe(180)
        expect(layout.style.getPropertyValue('--lgs-timeline-legend-width')).toBe('')
        expect(timeline.timeline.legendMinWidth).toBe(160)
        expect(timeline.timeline.legendWidth).toBe(180)
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

    it('keeps the visible time and horizontal position when the duration grows', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {currentTimeMillis: 2_000})
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        Object.defineProperty(surface, 'scrollLeft', {configurable: true, writable: true, value: 72})
        timeline.timeline = {durationMillis: 20_000}

        const nextSurface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
        expect(nextSurface.scrollLeft).toBe(52)
        expect(timeline.currentTimeMillis).toBe(2_000)
        expect(timeline.shadowRoot.querySelector('[data-current-time]').textContent).toBe('0:02')
    })

    it('recomputes horizontal zoom geometry for the new duration', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {durationMillis: 10_000}})
        document.body.append(timeline)

        timeline.setZoom(100)
        const initialWidth = Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width)
        const initialEnd = Number.parseFloat(timeline.shadowRoot.querySelector('[data-end-marker]').style.left)

        timeline.timeline = {durationMillis: 20_000}

        const nextWidth = Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width)
        const nextEnd = Number.parseFloat(timeline.shadowRoot.querySelector('[data-end-marker]').style.left)
        expect(nextWidth).toBeGreaterThan(initialWidth)
        expect(nextEnd).toBeGreaterThan(initialEnd)
        expect(timeline.shadowRoot.querySelector('[data-total-time]').textContent).toBe('0:20')
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

    it('uses the Web Awesome wag animation while the timeline is building', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const icon = timeline.shadowRoot.querySelector('[data-building-overlay] wa-icon')
        const textSlot = timeline.shadowRoot.querySelector('slot[name="overlay-text"]')
        expect(icon?.getAttribute('name')).toBe('paintbrush')
        expect(icon?.getAttribute('animation')).toBe('wag')
        expect(textSlot).not.toBeNull()
        expect(textSlot.textContent).toBe('Building...')
    })

    it('accepts custom building text through the overlay-text slot', () => {
        const timeline = new LGS1920Timeline()
        const customText = document.createElement('span')
        customText.slot = 'overlay-text'
        customText.textContent = 'Preparing timeline...'
        timeline.append(customText)
        configureTimeline(timeline)
        document.body.append(timeline)

        const textSlot = timeline.shadowRoot.querySelector('slot[name="overlay-text"]')
        expect(textSlot.assignedElements()).toEqual([customText])
        expect(textSlot.closest('[role="status"]').hasAttribute('aria-label')).toBe(false)
    })

    it('can disable the initial building overlay through timeline options', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {showBuildingOverlay: false}})
        document.body.append(timeline)

        expect(timeline.timeline.showBuildingOverlay).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()
    })

    it('keeps the host visible while the initial projection is pending', () => {
        const timeline = new LGS1920Timeline()
        document.body.append(timeline)

        expect(timeline.hasAttribute('data-ready')).toBe(true)
        expect(timeline.hidden).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).not.toBeNull()

        configureTimeline(timeline)

        expect(timeline.hidden).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).not.toBeNull()
    })

    it('shows the building overlay only for the initial mount', async () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const initialOverlay = timeline.shadowRoot.querySelector('[data-building-overlay]')
        expect(initialOverlay).not.toBeNull()
        expect(initialOverlay.parentNode).toBe(timeline.shadowRoot)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()

        timeline.setZoom(20)
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()

        const nameArea = timeline.shadowRoot.querySelector('[data-row-id="main#one"] [part="legend-content"]')
        nameArea.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 60}))
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 60}))
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()
    })

    it('keeps the initial building overlay until the surface has a measured width', async () => {
        let resizeCallback = null
        class ResizeObserverMock {
            /**
             * Capture the observer callback used by the timeline.
             *
             * @param {Function} callback - Resize callback.
             */
            constructor(callback) {
                resizeCallback = callback
            }

            /**
             * Disconnect the test observer.
             */
            disconnect() {}

            /**
             * Observe the test target.
             */
            observe() {}
        }
        vi.stubGlobal('ResizeObserver', ResizeObserverMock)
        try {
            const timeline = new LGS1920Timeline()
            configureTimeline(timeline, {timeline: {horizontalFit: true}})
            document.body.append(timeline)

            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
            expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).not.toBeNull()

            const surface = timeline.shadowRoot.querySelector('[data-surface]')
            Object.defineProperty(surface, 'clientWidth', {configurable: true, value: 600})
            resizeCallback()
            expect(timeline.shadowRoot.querySelector('[data-surface]')).not.toBe(surface)
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))))

            expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it('shows the building overlay again when the timeline is attached a second time', async () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()

        timeline.remove()
        document.body.append(timeline)

        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).not.toBeNull()
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()
    })

    it('opens the title panel at 150 pixels within the generic width bounds', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const splitPanel = timeline.shadowRoot.querySelector('[part="split-panel"]')
        expect(splitPanel.style.getPropertyValue('--min')).toBe('50px')
        expect(splitPanel.style.getPropertyValue('--max')).toBe('min(250px, calc(100% - 50px))')
        expect(splitPanel.positionInPixels).toBe(150)

        splitPanel.positionInPixels = 50
        timeline.setZoom(20)

        expect(timeline.shadowRoot.querySelector('[part="split-panel"]').positionInPixels).toBe(150)
    })

    it('resolves the row height from the rendered layout', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)
        const layout = timeline.shadowRoot.querySelector('[part="layout"]')
        vi.spyOn(layout, 'getBoundingClientRect').mockReturnValue({height: 300})

        timeline.handleResize()

        const renderedLayout = timeline.shadowRoot.querySelector('[part="layout"]')
        expect(renderedLayout.style.getPropertyValue('--lgs-timeline-row-height')).toBe('64px')
    })

    it('keeps plain wheel scrolling native and maps modified wheel to timeline zoom', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)
        const initialCanvasWidth = Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width)

        const plainWheel = new WheelEvent('wheel', {bubbles: true, cancelable: true, deltaY: -100})
        timeline.shadowRoot.querySelector('[data-surface]').dispatchEvent(plainWheel)
        expect(plainWheel.defaultPrevented).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('24px')

        const verticalWheel = new WheelEvent('wheel', {bubbles: true, cancelable: true, deltaY: -100, shiftKey: true})
        timeline.shadowRoot.querySelector('[data-surface]').dispatchEvent(verticalWheel)
        expect(verticalWheel.defaultPrevented).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('28px')

        const altVerticalWheel = new WheelEvent('wheel', {bubbles: true, cancelable: true, deltaY: -100, altKey: true})
        timeline.shadowRoot.querySelector('[data-surface]').dispatchEvent(altVerticalWheel)
        expect(altVerticalWheel.defaultPrevented).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('32px')

        for (let index = 0; index < 20; index += 1) {
            timeline.shadowRoot.querySelector('[data-surface]').dispatchEvent(new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaY: -100,
                shiftKey: true,
            }))
        }
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('64px')

        const horizontalWheel = new WheelEvent('wheel', {bubbles: true, cancelable: true, deltaY: -100, metaKey: true})
        timeline.shadowRoot.querySelector('[data-surface]').dispatchEvent(horizontalWheel)
        expect(horizontalWheel.defaultPrevented).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('20')
        expect(Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width)).toBeGreaterThan(initialCanvasWidth)

        const browserWheel = new WheelEvent('wheel', {bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100})
        timeline.shadowRoot.querySelector('[data-surface]').dispatchEvent(browserWheel)
        expect(browserWheel.defaultPrevented).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('20')
    })

    it('adapts secondary ruler units and minimum zoom to the surface width', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)
        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        Object.defineProperty(surface, 'clientWidth', {configurable: true, value: 10})

        const canvasWidthAtNormalZoom = Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width)
        expect(timeline.shadowRoot.querySelectorAll('[part="minor-tick"]')).not.toHaveLength(0)

        timeline.setZoom(-20)
        const lowZoomSecondaryTicks = timeline.shadowRoot.querySelectorAll('[part="minor-tick"]')
        expect(lowZoomSecondaryTicks.length).toBeGreaterThan(0)
        expect(Number.parseFloat(lowZoomSecondaryTicks[1].style.left) - Number.parseFloat(lowZoomSecondaryTicks[0].style.left))
            .toBeCloseTo(12.8)

        timeline.setZoom(100)
        const secondaryTicks = timeline.shadowRoot.querySelectorAll('[part="minor-tick"]')
        expect(secondaryTicks.length).toBeGreaterThan(0)
        expect(Number.parseFloat(secondaryTicks[1].style.left) - Number.parseFloat(secondaryTicks[0].style.left)).toBe(8)

        Object.defineProperty(timeline.shadowRoot.querySelector('[data-surface]'), 'clientWidth', {configurable: true, value: 300})
        timeline.handleResize()
        timeline.setZoom(-50)
        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('-35')
        expect(Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width)).toBe(300)
        expect(Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width))
            .toBeLessThan(canvasWidthAtNormalZoom)
    })

    it('maps unmodified arrow keys to vertical and horizontal zoom', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)
        const surface = timeline.shadowRoot.querySelector('[data-surface]')

        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('28px')
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('24px')
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('20')
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('0')

        const modifiedArrow = new KeyboardEvent('keydown', {key: 'ArrowUp', bubbles: true, cancelable: true, shiftKey: true})
        surface.dispatchEvent(modifiedArrow)
        expect(modifiedArrow.defaultPrevented).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('24px')
    })

    it('uses Shift arrows to jump to range boundaries and track edges', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {rangeStartMillis: 2_000, rangeEndMillis: 8_000},
            currentTimeMillis: 5_000,
        })
        document.body.append(timeline)
        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        const tracksViewport = timeline.shadowRoot.querySelector('[data-tracks-viewport]')
        Object.defineProperty(tracksViewport, 'scrollHeight', {configurable: true, value: 600})
        Object.defineProperty(tracksViewport, 'clientHeight', {configurable: true, value: 200})
        let scrollTop = 0
        Object.defineProperty(tracksViewport, 'scrollTop', {
            configurable: true,
            get: () => scrollTop,
            set: value => { scrollTop = value },
        })
        expect(tracksViewport.scrollHeight).toBe(600)
        expect(tracksViewport.clientHeight).toBe(200)

        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true}))
        expect(timeline.currentTimeMillis).toBe(2_000)
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true}))
        expect(timeline.currentTimeMillis).toBe(8_000)
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', shiftKey: true, bubbles: true, cancelable: true}))
        expect(tracksViewport.scrollTop).toBe(0)
        const down = new KeyboardEvent('keydown', {key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true})
        surface.dispatchEvent(down)
        expect(down.defaultPrevented).toBe(true)
        expect(tracksViewport.scrollTop).toBe(400)
    })

    it('handles Shift navigation from the window when the timeline is selected', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {
                keyboardZoomActive: true,
                rangeStartMillis: 2_000,
                rangeEndMillis: 8_000,
            },
            currentTimeMillis: 5_000,
        })
        document.body.append(timeline)

        window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        }))

        expect(timeline.currentTimeMillis).toBe(8_000)
    })

    it('applies modifier clicks only on the ruler', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {rangeStartMillis: 2_000, rangeEndMillis: 8_000},
            currentTimeMillis: 5_000,
        })
        document.body.append(timeline)
        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        const ruler = timeline.shadowRoot.querySelector('[part="ruler"]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 1_000, width: 1_000})

        ruler.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0, clientX: 120}))
        expect(timeline.currentTimeMillis).toBe(2_500)

        ruler.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0, clientX: 160, altKey: true}))
        expect(timeline.timeline.rangeStartMillis).toBe(3_500)
        ruler.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0, clientX: 400, altKey: true}))
        expect(timeline.timeline.rangeStartMillis).toBe(3_500)

        ruler.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0, clientX: 120, ctrlKey: true}))
        expect(timeline.timeline.rangeEndMillis).toBe(8_000)
        ruler.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, button: 0, clientX: 320, ctrlKey: true}))
        expect(timeline.timeline.rangeEndMillis).toBe(7_500)
    })

    it('accepts arrow zoom from the window when the timeline widget is selected', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {keyboardZoomActive: true}})
        document.body.append(timeline)

        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', bubbles: true, cancelable: true}))

        expect(timeline.shadowRoot.querySelector('[data-layout]').style.getPropertyValue('--lgs-timeline-row-height'))
            .toBe('28px')
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
            trackId: 'main#one',
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

        timeline.shadowRoot.querySelector('[data-row-id="hidden-track"] [part="legend-content"]')
            .dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="hidden-track"]')).not.toBeNull()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-visibility"]').click()

        expect(timeline.shadowRoot.querySelector('[data-row-id="hidden-track"]')
            .classList.contains('lgs1920-wa-timeline__legend-row--hidden')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="track"][data-row-id="hidden-track"]')
            .classList.contains('lgs1920-wa-timeline__track--hidden')).toBe(true)
        const hiddenLegendContent = timeline.shadowRoot.querySelector('[data-row-id="hidden-track"] [part="legend-content"]')
        expect(hiddenLegendContent.classList.contains('lgs1920-wa-timeline__track-content--title-disabled')).toBe(true)
        expect(hiddenLegendContent.getAttribute('aria-disabled')).toBe('true')
        expect(hiddenLegendContent.querySelector('[data-edit-row-id]')).toBeNull()
        hiddenLegendContent.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="hidden-track"]')).toBeNull()
        const hiddenTrackBackground = timeline.shadowRoot.querySelector('[part="track-background"][data-row-id="hidden-track"]')
        expect(hiddenTrackBackground).not.toBeNull()
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

        const transportButtons = timeline.shadowRoot.querySelectorAll('[part="transport"] wa-button')
        const transportToolbar = timeline.shadowRoot.querySelector('[part="transport"] [part="controls"]')
        expect(transportButtons).toHaveLength(6)
        expect(transportToolbar.tagName).toBe('DIV')
        expect(transportToolbar.getAttribute('role')).toBe('toolbar')
        expect(timeline.shadowRoot.querySelector('[part="transport"] wa-button-group')).toBeNull()
        transportButtons.forEach(button => {
            expect(button.getAttribute('variant')).toBe('brand')
            expect(button.getAttribute('appearance')).toBe('plain')
        })

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

        expect(timeline.shadowRoot.querySelector('slot[name="custom-menu"]')).not.toBeNull()
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

    it('allows a selectable host to pass host drag input events', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {hostInteraction: 'selectable'}})
        const parentListener = vi.fn()
        const parent = document.createElement('div')
        parent.addEventListener('mousedown', parentListener)
        parent.addEventListener('mousemove', parentListener)
        parent.addEventListener('mouseup', parentListener)
        parent.addEventListener('pointerdown', parentListener)
        parent.addEventListener('click', parentListener)
        parent.addEventListener('contextmenu', parentListener)
        parent.addEventListener('dragstart', parentListener)
        parent.append(timeline)
        document.body.append(parent)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        const seeks = vi.fn()
        timeline.addEventListener('lgs1920-timeline-seek', seeks)
        surface.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, composed: true, clientX: 100}))
        surface.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, cancelable: true, composed: true, clientX: 120}))
        surface.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true, composed: true, clientX: 120}))
        surface.dispatchEvent(createPointerEvent('pointerdown', {clientX: 100, composed: true}))
        surface.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, composed: true}))
        surface.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, composed: true}))
        surface.dispatchEvent(new Event('dragstart', {bubbles: true, cancelable: true, composed: true}))

        expect(parentListener).toHaveBeenCalledTimes(7)
        expect(seeks).toHaveBeenCalledOnce()
    })

    it('keeps split-panel drag starts inside a selectable timeline host', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {hostInteraction: 'selectable'}})
        const parent = document.createElement('div')
        const parentStartListener = vi.fn()
        parent.addEventListener('mousedown', parentStartListener)
        parent.addEventListener('pointerdown', parentStartListener)
        parent.addEventListener('touchstart', parentStartListener)
        parent.append(timeline)
        document.body.append(parent)

        const splitPanel = timeline.shadowRoot.querySelector('[part="split-panel"]')
        const divider = document.createElement('div')
        divider.setAttribute('part', 'divider')
        splitPanel.append(divider)

        divider.dispatchEvent(createPointerEvent('pointerdown', {bubbles: true, composed: true}))
        divider.dispatchEvent(new MouseEvent('mousedown', {button: 0, bubbles: true, cancelable: true, composed: true}))
        divider.dispatchEvent(new Event('touchstart', {bubbles: true, cancelable: true, composed: true}))

        expect(parentStartListener).not.toHaveBeenCalled()
        window.dispatchEvent(createPointerEvent('pointerup'))
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
        expect(row.querySelector('slot[name="drag-trigger-main#one"]')).toBeNull()
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
            timeline: {showClipMenu: true},
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

    it('creates numbered generic movable tracks and restarts numbering after all are renamed', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {tracks: []})
        timeline.addEventListener('lgs1920-timeline-add-track', additions)
        document.body.append(timeline)

        const addTrack = () => timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-track"]').click()
        addTrack()
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__menu-item')).toBeNull()

        expect(additions).toHaveBeenCalledOnce()
        expect(additions.mock.calls[0][0].detail.track).toMatchObject({
            id: 'track-1',
            label: 'Track 1',
            clips: [],
        })
        expect(additions.mock.calls[0][0].detail.track).not.toHaveProperty('movable')
        expect(additions.mock.calls[0][0].detail.track).not.toHaveProperty('fixed')
        expect(additions.mock.calls[0][0].detail.track).not.toHaveProperty('locked')
        addTrack()
        addTrack()
        expect(timeline.tracks.map(track => track.label)).toEqual(['Track 3', 'Track 2', 'Track 1'])

        timeline.shadowRoot.querySelector('[data-row-id="track-1"] [data-testid="lgs1920-wa-remove-track"]').click()
        addTrack()
        expect(timeline.tracks.map(track => track.label)).toEqual(['Track 4', 'Track 3', 'Track 2'])
        expect(timeline.tracks[0].id).toBe('track-4')

        timeline.tracks = timeline.tracks.map(track => ({...track, label: `Renamed ${track.id}`}))
        addTrack()
        expect(timeline.tracks[0]).toMatchObject({id: 'track-1', label: 'Track 1', autoNumbered: true})
    })

    it('keeps a locally created track when a parent replays the previous controlled snapshot', () => {
        const timeline = new LGS1920Timeline()
        const controlledTracks = [{id: 'base', label: 'Base', clips: []}]
        configureTimeline(timeline, {tracks: controlledTracks})
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-track"]').click()
        expect(timeline.tracks.map(track => track.id)).toEqual(['track-1', 'base'])

        timeline.tracks = controlledTracks

        expect(timeline.tracks.map(track => track.id)).toEqual(['track-1', 'base'])
        expect(timeline.shadowRoot.querySelector('[data-row-id="track-1"]')).not.toBeNull()
    })

    it('restarts labels at Track 1 while keeping ids unique after renaming every generated track', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {tracks: []})
        document.body.append(timeline)

        const addTrack = () => timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-track"]').click()
        addTrack()
        addTrack()
        addTrack()
        timeline.tracks = timeline.tracks.map(track => ({...track, label: `Renamed ${track.id}`}))

        addTrack()

        expect(timeline.tracks[0]).toMatchObject({id: 'track-1-2', label: 'Track 1', autoNumbered: true})
    })

    it('stacks generic tracks at the highest editable position between read-only bounds', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [
                {id: 'locked-high', label: 'Locked high', editable: false, clips: []},
                {id: 'existing', label: 'Existing', clips: []},
                {id: 'locked-low', label: 'Locked low', editable: false, clips: []},
            ],
        })
        document.body.append(timeline)

        const addTrack = () => timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-track"]').click()
        addTrack()
        addTrack()

        expect(timeline.tracks.map(track => track.id)).toEqual([
            'locked-high',
            'track-2',
            'track-1',
            'existing',
            'locked-low',
        ])
    })

    it('does not add a track when the read-only bounds are contiguous', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {id: 'locked-high', label: 'Locked high', editable: false, clips: []},
                {id: 'locked-low', label: 'Locked low', editable: false, clips: []},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-add-track', additions)
        document.body.append(timeline)

        const addTrack = timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-track"]')
        expect(addTrack.hasAttribute('disabled')).toBe(true)
        addTrack.click()

        expect(additions).not.toHaveBeenCalled()
        expect(timeline.tracks.map(track => track.id)).toEqual([
            'locked-high',
            'locked-low',
        ])
    })

    it('skips every insertion slot directly between adjacent read-only tracks', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [
                {id: 'locked-first', label: 'Locked first', editable: false, clips: []},
                {id: 'locked-second', label: 'Locked second', editable: false, clips: []},
                {id: 'editable', label: 'Editable', editable: true, clips: []},
                {id: 'locked-last', label: 'Locked last', editable: false, clips: []},
            ],
        })
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-track"]').click()

        expect(timeline.tracks.map(track => track.id)).toEqual([
            'locked-first',
            'locked-second',
            'track-1',
            'editable',
            'locked-last',
        ])
    })

    it('ignores legacy track movement flags and uses editable for row bounds', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [
                {id: 'locked-high', label: 'Locked high', locked: true, fixed: true, movable: false, editable: false, clips: []},
                {id: 'moving', label: 'Moving', movable: false, editable: true, clips: []},
                {id: 'locked-low', label: 'Locked low', locked: true, fixed: true, movable: false, editable: false, clips: []},
            ],
        })
        document.body.append(timeline)

        const nameArea = timeline.shadowRoot.querySelector('[data-row-id="moving"] [part="legend-content"]')
        nameArea.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: -100}))

        expect(timeline.hasAttribute('data-row-drop-rejected')).toBe(true)
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: -100}))
        expect(timeline.tracks.map(track => track.id)).toEqual(['locked-high', 'moving', 'locked-low'])
    })

    it('keeps the source rows fixed and shows synchronized ghost and insertion marker during row drag', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [
                {id: 'locked-high', label: 'Locked high', editable: false, clips: []},
                {id: 'moving', label: 'Moving', editable: true, clips: []},
                {id: 'existing', label: 'Existing', clips: []},
                {id: 'locked-low', label: 'Locked low', editable: false, clips: []},
            ],
        })
        document.body.append(timeline)

        const initialOrder = timeline.tracks.map(track => track.id)
        const nameArea = timeline.shadowRoot.querySelector('[data-row-id="moving"] [part="legend-content"]')
        nameArea.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 36}))

        expect(timeline.tracks.map(track => track.id)).toEqual(initialOrder)
        expect(timeline.shadowRoot.querySelectorAll('[data-row-drag-ghost]')).toHaveLength(2)
        expect(timeline.shadowRoot.querySelectorAll('[data-row-drag-marker]')).toHaveLength(2)
        expect(timeline.shadowRoot.querySelectorAll('.lgs1920-wa-timeline__row-drag-ghost--valid')).toHaveLength(2)
        const layout = timeline.shadowRoot.querySelector('[data-layout]')
        const rowHeight = Number.parseFloat(layout
            .style.getPropertyValue('--lgs-timeline-row-height'))
        const ghostScreenTopValues = [...timeline.shadowRoot.querySelectorAll('[data-row-drag-ghost]')]
            .map(element => Number.parseFloat(element.style.top) + layout.getBoundingClientRect().top)
        expect(new Set(ghostScreenTopValues).size).toBe(1)
        expect(ghostScreenTopValues[0]).toBeCloseTo(36 - (rowHeight / 2))

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 36}))

        expect(timeline.tracks.map(track => track.id)).toEqual(['locked-high', 'existing', 'moving', 'locked-low'])
    })

    it('keeps the visual position when a hidden source row is dragged to the second place from the bottom', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [
                {id: 'top', label: 'Top', clips: []},
                {id: 'moving', label: 'Moving', clips: []},
                {id: 'second-from-bottom', label: 'Second from bottom', clips: []},
                {id: 'bottom', label: 'Bottom', clips: []},
            ],
        })
        document.body.append(timeline)

        const nameArea = timeline.shadowRoot.querySelector('[data-row-id="moving"] [part="legend-content"]')
        nameArea.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 36}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 36}))

        expect(timeline.tracks.map(track => track.id)).toEqual([
            'top',
            'second-from-bottom',
            'moving',
            'bottom',
        ])
    })

    it('aligns row ghosts in one shared overlay despite different viewport coordinates', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [
                {id: 'moving', label: 'Moving', editable: true, clips: []},
                {id: 'existing', label: 'Existing', clips: []},
            ],
        })
        document.body.append(timeline)

        const legendViewport = timeline.shadowRoot.querySelector('[data-scroll-view="legend"]')
        const tracksViewport = timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')
        Object.defineProperty(legendViewport, 'scrollTop', {configurable: true, writable: true, value: 10})
        Object.defineProperty(tracksViewport, 'scrollTop', {configurable: true, writable: true, value: 14})
        vi.spyOn(legendViewport, 'getBoundingClientRect').mockReturnValue({top: 100, left: 0, width: 150, height: 100})
        vi.spyOn(tracksViewport, 'getBoundingClientRect').mockReturnValue({top: 104, left: 150, width: 300, height: 100})

        const nameArea = timeline.shadowRoot.querySelector('[data-row-id="moving"] [part="legend-content"]')
        nameArea.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 60}))

        const ghostLayer = timeline.shadowRoot.querySelector('[data-row-drag-ghost-layer]')
        const ghosts = [...timeline.shadowRoot.querySelectorAll('[data-row-drag-ghost]')]
        const ghostScreenTopValues = ghosts.map(element => Number.parseFloat(element.style.top))
        expect(ghosts.every(element => element.parentElement === ghostLayer)).toBe(true)
        expect(new Set(ghostScreenTopValues.map(value => value.toFixed(4))).size).toBe(1)

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 60}))
    })

    it('removes unlocked tracks and emits the complete controlled snapshot', () => {
        const timeline = new LGS1920Timeline()
        const removals = vi.fn()
        configureTimeline(timeline, {
            tracks: [{id: 'removable', label: 'Removable', clips: []}],
        })
        timeline.addEventListener('lgs1920-timeline-remove-track', removals)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-row-id="removable"] [data-testid="lgs1920-wa-remove-track"]').click()

        expect(removals).toHaveBeenCalledOnce()
        expect(removals.mock.calls[0][0].detail.trackId).toBe('removable')
        expect(removals.mock.calls[0][0].detail.track.label).toBe('Removable')
        expect(removals.mock.calls[0][0].detail.tracks).toEqual([])
        expect(timeline.tracks).toEqual([])
    })

    it('hides track removal when clips are present and rejects a stale removal action', () => {
        const timeline = new LGS1920Timeline()
        const removals = vi.fn()
        configureTimeline(timeline, {
            tracks: [{id: 'track', label: 'Track', clips: []}],
        })
        timeline.addEventListener('lgs1920-timeline-remove-track', removals)
        document.body.append(timeline)

        const staleRemove = timeline.shadowRoot.querySelector('[data-row-id="track"] [data-testid="lgs1920-wa-remove-track"]')
        timeline.tracks = [{id: 'track', label: 'Track', clips: [{id: 'clip', start: 0, end: 1}]}]

        expect(timeline.shadowRoot.querySelector('[data-row-id="track"] [data-testid="lgs1920-wa-remove-track"]')).toBeNull()
        staleRemove.click()

        expect(removals).not.toHaveBeenCalled()
        expect(timeline.tracks).toHaveLength(1)
        expect(timeline.tracks[0].clips).toHaveLength(1)
    })

    it('uses editable as the only track removal switch', () => {
        const timeline = new LGS1920Timeline()
        const removals = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {id: 'locked', label: 'Locked', locked: true, editable: false, clips: []},
                {id: 'fixed', label: 'Fixed', fixed: true, movable: false, editable: true, clips: []},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-remove-track', removals)
        document.body.append(timeline)

        expect(timeline.shadowRoot.querySelector('[data-row-id="locked"] [data-testid="lgs1920-wa-remove-track"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-row-id="fixed"] [data-testid="lgs1920-wa-remove-track"]')).not.toBeNull()
        timeline.shadowRoot.querySelector('[data-row-id="fixed"] [data-testid="lgs1920-wa-remove-track"]').click()

        expect(timeline.tracks.map(track => track.id)).toEqual(['locked'])
        expect(removals).toHaveBeenCalledTimes(1)
    })

    it('uses editable on each track for all track and clip editing actions', () => {
        const timeline = new LGS1920Timeline()
        const labelChanges = vi.fn()
        const clipChanges = vi.fn()
        const selections = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {id: 'read-only', label: 'Read only', editable: false, clips: [{id: 'read-only-clip', start: 1, end: 3}]},
                {id: 'editable', label: 'Editable', editable: true, clips: [{id: 'editable-clip', start: 1, end: 3}]},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-track-label-change', labelChanges)
        timeline.addEventListener('lgs1920-timeline-clip-change', clipChanges)
        timeline.addEventListener('lgs1920-timeline-clip-select', selections)
        document.body.append(timeline)

        const readOnlyRow = timeline.shadowRoot.querySelector('[data-row-id="read-only"]')
        const editableRow = timeline.shadowRoot.querySelector('[data-row-id="editable"]')
        expect(readOnlyRow.classList.contains('lgs1920-wa-timeline__legend-row--movable')).toBe(false)
        expect(readOnlyRow.classList.contains('lgs1920-wa-timeline__legend-row--read-only')).toBe(true)
        expect(readOnlyRow.querySelector('[part="legend-content"]')
            .classList.contains('lgs1920-wa-timeline__track-content--title-disabled')).toBe(true)
        expect(editableRow.classList.contains('lgs1920-wa-timeline__legend-row--movable')).toBe(true)
        expect(editableRow.classList.contains('test-no-drag')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="track"][data-row-id="read-only"]')
            .classList.contains('lgs1920-wa-timeline__track--read-only')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="track-background"][data-row-id="read-only"]')
            .classList.contains('lgs1920-wa-timeline__track-background--read-only')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="track"][data-row-id="editable"]')
            .classList.contains('lgs1920-wa-timeline__track--read-only')).toBe(false)
        expect(readOnlyRow.querySelector('wa-icon')).toBeNull()
        expect(readOnlyRow.querySelector('[data-testid="lgs1920-wa-remove-track"]')).toBeNull()
        expect(editableRow.querySelector('[data-testid="lgs1920-wa-remove-track"]')).toBeNull()
        expect(readOnlyRow.querySelector('slot[name="actions-read-only"]')).toBeNull()
        expect(editableRow.querySelector('slot[name="actions-editable"]')).not.toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-clip-id="read-only-clip"]')
            .classList.contains('lgs1920-wa-timeline__clip--movable')).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-clip-id="read-only-clip"]').getAttribute('tabindex')).toBe('0')
        expect(timeline.shadowRoot.querySelector('[data-clip-id="read-only-clip"]').getAttribute('role')).toBe('button')
        expect(timeline.shadowRoot.querySelector('[data-clip-id="editable-clip"]')
            .classList.contains('lgs1920-wa-timeline__clip--movable')).toBe(true)

        readOnlyRow.querySelector('[part="legend-content"]')
            .dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        editableRow.querySelector('[part="legend-content"]')
            .dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="read-only"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="editable"]')).not.toBeNull()

        timeline.shadowRoot.querySelector('[data-clip-id="read-only-clip"]')
            .dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        expect(timeline.selectedClipId).toBe('read-only-clip')
        expect(selections).toHaveBeenCalledWith(expect.objectContaining({detail: expect.objectContaining({selected: true, clipId: 'read-only-clip'})}))
        expect(clipChanges).not.toHaveBeenCalled()
        expect(labelChanges).not.toHaveBeenCalled()
    })

    it('disables every track and clip editing action when editable is false', () => {
        const timeline = new LGS1920Timeline()
        const beforeDrag = vi.fn()
        const labelChanges = vi.fn()
        const clipChanges = vi.fn()
        const rangeChanges = vi.fn()
        configureTimeline(timeline, {
            timeline: {editable: false, showClipMenu: true},
            tracks: [{
                id: 'track',
                label: 'Track',
                canHide: true,
                clips: [{id: 'clip', kind: 'video', start: 1, end: 4}],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-before-drag', beforeDrag)
        timeline.addEventListener('lgs1920-timeline-track-label-change', labelChanges)
        timeline.addEventListener('lgs1920-timeline-clip-change', clipChanges)
        timeline.addEventListener('lgs1920-timeline-range-change', rangeChanges)
        document.body.append(timeline)

        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-track"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-row-id="track"] [data-testid="lgs1920-wa-remove-track"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-row-id="track"] [data-testid="lgs1920-wa-visibility"]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-row-id="track"]')
            .classList.contains('lgs1920-wa-timeline__legend-row--movable')).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .classList.contains('lgs1920-wa-timeline__clip--movable')).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-clip-handle="end"]').getAttribute('tabindex')).toBe('-1')

        timeline.shadowRoot.querySelector('slot[name="track-label-track"]')
            .dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        timeline.shadowRoot.querySelector('[data-range-handle="end"]')
            .dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))

        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="track"]')).toBeNull()
        expect(labelChanges).not.toHaveBeenCalled()
        expect(clipChanges).not.toHaveBeenCalled()
        expect(rangeChanges).not.toHaveBeenCalled()
        expect(beforeDrag).not.toHaveBeenCalled()
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

    it('keeps the playhead in place while range handles move around it', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {
                rangeStartMillis: 1_000,
                rangeEndMillis: 8_000,
            },
            currentTimeMillis: 5_000,
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const playhead = timeline.shadowRoot.querySelector('[data-playhead]')
        const initialPlayheadPosition = playhead.style.left
        const startHandle = timeline.shadowRoot.querySelector('[data-range-handle="start"]')
        startHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 100, clientY: 50}))

        expect(timeline.currentTimeMillis).toBe(5_000)
        expect(playhead.style.left).toBe(initialPlayheadPosition)
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 100, clientY: 50}))
        surface.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, clientX: 100, clientY: 50}))
        expect(timeline.currentTimeMillis).toBe(5_000)
        expect(playhead.style.left).toBe(initialPlayheadPosition)

        const endHandle = timeline.shadowRoot.querySelector('[data-range-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 340, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 180, clientY: 50}))

        expect(timeline.currentTimeMillis).toBe(4_000)
        expect(playhead.style.left).not.toBe(initialPlayheadPosition)
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 180, clientY: 50}))
        expect(timeline.currentTimeMillis).toBe(4_000)
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

    it('cancels track label editing when the pointer leaves the editor', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'track', label: 'Track', clips: []}],
        })
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-row-id="track"] [part="legend-content"]')
            .dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="track"]')).not.toBeNull()

        document.body.dispatchEvent(createPointerEvent('pointerdown', {clientX: 600, clientY: 400}))

        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="track"]')).toBeNull()
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
        const changeStart = vi.fn()
        const changing = vi.fn()
        const changes = vi.fn()
        configureTimeline(timeline)
        timeline.addEventListener('lgs1920-timeline-clip-change-start', changeStart)
        timeline.addEventListener('lgs1920-timeline-clip-changing', changing)
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 220, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 220, clientY: 50}))

        expect(endHandle.getAttribute('part')).toBe('clip-end-handle')
        expect(changeStart).toHaveBeenCalledOnce()
        expect(changeStart.mock.calls[0][0].detail).toMatchObject({type: 'resize', resizeEdge: 'end'})
        expect(changing).toHaveBeenCalled()
        expect(changes).toHaveBeenCalledOnce()
        expect(changes.mock.calls[0][0].detail.type).toBe('resize')
        expect(changes.mock.calls[0][0].detail.edge).toBe('end')
        expect(changes.mock.calls[0][0].detail.clip.end).toBe(5)
    })

    it('honors the public resizable clip setting', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{
                id: 'locked-size',
                label: 'Locked size',
                clips: [{id: 'locked-clip', kind: 'video', start: 1, end: 4, resizable: false}],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const handle = timeline.shadowRoot.querySelector('[data-clip-id="locked-clip"] [data-clip-handle="end"]')
        expect(handle.getAttribute('tabindex')).toBe('-1')
        expect(handle.getAttribute('aria-hidden')).toBe('true')
        handle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        expect(changes).not.toHaveBeenCalled()
    })

    it('hides and blocks Extend for non-resizable clips', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [{id: 'locked-clip', kind: 'video', start: 1, end: 4, resizable: false}],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-extend', changes)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-clip-id="locked-clip"]')
            .dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 240, clientY: 80}))

        const menu = timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')
        expect(menu.querySelector('[data-testid="lgs1920-wa-clip-menu-extend"]')).toBeNull()
        expect(changes).not.toHaveBeenCalled()
    })

    it('honors editable false on an individual clip', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [{id: 'locked-clip', kind: 'video', start: 1, end: 4, editable: false}],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="locked-clip"]')
        expect(clip.classList.contains('lgs1920-wa-timeline__clip--movable')).toBe(false)
        expect(clip.querySelector('[data-clip-handle="start"]').getAttribute('tabindex')).toBe('-1')
        expect(clip.querySelector('[data-clip-handle="end"]').getAttribute('tabindex')).toBe('-1')

        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        expect(changes).not.toHaveBeenCalled()
    })

    it('requests clip removal before committing it and allows cancellation', () => {
        const timeline = new LGS1920Timeline()
        const beforeRemove = vi.fn(event => event.preventDefault())
        const removals = vi.fn()
        const afterRemove = vi.fn()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        timeline.addEventListener('lgs1920-timeline-before-remove-clip', beforeRemove)
        timeline.addEventListener('lgs1920-timeline-remove-clip', removals)
        timeline.addEventListener('lgs1920-timeline-after-remove-clip', afterRemove)
        document.body.append(timeline)

        let clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'Delete', bubbles: true, cancelable: true}))

        expect(beforeRemove).toHaveBeenCalledOnce()
        expect(beforeRemove.mock.calls[0][0].cancelable).toBe(true)
        expect(beforeRemove.mock.calls[0][0].detail).toMatchObject({
            clipId: 'clip',
            trackId: 'main',
            tracks: [{id: 'main', clips: []}],
            previousTracks: [{id: 'main', clips: [expect.objectContaining({id: 'clip'})]}],
        })
        expect(removals).not.toHaveBeenCalled()
        expect(timeline.tracks[0].clips).toHaveLength(1)

        timeline.removeEventListener('lgs1920-timeline-before-remove-clip', beforeRemove)
        clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true}))

        expect(removals).toHaveBeenCalledOnce()
        expect(afterRemove).toHaveBeenCalledOnce()
        expect(removals.mock.calls[0][0].detail).toMatchObject({
            clipId: 'clip',
            trackId: 'main',
            clip: {id: 'clip', trackId: 'main'},
            tracks: [{id: 'main', clips: []}],
        })
        expect(afterRemove.mock.calls[0][0].detail).toMatchObject({
            clipId: 'clip',
            trackId: 'main',
            tracks: [{id: 'main', clips: []}],
        })
        expect(timeline.tracks[0].clips).toHaveLength(0)
    })

    it('opens a clip context menu with clip management and color actions', () => {
        const timeline = new LGS1920Timeline()
        const visibility = vi.fn()
        const color = vi.fn()
        configureTimeline(timeline, {
            timeline: {durationMillis: 10_000},
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [{id: 'clip', start: 2, end: 4, visible: true}],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-visibility-change', visibility)
        timeline.addEventListener('lgs1920-timeline-clip-color-change', color)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 240, clientY: 80}))

        const menu = timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')
        expect(menu).not.toBeNull()
        expect(menu.hasAttribute('active')).toBe(true)
        expect(menu.hasAttribute('flip')).toBe(true)
        expect(menu.hasAttribute('shift')).toBe(true)
        expect(menu.querySelector('[data-testid="lgs1920-wa-clip-menu-remove"]')).not.toBeNull()
        expect(menu.querySelector('[data-testid="lgs1920-wa-clip-menu-duplicate"]')).not.toBeNull()
        expect(menu.querySelector('[data-testid="lgs1920-wa-clip-menu-enabled"]')).not.toBeNull()
        expect(menu.querySelector('[data-testid="lgs1920-wa-clip-menu-visibility"]')).not.toBeNull()
        expect(menu.querySelector('[data-testid="lgs1920-wa-clip-menu-extend"]')).not.toBeNull()
        const colorTrigger = menu.querySelector('[data-testid="lgs1920-wa-clip-menu-color"]')
        expect(colorTrigger).not.toBeNull()
        const menuItems = [...menu.querySelectorAll('.lgs1920-wa-timeline__menu-item')]
        expect(menuItems.every(item => item.querySelector('.lgs1920-wa-timeline__menu-icon')
            && item.querySelector('.lgs1920-wa-timeline__menu-icon wa-icon')
            && item.querySelector('.lgs1920-wa-timeline__menu-icon').getAttribute('slot') === 'start'
            && item.querySelector('.lgs1920-wa-timeline__menu-label'))).toBe(true)

        colorTrigger.click()
        const colorPicker = timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-menu-color"]')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-color-menu"]')).toBeNull()
        expect(colorPicker.classList.contains('lgs1920-wa-timeline__clip-color-picker--menu-trigger')).toBe(true)
        expect(colorPicker.open).toBe(true)
        expect(colorPicker.swatches).toHaveLength(10)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-clip-menu-color"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-clip-menu-visibility"]').click()
        expect(visibility).toHaveBeenCalledOnce()
        expect(timeline.tracks[0].clips[0].visible).toBe(false)

        timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 240, clientY: 80}))
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-clip-menu-color"]').click()
        const nextColorPicker = timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-menu-color"]')
        const clipBeforeColor = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        nextColorPicker.value = ''
        nextColorPicker.dispatchEvent(new CustomEvent('input', {
            bubbles: true,
            cancelable: true,
            detail: {value: ''},
        }))
        expect(color).not.toHaveBeenCalled()
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')).not.toBeNull()

        nextColorPicker.value = '#ef4444'
        nextColorPicker.dispatchEvent(new CustomEvent('input', {
            bubbles: true,
            cancelable: true,
            detail: {value: '#ef4444'},
        }))
        expect(color).toHaveBeenCalledOnce()
        expect(timeline.tracks[0].clips[0].colorClasses).toEqual(['wa-neutral', 'wa-neutral-red'])
        expect(timeline.shadowRoot.querySelector('[data-clip-id="clip"]')).toBe(clipBeforeColor)
        expect(clipBeforeColor.classList).toContain('wa-neutral-red')
        expect(clipBeforeColor.style.backgroundColor).toBe('var(--wa-color-red-50)')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')).toBeNull()
    })

    it('provides default swatches through the timeline configuration', () => {
        const timeline = new LGS1920Timeline()
        timeline.timeline = {durationMillis: 10_000}
        timeline.tracks = [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 2, end: 4}]}]
        document.body.append(timeline)

        expect(timeline.timeline.swatches).toHaveLength(10)
        timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 240, clientY: 80}))

        const colorPicker = timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-menu-color"]')
        expect(colorPicker).not.toBeNull()
        expect(colorPicker.swatches).toHaveLength(10)
    })

    it('selects a clip on click or drag and keeps native input inside the timeline', () => {
        const timeline = new LGS1920Timeline()
        const parentPointerDown = vi.fn()
        const parentClick = vi.fn()
        const selection = vi.fn()
        const wrapper = document.createElement('div')
        wrapper.addEventListener('pointerdown', parentPointerDown)
        wrapper.addEventListener('click', parentClick)
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        timeline.addEventListener('lgs1920-timeline-clip-select', selection)
        wrapper.append(timeline)
        document.body.append(wrapper)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 60, clientY: 50}))
        expect(clip.classList.contains('lgs1920-wa-timeline__clip--selected')).toBe(true)
        expect(clip.getAttribute('aria-selected')).toBe('true')
        expect(clip).toBe(document.activeElement?.shadowRoot?.activeElement ?? clip)
        expect(timeline.selectedClipId).toBe('clip')
        expect(selection).toHaveBeenCalledOnce()

        clip.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true, cancelable: true}))
        expect(parentPointerDown).not.toHaveBeenCalled()
        expect(parentClick).not.toHaveBeenCalled()

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 60, clientY: 50}))
    })

    it('moves the selected clip by one pixel or ten pixels with Alt arrows', () => {
        const timeline = new LGS1920Timeline()
        const parentKeydown = vi.fn()
        const wrapper = document.createElement('div')
        wrapper.addEventListener('keydown', parentKeydown)
        configureTimeline(timeline, {
            timeline: {snap: false},
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        wrapper.append(timeline)
        document.body.append(wrapper)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 60, clientY: 50}))
        const initialStart = timeline.tracks[0].clips[0].start

        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        const onePixelDelta = timeline.tracks[0].clips[0].start - initialStart
        expect(onePixelDelta).toBeGreaterThan(0)

        clip.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            altKey: true,
            bubbles: true,
            cancelable: true,
        }))
        const tenPixelDelta = timeline.tracks[0].clips[0].start - initialStart - onePixelDelta
        expect(tenPixelDelta).toBeCloseTo(onePixelDelta * 10)

        const beforeHostMove = timeline.tracks[0].clips[0].start
        timeline.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowLeft',
            bubbles: true,
            cancelable: true,
            composed: true,
        }))
        expect(timeline.tracks[0].clips[0].start).toBeLessThan(beforeHostMove)
        expect(parentKeydown).not.toHaveBeenCalled()
    })

    it('selects a focused clip before moving it with an arrow', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {snap: false},
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.focus()
        const initialStart = timeline.tracks[0].clips[0].start
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))

        expect(timeline.selectedClipId).toBe('clip')
        expect(timeline.tracks[0].clips[0].start).toBeGreaterThan(initialStart)
        expect(clip.classList.contains('lgs1920-wa-timeline__clip--selected')).toBe(true)
    })

    it('keeps trapping repeated arrows when snapping is enabled', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.focus()
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        const firstStart = timeline.tracks[0].clips[0].start
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))

        expect(timeline.tracks[0].clips[0].start).toBeGreaterThan(firstStart)
    })

    it('keeps trapping arrows after a keyboard move followed by a pointer move', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {snap: false},
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 100, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 100, clientY: 50}))

        const movedStart = timeline.tracks[0].clips[0].start
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(timeline.tracks[0].clips[0].start).toBeGreaterThan(movedStart)
    })

    it('keeps the keyboard selection after moving a keyboard-edited clip to another track', () => {
        const timeline = new LGS1920Timeline()
        const tracks = [
            {id: 'source', label: 'Source', clips: [{id: 'clip', kind: 'video', start: 1, end: 4}]},
            {id: 'target', label: 'Target', accepts: ['video'], clips: []},
        ]
        configureTimeline(timeline, {timeline: {snap: false}, tracks})
        timeline.addEventListener('lgs1920-timeline-clip-change', event => {
            timeline.tracks = event.detail.tracks
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.focus()
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(timeline.selectedClipId).toBe('clip')

        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 108, clientY: 70}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 108, clientY: 70}))

        expect(timeline.selectedClipId).toBe('clip')
        expect(timeline.shadowRoot.activeElement?.getAttribute('data-clip-id')).toBe('clip')
        const movedStart = timeline.tracks[1].clips[0].start
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(timeline.tracks[1].clips[0].start).toBeGreaterThan(movedStart)
    })

    it('opens the context menu for a stationary touch hold without expanding the clip', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {
            pointerType: 'touch',
            clientX: 60,
            clientY: 50,
        }))
        window.dispatchEvent(createPointerEvent('pointermove', {
            pointerType: 'touch',
            clientX: 62,
            clientY: 52,
        }))

        expect(clip.style.height).toBe('')
        expect(clip.style.top).toBe('')
        expect(timeline.shadowRoot.querySelector('[data-clip-drag-ghost]')).toBeNull()

        clip.dispatchEvent(createPointerEvent('contextmenu', {
            pointerType: 'touch',
            clientX: 62,
            clientY: 52,
        }))

        expect(timeline.selectedClipId).toBe('clip')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')).not.toBeNull()
    })

    it('cancels a touch resize before opening the clip context menu', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        const handle = clip.querySelector('[data-clip-handle="end"]')
        handle.dispatchEvent(createPointerEvent('pointerdown', {
            pointerType: 'touch',
            clientX: 180,
            clientY: 50,
        }))
        handle.dispatchEvent(createPointerEvent('contextmenu', {
            pointerType: 'touch',
            clientX: 180,
            clientY: 50,
        }))

        expect(clip.style.height).toBe('')
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')).not.toBeNull()
    })

    it('clears the clip selection from neutral timeline areas and Escape', () => {
        const timeline = new LGS1920Timeline()
        const selection = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]},
                {id: 'empty', label: 'Empty', clips: []},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-clip-select', selection)
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        const selectClip = () => {
            clip.dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 60, clientY: 50}))
            window.dispatchEvent(createPointerEvent('pointerup', {clientX: 60, clientY: 50}))
        }

        selectClip()
        timeline.shadowRoot.querySelector('[part="track"][data-row-id="empty"]')
            .dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 80, clientY: 90}))
        expect(timeline.selectedClipId).toBeNull()
        expect(clip.getAttribute('aria-selected')).toBe('false')

        selectClip()
        timeline.shadowRoot.querySelector('[part="legend-row"][data-row-id="empty"]')
            .dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 20, clientY: 90}))
        expect(timeline.selectedClipId).toBeNull()

        selectClip()
        timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
            .dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 20, clientY: 20}))
        expect(timeline.selectedClipId).toBeNull()

        selectClip()
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}))
        expect(timeline.selectedClipId).toBeNull()
        expect(selection).toHaveBeenLastCalledWith(expect.objectContaining({detail: expect.objectContaining({selected: false, clipId: 'clip'})}))
    })

    it('toggles an already selected clip on click but keeps it selected when dragged', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 60, clientY: 50}))
        expect(timeline.selectedClipId).toBe('clip')

        clip.dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 60, clientY: 50}))
        expect(timeline.selectedClipId).toBeNull()
        expect(clip.getAttribute('aria-selected')).toBe('false')

        clip.dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 100, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 100, clientY: 50}))
        expect(timeline.selectedClipId).toBe('clip')
        expect(clip.getAttribute('aria-selected')).toBe('true')

        const movedStart = timeline.tracks[0].clips[0].start
        timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
            .dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(timeline.tracks[0].clips[0].start).toBeGreaterThan(movedStart)
        const movedAgainStart = timeline.tracks[0].clips[0].start
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(timeline.tracks[0].clips[0].start).toBeGreaterThan(movedAgainStart)
    })

    it('adds configured custom clip actions to the context menu', () => {
        const timeline = new LGS1920Timeline()
        const action = vi.fn()
        configureTimeline(timeline, {
            timeline: {
                clipActions: [{key: 'split', label: 'Split clip', icon: 'scissors'}],
            },
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        timeline.addEventListener('lgs1920-timeline-clip-action', action)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 240, clientY: 80}))

        const menu = timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')
        expect(menu.hasAttribute('active')).toBe(true)
        expect(menu.getAttribute('placement')).toBe('bottom-start')
        expect(menu.anchor).toEqual(expect.objectContaining({getBoundingClientRect: expect.any(Function)}))
        expect(menu.anchor).not.toHaveProperty('contextElement')
        const customAction = menu.querySelector('[data-clip-action="split"]')
        expect(customAction).not.toBeNull()
        expect(customAction.getAttribute('aria-label')).toBe('Split clip')
        customAction.click()

        expect(action).toHaveBeenCalledOnce()
        expect(action.mock.calls[0][0].detail).toMatchObject({
            key: 'split',
            clipId: 'clip',
            trackId: 'main',
            clip: {id: 'clip'},
        })
    })

    it('dismisses the clip context menu when pressing elsewhere in the timeline', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, composed: true, clientX: 240, clientY: 80}))
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')).not.toBeNull()

        timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
            .dispatchEvent(createPointerEvent('pointerdown', {composed: true, clientX: 40, clientY: 40}))

        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')).toBeNull()
    })

    it('copies and masks the selected clip with keyboard shortcuts', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        const visibility = vi.fn()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        timeline.addEventListener('lgs1920-timeline-add-clip', additions)
        timeline.addEventListener('lgs1920-timeline-clip-visibility-change', visibility)
        document.body.append(timeline)

        let clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.focus()
        clip.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'c',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        }))
        expect(additions).not.toHaveBeenCalled()
        const copyGhost = timeline.shadowRoot.querySelector('[data-clip-copy-ghost]')
        expect(copyGhost).not.toBeNull()
        expect(copyGhost.classList).toContain('lgs1920-wa-timeline__clip--copy-ghost')
        expect(copyGhost.style.left).toBe(clip.style.left)
        expect(copyGhost.style.transform).toBe('translate(-12px, 12px)')

        timeline.dispatchEvent(createPointerEvent('pointerdown', {clientX: 240, clientY: 50, composed: true}))

        expect(additions).toHaveBeenCalledOnce()
        expect(timeline.tracks[0].clips).toHaveLength(2)
        expect(timeline.tracks[0].clips[1]).toMatchObject({id: 'clip-copy', start: 4, end: 7})

        clip = timeline.shadowRoot.querySelector('[data-clip-id="clip-copy"]')
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'm', bubbles: true, cancelable: true}))
        expect(visibility).toHaveBeenCalledOnce()
        expect(timeline.tracks[0].clips[1].visible).toBe(false)
    })

    it('cancels a pending copy when clicking outside the timeline', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.focus()
        clip.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'c',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        }))
        expect(timeline.shadowRoot.querySelector('[data-clip-copy-ghost]')).not.toBeNull()

        document.body.dispatchEvent(createPointerEvent('pointerdown', {clientX: 900, clientY: 500}))

        expect(timeline.shadowRoot.querySelector('[data-clip-copy-ghost]')).toBeNull()
        expect(timeline.tracks[0].clips).toHaveLength(1)
    })

    it('cancels a pending copy with a right click without opening a context menu', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.focus()
        clip.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'c',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        }))
        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        surface.dispatchEvent(createPointerEvent('pointerdown', {
            button: 2,
            clientX: 240,
            clientY: 50,
            composed: true,
        }))
        surface.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: 240,
            clientY: 50,
        }))

        expect(timeline.shadowRoot.querySelector('[data-clip-copy-ghost]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-testid="lgs1920-timeline-clip-context-menu"]')).toBeNull()
        expect(timeline.tracks[0].clips).toHaveLength(1)
    })

    it('shows the copy ghost immediately from the clip context menu', async () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, composed: true, clientX: 240, clientY: 80}))
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-clip-menu-duplicate"]').click()

        const copyGhost = timeline.shadowRoot.querySelector('[data-clip-copy-ghost]')
        const sourceClip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        expect(copyGhost).not.toBeNull()
        expect(copyGhost.style.left).toBe(sourceClip.style.left)
        expect(copyGhost.style.transform).toBe('translate(-12px, 12px)')

        timeline.dispatchEvent(createPointerEvent('pointermove', {clientX: 240, clientY: 80, composed: true}))
        expect(timeline.shadowRoot.querySelector('[data-clip-copy-ghost]').style.transform).toBe('')

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        expect(timeline.shadowRoot.querySelector('[data-building-overlay]')).toBeNull()
    })

    it('applies the standardized keyboard shortcuts to the local timeline', () => {
        const timeline = new LGS1920Timeline()
        const play = vi.fn()
        const pause = vi.fn()
        const seek = vi.fn()
        const enabled = vi.fn()
        configureTimeline(timeline, {
            currentTimeMillis: 5_000,
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [{id: 'clip', label: 'Clip', start: 2, end: 4}],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-play', play)
        timeline.addEventListener('lgs1920-timeline-pause', pause)
        timeline.addEventListener('lgs1920-timeline-seek', seek)
        timeline.addEventListener('lgs1920-timeline-clip-enabled-change', enabled)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        const space = new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true})
        surface.dispatchEvent(space)
        expect(space.defaultPrevented).toBe(true)
        expect(timeline.playing).toBe(true)
        expect(play).toHaveBeenCalledOnce()

        surface.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true}))
        expect(timeline.playing).toBe(false)
        expect(pause).toHaveBeenCalledOnce()

        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'Home', bubbles: true, cancelable: true}))
        expect(timeline.currentTimeMillis).toBe(0)
        surface.dispatchEvent(new KeyboardEvent('keydown', {key: 'End', bubbles: true, cancelable: true}))
        expect(timeline.currentTimeMillis).toBe(10_000)
        expect(seek).toHaveBeenCalledTimes(2)

        let clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'd',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        }))
        expect(timeline.tracks[0].clips).toHaveLength(2)
        expect(timeline.tracks[0].clips[1]).toMatchObject({id: 'clip-copy', start: 4, end: 6})

        clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(new KeyboardEvent('keydown', {key: 'v', bubbles: true, cancelable: true}))
        expect(enabled).toHaveBeenCalledOnce()
        expect(timeline.tracks[0].clips[0].enabled).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-clip-id="clip"]').getAttribute('aria-disabled')).toBe('true')
    })

    it('extends a clip to the nearest neighbors and timeline boundaries', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            timeline: {durationMillis: 10_000},
            tracks: [{
                id: 'main',
                clips: [
                    {id: 'before', start: 0, end: 2},
                    {id: 'clip', start: 3, end: 5},
                    {id: 'after', start: 7, end: 9},
                ],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-extend', changes)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
            .dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 240, clientY: 80}))
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-clip-menu-extend"]').click()

        expect(changes).toHaveBeenCalledOnce()
        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({id: 'clip', start: 2, end: 7})
        expect(timeline.tracks[0].clips).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'before', start: 0, end: 2}),
            expect.objectContaining({id: 'after', start: 7, end: 9}),
        ]))
    })

    it('moves the clips on either side of a resized clip on the same track', () => {
        const clips = [
            {id: 'before', start: 1, end: 3},
            {id: 'target', start: 4, end: 6},
            {id: 'after', start: 7, end: 9},
        ]

        expect(rippleResizedClips({
            clips,
            originalClip: clips[1],
            proposedClip: {...clips[1], start: 3},
            edge: 'start',
        })).toEqual([
            {id: 'before', start: 1, end: 3},
            {id: 'target', start: 3, end: 6},
            {id: 'after', start: 7, end: 9},
        ])
        expect(rippleResizedClips({
            clips,
            originalClip: clips[1],
            proposedClip: {...clips[1], end: 8},
            edge: 'end',
        })).toEqual([
            {id: 'before', start: 1, end: 3},
            {id: 'target', start: 4, end: 8},
            {id: 'after', start: 8, end: 10},
        ])
    })

    it('shows endpoint diamonds only while a clip is being moved', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip-one"]')
        const endpoints = timeline.shadowRoot.querySelectorAll('[data-clip-move-endpoint]')
        expect(clip.querySelectorAll('[data-clip-endpoint]')).toHaveLength(0)
        expect(endpoints).toHaveLength(2)
        expect(endpoints[0].hidden).toBe(true)
        expect(endpoints[1].hidden).toBe(true)

        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 65, clientY: 50}))
        expect(endpoints[0].hidden).toBe(false)
        expect(endpoints[1].hidden).toBe(false)
        expect(endpoints[0].parentElement).toBe(timeline.shadowRoot.querySelector('[part="ruler"]'))
        expect(endpoints[0].style.left).toBe('60px')
        expect(endpoints[1].style.left).toBe('180px')
        expect(endpoints[0].getAttribute('part')).toBe('clip-move-start-endpoint')
        expect(endpoints[1].getAttribute('part')).toBe('clip-move-end-endpoint')

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 60, clientY: 50}))
        expect(endpoints[0].hidden).toBe(true)
        expect(endpoints[1].hidden).toBe(true)
    })

    it('snaps moved and resized clip edges to nearby major ruler units', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'snap-me', kind: 'video', start: 1, end: 4}]}],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="snap-me"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 108, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 108, clientY: 50}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 2, end: 5})

        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="snap-me"] [data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 220, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 228, clientY: 50}))

        const rulerGuide = timeline.shadowRoot.querySelector('[data-clip-snap-guide]')
        expect(rulerGuide.hidden).toBe(false)
        expect(rulerGuide.style.left).toBe('220px')
        expect(rulerGuide.dataset.clipSnapTargetId).toBe('')

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 228, clientY: 50}))

        expect(changes.mock.calls[1][0].detail.clip.end).toBe(5)
    })

    it('shows the snap guide while resizing against a neighboring clip edge', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {resizeCollisionPolicy: 'prevent'},
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [
                    {id: 'resizing-guide', kind: 'video', start: 1, end: 4},
                    {id: 'resize-anchor', kind: 'video', start: 5.15, end: 7.15},
                ],
            }],
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="resizing-guide"] [data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 220, clientY: 50}))

        const guide = timeline.shadowRoot.querySelector('[data-clip-snap-guide]')
        expect(guide.hidden).toBe(false)
        expect(guide.style.left).toBe('226px')
        expect(guide.dataset.clipSnapTargetId).toBe('resize-anchor')
        expect(guide.dataset.clipSnapTargetEdge).toBe('start')

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 220, clientY: 50}))
    })

    it('snaps a moved clip to either edge of a clip on another track', () => {
        vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']})
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {id: 'source', label: 'Source', clips: [{id: 'moving-clip', kind: 'video', start: '1', end: '4'}]},
                {id: 'target', label: 'Target', clips: []},
                {id: 'anchor', label: 'Anchor', clips: [{id: 'anchor-clip', kind: 'video', start: '5.15', end: '7.15'}]},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', event => {
            changes(event)
            timeline.tracks = event.detail.tracks
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="moving-clip"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 220, clientY: 70}))

        const guide = timeline.shadowRoot.querySelector('[data-clip-snap-guide]')
        const placementGhost = timeline.shadowRoot.querySelector('[data-clip-id="moving-clip"]')
        expect(placementGhost.style.left).toBe('226px')
        expect(guide.hidden).toBe(false)
        expect(guide.style.display).toBe('block')
        expect(guide.style.left).toBe('226px')
        expect(guide.dataset.clipSnapTargetId).toBe('anchor-clip')
        expect(guide.dataset.clipSnapTargetEdge).toBe('start')

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 220, clientY: 70}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 5.15, end: 8.15, trackId: 'target'})
        expect(guide.hidden).toBe(false)
        vi.advanceTimersByTime(2000)
        expect(guide.hidden).toBe(true)
        vi.useRealTimers()
    })

    it('snaps a moved clip to an adjacent edge on the same track', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [
                    {id: 'moving-adjacent', kind: 'video', start: 1, end: 4},
                    {id: 'adjacent-anchor', kind: 'video', start: 5.15, end: 7.15},
                ],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="moving-adjacent"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 104, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 104, clientY: 50}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 2.15, end: 5.15})
    })

    it('keeps the snap guide when a moved clip touches an existing clip', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [
                    {id: 'touch-anchor', kind: 'video', start: 5, end: 7},
                    {id: 'moving-touch', kind: 'video', start: 8, end: 11},
                ],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const overlay = timeline.shadowRoot.querySelector('[data-overlay]')
        vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({left: 100, top: 0, right: 600, width: 500})
        const anchor = timeline.shadowRoot.querySelector('[data-clip-id="touch-anchor"]')
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({left: 410, top: 0, right: 510, width: 100})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="moving-touch"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 340, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 302, clientY: 50}))

        const guide = timeline.shadowRoot.querySelector('[data-clip-snap-guide]')
        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(false)
        expect(guide.hidden).toBe(false)
        expect(guide.style.left).toBe('410px')
        expect(guide.dataset.clipSnapTargetId).toBe('touch-anchor')
        expect(guide.dataset.clipSnapTargetEdge).toBe('end')

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 302, clientY: 50}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 7, end: 10})
    })

    it('requires extra movement to release a clip edge snap', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [
                    {id: 'release-anchor', kind: 'video', start: 5, end: 7},
                    {id: 'release-moving', kind: 'video', start: 8, end: 11},
                ],
            }],
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="release-moving"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 340, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 302, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 294, clientY: 50}))

        const guide = timeline.shadowRoot.querySelector('[data-clip-snap-guide]')
        expect(guide.hidden).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-clip-id="release-moving"]').style.left).toBe('300px')

        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 286, clientY: 50}))

        expect(guide.hidden).toBe(true)
        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(true)
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 286, clientY: 50}))
    })

    it('accepts the valid edge snap when the nearest edge would overlap', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {id: 'source', label: 'Source', clips: [{id: 'short-moving', kind: 'video', start: 1, end: 1.1}]},
                {id: 'target', label: 'Target', clips: [{id: 'anchor', kind: 'video', start: 5, end: 6}]},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="short-moving"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 218, clientY: 70}))

        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(false)
        expect(timeline.shadowRoot.querySelector('[data-clip-id="short-moving"]').style.left).toBe('216px')
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 218, clientY: 70}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 4.9, end: 5, trackId: 'target'})
    })

    it('rejects a moved clip when it overlaps another clip on the same track', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        const tracks = [{
            id: 'main',
            label: 'Main',
            clips: [
                {id: 'moving-overlap', kind: 'video', start: 1, end: 4},
                {id: 'blocking-clip', kind: 'video', start: 5, end: 8},
            ],
        }]
        configureTimeline(timeline, {tracks})
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="moving-overlap"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 140, clientY: 50}))

        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(true)
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 140, clientY: 50}))

        expect(changes).not.toHaveBeenCalled()
        expect(timeline.tracks[0].clips).toEqual(tracks[0].clips)
    })

    it('keeps a snapped move accepted when the target track remains collision-free', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {id: 'source', label: 'Source', clips: [{id: 'short-moving', kind: 'video', start: 1, end: 1.1}]},
                {id: 'target', label: 'Target', clips: [{id: 'target-clip', kind: 'video', start: 5, end: 6}]},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="short-moving"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 214, clientY: 70}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 214, clientY: 70}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 4.9, end: 5, trackId: 'target'})
    })

    it('stops a resize at the free boundary when the closest snap would overlap', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [
                {
                    id: 'main',
                    label: 'Main',
                    clips: [
                        {id: 'resizing-snap', kind: 'video', start: 1, end: 4},
                        {id: 'blocking-anchor', kind: 'video', start: 5.15, end: 5.85},
                    ],
                },
            ],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="resizing-snap"] [data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 256, clientY: 50}))

        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(false)
        const guide = timeline.shadowRoot.querySelector('[data-clip-snap-guide]')
        expect(guide.hidden).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-clip-move-endpoint="end"]').style.left).toBe('226px')

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 256, clientY: 50}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 1, end: 5.15})
        expect(changes.mock.calls[0][0].detail.tracks[0].clips).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'blocking-anchor', start: 5.15, end: 5.85}),
        ]))
    })

    it('snaps a moved clip to secondary ruler units while Shift is held', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'snap-secondary', kind: 'video', start: 1, end: 4}]}],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="snap-secondary"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 88, clientY: 50, shiftKey: true}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 88, clientY: 50, shiftKey: true}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 1.8, end: 4.8})
    })

    it('snaps a resized clip edge to secondary ruler units while Shift is held', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'resize-secondary', kind: 'video', start: 1, end: 4}]}],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="resize-secondary"] [data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 188, clientY: 50, shiftKey: true}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 188, clientY: 50, shiftKey: true}))

        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 1, end: 4.2})
    })

    it('shows both resized clip boundaries as color-matched diamond markers', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const indicator = timeline.shadowRoot.querySelector('[data-clip-edge-indicator]')
        const endpoints = timeline.shadowRoot.querySelectorAll('[data-clip-move-endpoint]')
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="clip-one"] [data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))

        expect(indicator.hidden).toBe(true)
        expect(endpoints[0].hidden).toBe(false)
        expect(endpoints[0].style.left).toBe('60px')
        expect(endpoints[1].hidden).toBe(false)
        expect(endpoints[1].style.left).toBe('180px')
        expect(endpoints[0].style.getPropertyValue('--lgs-timeline-clip-edge-indicator-color'))
            .toBe('var(--wa-color-blue-60)')

        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 228, clientY: 50}))
        expect(endpoints[0].style.left).toBe('60px')
        expect(endpoints[1].hidden).toBe(false)
        expect(endpoints[1].style.left).toBe('220px')

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 228, clientY: 50}))
        expect(indicator.hidden).toBe(true)
        expect(endpoints[0].hidden).toBe(true)
        expect(endpoints[1].hidden).toBe(true)
    })

    it('preserves local ruler zoom when controlled clip updates replace the tracks', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {timeline: {zoomPercent: 0}})
        document.body.append(timeline)
        timeline.setZoom(100)
        timeline.addEventListener('lgs1920-timeline-clip-change', event => {
            timeline.timeline = {durationMillis: 10_000, visible: true, zoomPercent: 0}
            timeline.tracks = event.detail.tracks
        })

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip-one"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 100, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 100, clientY: 50}))

        expect(timeline.shadowRoot.querySelector('[data-surface]').getAttribute('data-zoom-percent')).toBe('100')
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
        timeline.addEventListener('lgs1920-timeline-clip-change', event => {
            timeline.tracks = event.detail.tracks
        })
        timeline.addEventListener('lgs1920-timeline-before-drag', beforeDrag)
        timeline.addEventListener('lgs1920-timeline-drag', drag)
        timeline.addEventListener('lgs1920-timeline-after-drag', afterDrag)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="move-me"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 108, clientY: 70}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 108, clientY: 70}))

        expect(timeline.selectedClipId).toBe('move-me')
        const movedStart = timeline.tracks[1].clips[0].start
        timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
            .dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true}))
        expect(timeline.tracks[1].clips[0].start).toBeGreaterThan(movedStart)

        expect(changes).toHaveBeenCalledTimes(2)
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
            trackId: 'source',
            clipId: 'move-me',
        })
        expect(changes.mock.calls[0][0].detail.oldTimeline).toMatchObject({
            trackId: 'source',
            start: 1,
            end: 4,
        })
        expect(changes.mock.calls[0][0].detail.newTimeline).toMatchObject({
            trackId: 'target',
            start: 2,
            end: 5,
        })
        expect(changes.mock.calls[0][0].detail.dragStart).toMatchObject({
            trackId: 'source',
            time: 1,
        })
        expect(changes.mock.calls[0][0].detail.drag).toMatchObject({
            trackId: 'target',
            time: 2.2,
        })
        expect(afterDrag.mock.calls[0][0].detail.context).toMatchObject({
            type: 'clip',
            trackId: 'target',
            clipId: 'move-me',
        })
    })

    it('shows a source ghost and a valid placement ghost while moving a clip', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [
                {id: 'source', label: 'Source', clips: [{id: 'move-me', kind: 'video', start: 1, end: 4}]},
                {id: 'target', label: 'Target', accepts: ['video'], clips: []},
            ],
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="move-me"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 108, clientY: 70}))

        const placementGhost = timeline.shadowRoot.querySelector('[data-clip-id="move-me"]')
        const sourceGhost = timeline.shadowRoot.querySelector('[data-clip-drag-source]')
        const sourceTrack = timeline.shadowRoot.querySelector('[data-row-id="source"][part="track"]')
        const targetTrack = timeline.shadowRoot.querySelector('[data-row-id="target"][part="track"]')
        expect(placementGhost.parentElement.hasAttribute('data-overlay')).toBe(true)
        expect(placementGhost.classList.contains('lgs1920-wa-timeline__clip--drag-ghost')).toBe(true)
        expect(placementGhost.classList.contains('lgs1920-wa-timeline__clip--drop-rejected')).toBe(false)
        expect(placementGhost.style.left).toBe('100px')
        expect(placementGhost.style.top).toBe('58px')
        expect(targetTrack.classList.contains('lgs1920-wa-timeline__track--clip-drop-target')).toBe(true)
        expect(sourceGhost.parentElement.dataset.rowId).toBe('source')
        expect(sourceGhost.classList.contains('lgs1920-wa-timeline__clip--drag-source')).toBe(true)

        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 108, clientY: 50}))
        expect(sourceTrack.classList.contains('lgs1920-wa-timeline__track--clip-drop-target')).toBe(true)
        expect(targetTrack.classList.contains('lgs1920-wa-timeline__track--clip-drop-target')).toBe(false)
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 108, clientY: 70}))
        expect(targetTrack.classList.contains('lgs1920-wa-timeline__track--clip-drop-target')).toBe(true)

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 108, clientY: 70}))

        expect(timeline.shadowRoot.querySelector('[data-clip-drag-source]')).toBeNull()
        expect(timeline.shadowRoot.querySelector('[data-clip-drag-ghost]')).toBeNull()
        const committedClip = timeline.shadowRoot.querySelector('[data-clip-id="move-me"]')
        expect(committedClip.parentElement.dataset.rowId).toBe('target')
        expect(committedClip.classList.contains('lgs1920-wa-timeline__clip--drag-ghost')).toBe(false)
        expect(committedClip.style.top).toBe('')
        expect(committedClip.style.bottom).toBe('')
        expect(committedClip.style.height).toBe('')
    })

    it('rejects a moved clip when the gap cannot contain its complete duration', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        const tracks = [
            {id: 'source', clips: [{id: 'move-me', start: 1, end: 5}]},
            {id: 'target', clips: [{id: 'before', start: 0, end: 2}, {id: 'after', start: 5, end: 8}]},
        ]
        configureTimeline(timeline, {tracks})
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)
        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="move-me"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 140, clientY: 70}))
        expect(timeline.hasAttribute('data-clip-drop-rejected')).toBe(true)
        expect(clip.classList.contains('lgs1920-wa-timeline__clip--drop-rejected')).toBe(true)
        expect(timeline.shadowRoot.querySelector('[part="track-background"][data-row-id="target"]')
            .classList.contains('lgs1920-wa-timeline__track-background--clip-drop-rejected')).toBe(true)
        expect(clip.classList.contains('lgs1920-wa-timeline__clip--drag-source-rejected')).toBe(true)
        const rejectedGhost = timeline.shadowRoot.querySelector('[data-clip-drag-ghost]')
        expect(rejectedGhost).not.toBeNull()
        expect(rejectedGhost.classList.contains('lgs1920-wa-timeline__clip--drop-rejected')).toBe(true)
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 140, clientY: 70}))
        expect(changes).not.toHaveBeenCalled()
        expect(timeline.tracks[0].clips[0]).toMatchObject({id: 'move-me', start: 1, end: 5})
        expect(timeline.tracks[1].clips).toEqual(tracks[1].clips)
    })

    it('keeps an adjacent clip fixed when a clip is resized', () => {
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
        const detail = changes.mock.calls[0][0].detail
        expect(detail.clip).toMatchObject({start: 1, end: 5})
        expect(detail.tracks[0].clips).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'next', start: 5, end: 8}),
        ]))
    })

    it('ripples clips to the right when an end edge is extended', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            timeline: {resizeCollisionPolicy: 'ripple'},
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
        const durationOverlay = timeline.shadowRoot.querySelector('[data-clip-id="resizing"] [data-clip-duration-overlay]')
        expect(durationOverlay.hidden).toBe(false)
        expect(durationOverlay.textContent).toBe('0:05 / 0:10')
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 260, clientY: 50}))

        expect(changes).toHaveBeenCalledOnce()
        const detail = changes.mock.calls[0][0].detail
        expect(detail.clip).toMatchObject({start: 1, end: 6})
        expect(detail.tracks[0].clips).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'next', start: 6, end: 9}),
        ]))

        const secondEndHandle = timeline.shadowRoot.querySelector('[data-clip-id="resizing"] [data-clip-handle="end"]')
        secondEndHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 260, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 180, clientY: 50}))

        expect(changes).toHaveBeenCalledTimes(2)
        const reversedDetail = changes.mock.calls[1][0].detail
        expect(reversedDetail.clip).toMatchObject({start: 1, end: 4})
        expect(reversedDetail.tracks[0].clips).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'next', start: 5, end: 8}),
        ]))
    })

    it('keeps the previous clip fixed when the start resize reaches it', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [
                    {id: 'previous', kind: 'video', start: 0, end: 1},
                    {id: 'resizing', kind: 'video', start: 1, end: 4},
                ],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const startHandle = timeline.shadowRoot.querySelector('[data-clip-id="resizing"] [data-clip-handle="start"]')
        startHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 20, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 20, clientY: 50}))

        expect(changes).toHaveBeenCalledOnce()
        const detail = changes.mock.calls[0][0].detail
        expect(detail.clip).toMatchObject({start: 1, end: 4})
        expect(detail.tracks[0].clips).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'previous', start: 0, end: 1}),
        ]))
    })

    it('extends the total duration when the end resize reaches beyond the timeline', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            timeline: {durationMillis: 10_000},
            tracks: [{
                id: 'main',
                label: 'Main',
                clips: [
                    {id: 'previous', kind: 'video', start: 0, end: 4},
                    {id: 'resizing', kind: 'video', start: 4, end: 8},
                ],
            }],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const initialSurface = surface
        const initialCanvasWidth = Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width)
        const initialRulerTickCount = timeline.shadowRoot.querySelectorAll('[part="tick"]').length
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="resizing"] [data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 340, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 500, clientY: 50}))

        const canvas = timeline.shadowRoot.querySelector('[part="canvas"]')
        const ruler = timeline.shadowRoot.querySelector('[part="ruler"]')
        const tracks = timeline.shadowRoot.querySelector('[part="tracks"]')
        const renderedClip = timeline.shadowRoot.querySelector('[data-clip-id="resizing"]')
        const clipRight = Number.parseFloat(renderedClip.style.left) + Number.parseFloat(renderedClip.style.width)
        expect(timeline.shadowRoot.querySelector('[data-surface]')).toBe(initialSurface)
        expect(Number.parseFloat(canvas.style.width)).toBeGreaterThan(initialCanvasWidth)
        expect(Number.parseFloat(ruler.style.width)).toBe(Number.parseFloat(canvas.style.width))
        expect(Number.parseFloat(tracks.style.width)).toBe(Number.parseFloat(canvas.style.width))
        expect(timeline.shadowRoot.querySelectorAll('[part="tick"]').length).toBeGreaterThan(initialRulerTickCount)
        expect(clipRight).toBeLessThanOrEqual(Number.parseFloat(canvas.style.width))

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 500, clientY: 50}))

        const detail = changes.mock.calls[0][0].detail
        expect(detail.clip).toMatchObject({start: 4, end: 12})
        expect(detail.durationMillis).toBe(12_000)
        expect(detail.tracks[0].clips).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'previous', start: 0, end: 4}),
        ]))
        expect(timeline.timeline.rangeEndMillis).toBe(12_000)
    })

    it('extends the duration when a clip is moved beyond the current end without rebuilding the timeline', () => {
        const timeline = new LGS1920Timeline()
        const changes = vi.fn()
        configureTimeline(timeline, {
            timeline: {durationMillis: 10_000},
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'moving', start: 4, end: 8}]}],
        })
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const clip = timeline.shadowRoot.querySelector('[data-clip-id="moving"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 500, clientY: 50}))

        expect(timeline.shadowRoot.querySelector('[data-surface]')).toBe(surface)
        expect(Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width)).toBeGreaterThan(0)
        expect(Number.parseFloat(timeline.shadowRoot.querySelector('[data-clip-id="moving"]').style.left)
            + Number.parseFloat(timeline.shadowRoot.querySelector('[data-clip-id="moving"]').style.width))
            .toBeLessThanOrEqual(Number.parseFloat(timeline.shadowRoot.querySelector('[part="canvas"]').style.width))

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 500, clientY: 50}))

        expect(changes).toHaveBeenCalledOnce()
        expect(changes.mock.calls[0][0].detail.clip).toMatchObject({start: 12, end: 16})
        expect(changes.mock.calls[0][0].detail.durationMillis).toBe(16_000)
        expect(timeline.timeline.rangeEndMillis).toBe(16_000)
    })

    it('keeps an extended duration when a stale controlled projection is replayed', () => {
        const timeline = new LGS1920Timeline()
        const originalTracks = [{id: 'main', label: 'Main', clips: [{id: 'moving', start: 4, end: 8}]}]
        configureTimeline(timeline, {
            timeline: {durationMillis: 10_000},
            tracks: originalTracks,
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        timeline.shadowRoot.querySelector('[data-clip-id="moving"]')
            .dispatchEvent(createPointerEvent('pointerdown', {clientX: 180, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 500, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 500, clientY: 50}))

        expect(timeline.timeline.durationMillis).toBe(16_000)
        timeline.timeline = {durationMillis: 10_000}
        timeline.tracks = originalTracks

        expect(timeline.timeline.durationMillis).toBe(16_000)
        expect(timeline.tracks[0].clips[0]).toMatchObject({start: 12, end: 16})
    })

    it('restores the range duration when an extending resize is cancelled', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {durationMillis: 10_000},
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', start: 4, end: 8}]}],
        })
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const endHandle = timeline.shadowRoot.querySelector('[data-clip-id="clip"] [data-clip-handle="end"]')
        endHandle.dispatchEvent(createPointerEvent('pointerdown', {clientX: 340, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 500, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointercancel', {clientX: 500, clientY: 50}))

        expect(timeline.timeline.durationMillis).toBe(10_000)
        expect(timeline.timeline.rangeEndMillis).toBe(10_000)
        expect(timeline.tracks[0].clips[0]).toMatchObject({start: 4, end: 8})
    })

    it('keeps the rendered timeline during a controlled update received while dragging', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'main', label: 'Main', clips: [{id: 'clip', kind: 'video', start: 1, end: 4}]}],
        })
        document.body.append(timeline)

        const initialSurface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(initialSurface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        let controlledUpdateApplied = false
        timeline.addEventListener('lgs1920-timeline-drag', event => {
            if (controlledUpdateApplied) return
            controlledUpdateApplied = true
            timeline.timeline = Object.assign({}, timeline.timeline)
            timeline.tracks = event.detail.tracks
        })

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip"]')
        clip.dispatchEvent(createPointerEvent('pointerdown', {clientX: 60, clientY: 50}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 100, clientY: 50}))

        expect(controlledUpdateApplied).toBe(true)
        expect(timeline.shadowRoot.querySelector('[data-surface]')).toBe(initialSurface)

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 100, clientY: 50}))
        expect(timeline.shadowRoot.querySelector('[data-surface]')).toBe(initialSurface)
    })

    it('inserts a clip on the configured track from the clip menu', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {
            timeline: {showClipMenu: true},
            currentTimeMillis: 5_000,
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
        expect(additions.mock.calls[0][0].detail.clip.start).toBe(5)
        expect(additions.mock.calls[0][0].detail.clip.end).toBe(8)
        expect(additions.mock.calls[0][0].detail.tracks[0].clips.some(clip => clip.id === 'inserted')).toBe(true)
    })

    it('does not consume an identifier when an insertion is cancelled', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        let cancelNextInsertion = true
        configureTimeline(timeline, {
            timeline: {showClipMenu: true},
            clipOptions: [{group: 'media', key: 'video', id: 'inserted', label: 'Inserted', duration: 1, trackId: 'main#one'}],
        })
        timeline.addEventListener('lgs1920-timeline-before-add-clip', event => {
            if (!cancelNextInsertion) return
            cancelNextInsertion = false
            event.preventDefault()
        })
        timeline.addEventListener('lgs1920-timeline-add-clip', additions)
        document.body.append(timeline)

        const insert = () => {
            timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]').click()
            timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__menu-item').click()
        }
        insert()
        insert()

        expect(additions).toHaveBeenCalledOnce()
        expect(additions.mock.calls[0][0].detail.clip.id).toBe('inserted')
        expect(timeline.tracks[0].clips.map(clip => clip.id)).toEqual(expect.arrayContaining(['inserted']))
        expect(timeline.tracks[0].clips.map(clip => clip.id)).not.toEqual(expect.arrayContaining(['inserted-2']))
    })

    it('normalizes overlapping clips received through controlled tracks', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{
                id: 'video',
                label: 'Video',
                clips: [
                    {id: 'first', kind: 'video', start: 1, end: 4},
                    {id: 'second', kind: 'video', start: 3, end: 5},
                    {id: 'third', kind: 'video', start: 4, end: 6},
                ],
            }],
        })
        document.body.append(timeline)

        expect(timeline.tracks[0].clips).toEqual([
            expect.objectContaining({id: 'first', start: 1, end: 4}),
            expect.objectContaining({id: 'second', start: 4, end: 6}),
            expect.objectContaining({id: 'third', start: 6, end: 8}),
        ])
    })

    it('assigns a unique identifier when the same insertion option is used twice', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {
            timeline: {showClipMenu: true, collisionPolicy: 'allow'},
            clipOptions: [{group: 'media', key: 'video', id: 'inserted', label: 'Inserted', duration: 1, trackId: 'main#one'}],
        })
        timeline.addEventListener('lgs1920-timeline-add-clip', additions)
        document.body.append(timeline)

        const insert = () => {
            timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]').click()
            timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__menu-item').click()
        }
        insert()
        timeline.currentTimeMillis = 5_000
        insert()

        expect(additions).toHaveBeenCalledTimes(2)
        expect(additions.mock.calls.map(call => call[0].detail.clip?.id)).toEqual(['inserted', 'inserted-2'])
        expect(timeline.tracks[0].clips.map(clip => clip.id)).toEqual(expect.arrayContaining(['inserted', 'inserted-2']))
        expect(timeline.tracks[0].clips).toHaveLength(3)
    })

    it('inserts a new clip by dragging a menu option onto a track', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {
            timeline: {showClipMenu: true},
            clipOptions: [{group: 'media', key: 'video', id: 'dragged', label: 'Dragged', duration: 2, trackId: 'main#one'}],
        })
        timeline.addEventListener('lgs1920-timeline-add-clip', additions)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]').click()
        const item = timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__menu-item')
        expect(item.getAttribute('draggable')).toBe('true')
        const dataTransfer = createDataTransfer()
        item.dispatchEvent(createDragEvent('dragstart', dataTransfer))

        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, right: 600, width: 600})
        const track = timeline.shadowRoot.querySelector('[part="track"][data-row-id="main#one"]')
        const dragOver = createDragEvent('dragover', dataTransfer, {clientX: 200})
        track.dispatchEvent(dragOver)
        expect(dragOver.defaultPrevented).toBe(true)
        expect(track.classList.contains('lgs1920-wa-timeline__track--clip-drop-target')).toBe(true)

        track.dispatchEvent(createDragEvent('drop', dataTransfer, {clientX: 200}))

        expect(additions).toHaveBeenCalledOnce()
        expect(additions.mock.calls[0][0].detail.clip).toMatchObject({id: 'dragged'})
        expect(additions.mock.calls[0][0].detail.clip.end - additions.mock.calls[0][0].detail.clip.start).toBe(2)
        expect(additions.mock.calls[0][0].detail.clip.start).toBeGreaterThan(0)
        expect(timeline.tracks[0].clips).toEqual(expect.arrayContaining([
            expect.objectContaining({id: 'dragged'}),
        ]))
    })

    it('applies ripple insertion and extends the timeline when configured', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {
            timeline: {
                durationPolicy: 'extend',
                collisionPolicy: 'ripple',
                showClipMenu: true,
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
        expect(detail.durationMillis).toBe(14_000)
        expect(detail.tracks[0].clips.find(clip => clip.id === 'inserted')).toMatchObject({start: 1, end: 4})
        expect(detail.tracks[0].clips.find(clip => clip.id === 'last')).toMatchObject({start: 6, end: 14})
    })

    it('reorders tracks from the track list and emits the drop index', () => {
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

        const nameArea = timeline.shadowRoot.querySelector('[data-row-id="first"] [part="legend-content"]')
        expect(timeline.shadowRoot.querySelector('slot[name="drag-trigger-first"]')).toBeNull()
        nameArea.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        const surface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
        const tracksViewport = timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')
        Object.defineProperty(surface, 'scrollLeft', {configurable: true, writable: true, value: 72})
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 100, right: 700, width: 600, top: 0, bottom: 200, height: 200})
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 255}))
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')).toBe(surface)
        expect(timeline.shadowRoot.querySelector('[data-scroll-view="tracks"]')).toBe(tracksViewport)
        expect(surface.scrollLeft).toBe(72)
        expect(timeline.shadowRoot.querySelector('[data-track-drop-indicator]')).toBeNull()
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 255}))

        expect(reorders).toHaveBeenCalledOnce()
        expect(reorders.mock.calls[0][0].detail.dropIndex).toBe(2)
        expect(reorders.mock.calls[0][0].detail.tracks[0].id).toBe('second')
        expect(beforeDrag.mock.calls[0][0].detail.context).toMatchObject({type: 'track', trackId: 'first'})
        expect(drag).toHaveBeenCalled()
        expect(afterDrag.mock.calls[0][0].detail).toMatchObject({
            committed: true,
            context: {type: 'track', trackId: 'first'},
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

    it('keeps viewport margins on both sides while horizontally scrolling', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const surface = timeline.shadowRoot.querySelector('[data-scroll-view="surface"]')
        Object.defineProperty(surface, 'clientWidth', {configurable: true, value: 200})
        Object.defineProperty(surface, 'scrollWidth', {configurable: true, value: 400})

        surface.scrollLeft = 0
        surface.dispatchEvent(new Event('scroll'))
        expect(surface.hasAttribute('data-viewport-margin-left')).toBe(false)
        expect(surface.hasAttribute('data-viewport-margin-right')).toBe(true)

        surface.scrollLeft = 100
        surface.dispatchEvent(new Event('scroll'))
        expect(surface.hasAttribute('data-viewport-margin-left')).toBe(true)
        expect(surface.hasAttribute('data-viewport-margin-right')).toBe(true)

        surface.scrollLeft = 200
        surface.dispatchEvent(new Event('scroll'))
        expect(surface.hasAttribute('data-viewport-margin-left')).toBe(true)
        expect(surface.hasAttribute('data-viewport-margin-right')).toBe(false)
    })

    it('does not edit a track name when the track is not editable', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            tracks: [{id: 'editable', label: 'Editable', editable: false, movable: false, clips: []}],
        })
        document.body.append(timeline)

        const labelSlot = timeline.shadowRoot.querySelector('slot[name="track-label-editable"]')
        labelSlot.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 10}))
        labelSlot.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 10}))
        labelSlot.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))

        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="editable"]')).toBeNull()
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
            pointerY: 255,
        },
    ])('allows row insertion $name', ({tracks, pointerY}) => {
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

        expect(timeline.hasAttribute('data-row-drop-rejected')).toBe(false)

        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: pointerY}))

        expect(reorders).toHaveBeenCalledOnce()
        expect(timeline.tracks.map(track => track.id)).not.toEqual(tracks.map(track => track.id))
        expect(afterDrag.mock.calls[0][0].detail).toMatchObject({committed: true})
    })

    it('does not open context menus for tracks or clips', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const track = timeline.shadowRoot.querySelector('[data-row-id="main#one"]')
        track.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__context-menu')).toBeNull()

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip-one"]')
        expect(clip.classList.contains('test-no-drag')).toBe(true)
        clip.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__context-menu')).toBeNull()
    })
})
