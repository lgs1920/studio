// @vitest-environment jsdom

import {cleanup, render} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/components/button/button.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/button-group/button-group.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/icon.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/input/input.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/popup/popup.js', () => ({}))

import {LGS1920TimelineReact} from './LGS1920TimelineReact'

const projection = {
    durationMillis: 5_000,
    editorData: [],
}

afterEach(() => cleanup())

describe('LGS1920TimelineReact', () => {
    it('bridges controlled state, slots, and Web Component events', () => {
        const seek = vi.fn()
        const {container} = render(
            <LGS1920TimelineReact
                state={{projection, linkedPreparation: true}}
                eventHandlers={{seek}}>
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
        expect(seek).toHaveBeenCalledOnce()
        expect(seek.mock.calls[0][0].detail.timeMillis).toBe(1_000)
    })
})
