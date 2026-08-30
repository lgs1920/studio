// @vitest-environment jsdom

import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/components/button/button.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/button-group/button-group.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/icon.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/input/input.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/popup/popup.js', () => ({}))

import {LGS1920Timeline} from './LGS1920Timeline'

const projection = {
    durationMillis: 10_000,
    durationSeconds: 10,
    editorData: [
        {
            id: 'widget#one',
            label: 'Widget One',
            icon: 'puzzle-piece',
            colorClasses: ['wa-neutral', 'wa-neutral-blue'],
            canHide: true,
            actions: [{id: 'action-one', kind: 'widget', label: 'Widget One', start: 1, end: 4}],
        },
        {
            id: 'replay',
            label: 'Replay',
            icon: 'route',
            colorClasses: ['wa-neutral', 'wa-neutral-green'],
            fixed: true,
            movable: false,
            actions: [{id: 'replay-action', kind: 'start', label: 'Start', start: 0, end: 1}],
        },
    ],
}

afterEach(() => document.body.replaceChildren())

describe('lgs1920-timeline Web Component', () => {
    it('renders inside Shadow DOM with named slots and CSS customization tokens', () => {
        const timeline = new LGS1920Timeline()
        const heading = document.createElement('span')
        heading.slot = 'header'
        heading.textContent = 'Custom timeline'
        timeline.append(heading)
        timeline.style.setProperty('--lgs-timeline-playhead-color', 'rebeccapurple')
        timeline.setState({projection, linkedPreparation: true})
        document.body.append(timeline)

        expect(customElements.get('lgs1920-timeline')).toBe(LGS1920Timeline)
        expect(timeline.shadowRoot.querySelector('slot[name="header"]').assignedElements()).toEqual([heading])
        expect(timeline.shadowRoot.querySelector('slot[name="footer"]')).not.toBeNull()
        expect(timeline.style.getPropertyValue('--lgs-timeline-playhead-color')).toBe('rebeccapurple')
    })

    it('emits Web Component events for transport, seeking, visibility, and actions', () => {
        const timeline = new LGS1920Timeline()
        timeline.setState({projection, linkedPreparation: true})
        document.body.append(timeline)
        const events = ['play', 'replay', 'export', 'seek', 'visibility-change', 'action-dblclick']
            .map(name => `lgs1920-wa-timeline-${name}`)
        const listeners = Object.fromEntries(events.map(name => [name, vi.fn()]))
        events.forEach(name => timeline.addEventListener(name, listeners[name]))

        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-play"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-replay"]').click()
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-timeline-export"]').click()
        const surface = timeline.shadowRoot.querySelector('[data-surface]')
        vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({left: 0, width: 1_000})
        surface.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 200}))
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-visibility"]').click()
        timeline.shadowRoot.querySelector('[data-action-id="action-one"]').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))

        expect(listeners['lgs1920-wa-timeline-play']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-wa-timeline-replay']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-wa-timeline-export']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-wa-timeline-seek']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-wa-timeline-visibility-change']).toHaveBeenCalledOnce()
        expect(listeners['lgs1920-wa-timeline-action-dblclick']).toHaveBeenCalledOnce()
    })

    it('supports global and contextual slots for repeated timeline content', () => {
        const timeline = new LGS1920Timeline()
        const globalIcon = document.createElement('wa-icon')
        globalIcon.slot = 'track-icon'
        globalIcon.setAttribute('name', 'layer-group')
        const contextualLabel = document.createElement('span')
        contextualLabel.slot = 'track-label-widget#one'
        contextualLabel.textContent = 'Custom widget'
        timeline.append(globalIcon, contextualLabel)
        timeline.setState({projection, linkedPreparation: true})
        document.body.append(timeline)

        const row = timeline.shadowRoot.querySelector('[data-row-id="widget#one"]')
        expect(row.querySelector('slot[name="track-label-widget#one"]').assignedElements()).toEqual([contextualLabel])
        expect(row.querySelector('slot[name="track-icon-widget#one"]')).not.toBeNull()
        expect(row.querySelector('[part="track-actions"]')).not.toBeNull()
        expect(row.querySelector('slot[name="drag-trigger-widget#one"]')).not.toBeNull()
        expect(row.querySelector('slot[name="visibility-widget#one"]')).not.toBeNull()
    })

    it('accepts an element or selector as the optional popup parent', () => {
        const boundary = document.createElement('div')
        boundary.id = 'timeline-boundary'
        document.body.append(boundary)
        const timeline = new LGS1920Timeline()
        timeline.parent = boundary
        timeline.setState({projection, linkedPreparation: true, widgetOptions: [{group: 'widgets', key: 'map', label: 'Map'}]})
        document.body.append(timeline)

        expect(timeline.parent).toBe(boundary)
        timeline.parent = '#timeline-boundary'
        expect(timeline.parent).toBe(boundary)
        timeline.shadowRoot.querySelector('[data-testid="lgs1920-wa-add-widget"]').click()
        expect(timeline.shadowRoot.querySelector('wa-popup').getAttribute('anchor')).toBe('lgs1920-timeline-widget-menu-trigger')
    })

    it('keeps the visual playhead controlled by setTime and exposes the new event prefix', () => {
        const timeline = new LGS1920Timeline()
        timeline.setState({projection, linkedPreparation: true})
        document.body.append(timeline)
        const seek = vi.fn()
        timeline.addEventListener('lgs1920-timeline-seek', seek)
        timeline.setTime(5_000)

        expect(timeline.shadowRoot.querySelector('[data-playhead]').style.left).toBe('220px')
        expect(timeline.shadowRoot.querySelector('[data-current-time]').textContent).toBe('0:05')
        expect(seek).not.toHaveBeenCalled()
    })

    it('accepts JSON and YAML data and persists edited track labels by key', () => {
        const timeline = new LGS1920Timeline()
        const labelChanges = vi.fn()
        timeline.persistKey = 'label-test'
        timeline.addEventListener('lgs1920-timeline-track-label-change', labelChanges)
        timeline.setData(`durationSeconds: 12
tracks:
  - id: map#main
    label: Map
    editable: true
    actions:
      - id: map-action
        label: Map item
        start: 1
        end: 4`)
        document.body.append(timeline)

        const labelSlot = timeline.shadowRoot.querySelector('slot[name="track-label-map#main"]')
        labelSlot.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}))
        const input = timeline.shadowRoot.querySelector('[data-edit-row-id="map#main"]')
        input.value = 'Journey map'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        input.dispatchEvent(new Event('change', {bubbles: true}))

        expect(labelChanges).toHaveBeenCalledOnce()
        expect(labelChanges.mock.calls[0][0].detail.data.tracks[0].label).toBe('Journey map')

        const restored = new LGS1920Timeline()
        restored.persistKey = 'label-test'
        restored.setData(JSON.stringify({durationSeconds: 12, tracks: [{id: 'map#main', label: 'Map', items: []}]}))
        document.body.append(restored)

        expect(restored.shadowRoot.querySelector('[data-row-id="map#main"]').getAttribute('aria-label')).toBe('Journey map')
    })

    it('opens track and item context menus with editable and visibility actions', () => {
        const timeline = new LGS1920Timeline()
        timeline.setState({projection, linkedPreparation: true})
        document.body.append(timeline)

        const track = timeline.shadowRoot.querySelector('[data-row-id="widget#one"]')
        track.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[role="menu"]')).not.toBeNull()
        timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__context-menu-item').click()
        expect(timeline.shadowRoot.querySelector('[data-edit-row-id="widget#one"]')).not.toBeNull()
        timeline.shadowRoot.querySelector('[data-edit-row-id="widget#one"]').dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))

        const action = timeline.shadowRoot.querySelector('[data-action-id="action-one"]')
        action.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}))
        expect(timeline.shadowRoot.querySelector('[role="menu"]')).not.toBeNull()
        expect(timeline.shadowRoot.querySelector('.lgs1920-wa-timeline__context-menu-item').textContent).toBe('Edit item')
    })
})
