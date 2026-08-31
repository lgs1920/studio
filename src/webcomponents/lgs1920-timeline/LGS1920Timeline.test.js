// @vitest-environment jsdom

import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/components/button/button.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/button-group/button-group.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/icon.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/input/input.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/popup/popup.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/split-panel/split-panel.js', () => ({}))

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
        expect(timeline.shadowRoot.querySelector('slot[name="header"]').assignedElements()).toEqual([heading])
        expect(timeline.shadowRoot.querySelector('slot[name="header-actions"]').assignedElements()).toEqual([headerAction])
        expect(timeline.shadowRoot.querySelector('slot[name="timeline-actions"]').assignedElements()).toEqual([timelineAction])
        expect(timeline.shadowRoot.querySelector('slot[name="footer"]')).not.toBeNull()
        expect(timeline.style.getPropertyValue('--lgs-timeline-playhead-color')).toBe('rebeccapurple')
    })

    it('uses configurable minimum and maximum track title widths', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline, {
            timeline: {
                legendWidth: 400,
                legendMinWidth: 160,
                legendMaxWidth: 240,
            },
        })
        document.body.append(timeline)

        const splitPanel = timeline.shadowRoot.querySelector('[part="split-panel"]')
        const layout = timeline.shadowRoot.querySelector('[part="layout"]')
        expect(splitPanel.getAttribute('position-in-pixels')).toBe('240')
        expect(splitPanel.style.getPropertyValue('--min')).toBe('160px')
        expect(splitPanel.style.getPropertyValue('--max')).toBe('min(240px, calc(100% - 160px))')
        expect(layout.style.getPropertyValue('--lgs-timeline-legend-width')).toBe('240px')
        expect(timeline.timeline.legendMinWidth).toBe(160)
        expect(timeline.timeline.legendMaxWidth).toBe(240)
    })

    it('emits playback, seeking, track visibility, and clip events', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
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
    })

    it('supports global and contextual slots for repeated track and clip content', () => {
        const timeline = new LGS1920Timeline()
        const globalIcon = document.createElement('wa-icon')
        globalIcon.slot = 'track-icon'
        globalIcon.setAttribute('name', 'layer-group')
        const contextualLabel = document.createElement('span')
        contextualLabel.slot = 'track-label-main#one'
        contextualLabel.textContent = 'Custom main track'
        timeline.append(globalIcon, contextualLabel)
        configureTimeline(timeline)
        document.body.append(timeline)

        const row = timeline.shadowRoot.querySelector('[data-row-id="main#one"]')
        expect(row.querySelector('slot[name="track-label-main#one"]').assignedElements()).toEqual([contextualLabel])
        expect(row.querySelector('slot[name="track-icon-main#one"]')).not.toBeNull()
        expect(row.querySelector('[part="track-actions"]')).not.toBeNull()
        expect(row.querySelector('slot[name="drag-trigger-main#one"]')).not.toBeNull()
        expect(row.querySelector('slot[name="visibility-main#one"]')).not.toBeNull()
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
        expect(timeline.shadowRoot.querySelector('wa-popup').getAttribute('anchor')).toBe('lgs1920-timeline-clip-menu-trigger')
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
        input.value = 'Journey map'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        input.dispatchEvent(new Event('change', {bubbles: true}))

        expect(labelChanges).toHaveBeenCalledOnce()
        expect(labelChanges.mock.calls[0][0].detail.data.timeline.durationMillis).toBe(12_000)
        expect(labelChanges.mock.calls[0][0].detail.trackId).toBe('map#main')
        expect(labelChanges.mock.calls[0][0].detail.data.tracks[0].label).toBe('Journey map')
        expect(labelChanges.mock.calls[0][0].detail.data.tracks[0].clips[0].id).toBe('map-clip')
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
        const tracks = [
            {id: 'source', label: 'Source', clips: [{id: 'move-me', kind: 'video', start: 1, end: 4}]},
            {id: 'target', label: 'Target', accepts: ['video'], clips: []},
        ]
        configureTimeline(timeline, {tracks})
        timeline.addEventListener('lgs1920-timeline-clip-change', changes)
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
    })

    it('inserts a clip on the configured track from the clip menu', () => {
        const timeline = new LGS1920Timeline()
        const additions = vi.fn()
        configureTimeline(timeline, {
            currentTimeMillis: 2_000,
            clipOptions: [{group: 'media', key: 'video', id: 'inserted', label: 'Inserted', duration: 3, trackId: 'main#one'}],
        })
        timeline.addEventListener('lgs1920-timeline-add-clip', additions)
        document.body.append(timeline)

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-clip"]').click()
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
        configureTimeline(timeline, {
            tracks: [
                {id: 'first', label: 'First', movable: true, clips: []},
                {id: 'second', label: 'Second', movable: true, clips: []},
            ],
        })
        timeline.addEventListener('lgs1920-timeline-reorder', reorders)
        document.body.append(timeline)

        const trigger = timeline.shadowRoot.querySelector('slot[name="drag-trigger-first"]')
        trigger.dispatchEvent(createPointerEvent('pointerdown', {clientX: 10, clientY: 10}))
        window.dispatchEvent(createPointerEvent('pointermove', {clientX: 10, clientY: 70}))
        window.dispatchEvent(createPointerEvent('pointerup', {clientX: 10, clientY: 70}))

        expect(reorders).toHaveBeenCalledOnce()
        expect(reorders.mock.calls[0][0].detail.dropIndex).toBe(2)
        expect(reorders.mock.calls[0][0].detail.tracks[0].id).toBe('second')
        expect(timeline.shadowRoot.querySelector('[data-track-drop-indicator]').hidden).toBe(true)
    })

    it('opens track and clip context menus with edit and visibility actions', () => {
        const timeline = new LGS1920Timeline()
        configureTimeline(timeline)
        document.body.append(timeline)

        const track = timeline.shadowRoot.querySelector('[data-row-id="main#one"]')
        track.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[role="menu"]')).not.toBeNull()
        timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__context-menu-item').click()
        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="main#one"]')).not.toBeNull()
        timeline.shadowRoot.querySelector('[data-edit-row-id="main#one"]').dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))

        const clip = timeline.shadowRoot.querySelector('[data-clip-id="clip-one"]')
        clip.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[role="menu"]')).not.toBeNull()
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__context-menu-item').textContent).toBe('Edit clip')
    })
})
