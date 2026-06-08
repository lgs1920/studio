/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythrough-effects-tab.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-06
 * Last modified: 2026-06-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { FlythroughEffectsTab } from '@Components/Flythrough/FlythroughEffectsTab'
import { defaultFlythroughSettings } from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { createFlythroughEffectInstance } from '@Core/ui/flythrough/FlythroughEffects'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import YAML from 'yaml'

vi.mock('@Components/PopupAnchor', () => ({
    PopupAnchor: ({id}) => <span data-testid={id}/>,
}))

vi.mock('@Components/PopupDrawer', () => ({
    PopupDrawer: ({active, header, headerActions, footer, children}) => active ? (
        <div data-testid="popup-drawer">
            <div data-testid="popup-header-actions">{headerActions}</div>
            <div data-testid="popup-header">{header}</div>
            <div data-testid="popup-body">{children}</div>
            <div data-testid="popup-footer">{footer}</div>
        </div>
    ) : null,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaIcon: () => <span/>,
    WaNumberInput: ({label, onInput, value, ...props}) => (
        <label>
            {label}
            <input aria-label={label} value={value} onInput={onInput} {...props}/>
        </label>
    ),
    WaOption: ({children, value}) => <option value={value}>{children}</option>,
    WaSelect: ({children, label, onChange, value, ...props}) => (
        <label>
            {label}
            <select aria-label={label} value={value} onChange={onChange} {...props}>{children}</select>
        </label>
    ),
    WaTooltip: ({children}) => <span>{children}</span>,
}))

vi.mock('sortablejs', () => ({
    default: class SortableMock {
        constructor(element, options) {
            this.element = element
            this.options = options
            globalThis.__flythroughSortableInstances = globalThis.__flythroughSortableInstances ?? []
            globalThis.__flythroughSortableInstances.push(this)
        }

        destroy() {
        }

        toArray() {
            return Array.from(this.element.querySelectorAll('[data-id]'))
                .map(node => node.getAttribute('data-id'))
                .filter(Boolean)
        }
    },
}))

const loadFlythroughEffectsCatalog = () => YAML.parse(readFileSync('public/flythrough.yaml', 'utf8')).flythrough.effects.catalog

describe('FlythroughEffectsTab', () => {
    beforeEach(() => {
        const flythrough = proxy(defaultFlythroughSettings())
        flythrough.effects.catalog = loadFlythroughEffectsCatalog()
        flythrough.effects.start = []
        flythrough.effects.stop = []
        const journey = proxy({
            slug:            'journey#test',
            flythrough:      {
                start: [],
                stop:  [],
            },
            persistToDatabase: vi.fn(),
        })

        globalThis.lgs = {
            settings: proxy({
                ui: {
                    flythrough: proxy(flythrough),
                },
                unitSystem: proxy({current: 0}),
            }),
            stores: {
                main: proxy({
                    theJourney: journey,
                }),
                flythrough: proxy({
                    ...flythrough,
                }),
            },
            theJourney: journey,
        }
        globalThis.__flythroughSortableInstances = []
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__flythroughSortableInstances = []
        vi.unstubAllGlobals()
    })

    it('adds an effect from the add popup and updates the lists', async () => {
        const flythrough = globalThis.lgs.settings.ui.flythrough
        const launch = flythrough.effects.catalog.launch
        const journey = globalThis.lgs.theJourney
        const view = render(
            <FlythroughEffectsTab
                settings={flythrough}
                state={globalThis.lgs.stores.flythrough}
            />,
        )

        fireEvent.click(view.getAllByRole('button', {name: 'Add effect'})[0])
        fireEvent.click(view.getByText(launch.label))
        fireEvent.click(view.getByRole('button', {name: 'Add'}))

        await waitFor(() => {
            expect(journey.flythrough.start).toHaveLength(1)
            expect(globalThis.lgs.stores.flythrough.effects.start).toHaveLength(1)
        })

        expect(view.getByText(launch.label)).toBeTruthy()
    })

    it('edits an effect in place without duplicating it', async () => {
        const flythrough = globalThis.lgs.settings.ui.flythrough
        const launch = createFlythroughEffectInstance(flythrough.effects.catalog.launch, 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.flythrough.start = [launch]
        globalThis.lgs.theJourney.flythrough.stop = []
        globalThis.lgs.stores.flythrough.effects.start = [launch]

        const view = render(
            <FlythroughEffectsTab
                settings={flythrough}
                state={globalThis.lgs.stores.flythrough}
            />,
        )

        fireEvent.click(view.getByRole('button', {name: 'Edit effect'}))
        fireEvent.click(view.getByRole('button', {name: 'Apply'}))

        await waitFor(() => {
            expect(globalThis.lgs.theJourney.flythrough.start).toHaveLength(1)
            expect(globalThis.lgs.theJourney.flythrough.start[0].id).toBe(launch.id)
            expect(globalThis.lgs.stores.flythrough.effects.start).toHaveLength(1)
        })
    })

    it('removes saturated effects from the add popup list', async () => {
        const flythrough = globalThis.lgs.settings.ui.flythrough
        const zoomOut = createFlythroughEffectInstance(flythrough.effects.catalog['zoom-out'], 'stop', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.flythrough.stop = [zoomOut]
        globalThis.lgs.stores.flythrough.effects.stop = [zoomOut]

        const view = render(
            <FlythroughEffectsTab
                settings={flythrough}
                state={globalThis.lgs.stores.flythrough}
            />,
        )

        fireEvent.click(view.getAllByRole('button', {name: 'Add effect'})[1])

        const popup = within(view.getByTestId('popup-body'))

        expect(popup.queryByText('ZoomOut')).toBeNull()
        expect(popup.getByText('Focus')).toBeTruthy()
        expect(popup.getByText('Landing')).toBeTruthy()
    })

    it('filters add options from the current runtime effects, not only from settings', async () => {
        const flythrough = globalThis.lgs.settings.ui.flythrough
        const zoomIn = createFlythroughEffectInstance(flythrough.effects.catalog['zoom-in'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.flythrough.start = [zoomIn]
        globalThis.lgs.theJourney.flythrough.stop = []
        globalThis.lgs.stores.flythrough.effects.start = [zoomIn]

        const view = render(
            <FlythroughEffectsTab
                settings={flythrough}
                state={globalThis.lgs.stores.flythrough}
            />,
        )

        fireEvent.click(view.getAllByRole('button', {name: 'Add effect'})[0])

        const popup = within(view.getByTestId('popup-body'))
        expect(popup.queryByText('ZoomIn')).toBeNull()
        expect(popup.getByText('Launch')).toBeTruthy()
    })

    it('removes the add effect button when no effect is available for the slot', () => {
        const flythrough = globalThis.lgs.settings.ui.flythrough
        const zoomInDefinition = flythrough.effects.catalog['zoom-in']
        const zoomIn = createFlythroughEffectInstance(zoomInDefinition, 'start')
        const limitedFlythrough = {
            ...flythrough,
            effects: {
                ...flythrough.effects,
                catalog: {
                    'zoom-in': zoomInDefinition,
                },
            },
        }

        globalThis.lgs.theJourney.flythrough.start = [zoomIn]
        globalThis.lgs.theJourney.flythrough.stop = []
        globalThis.lgs.stores.flythrough.effects.start = [zoomIn]
        globalThis.lgs.stores.flythrough.effects.catalog = {
            'zoom-in': zoomInDefinition,
        }

        const view = render(
            <FlythroughEffectsTab
                settings={limitedFlythrough}
                state={globalThis.lgs.stores.flythrough}
            />,
        )

        const addButtons = view.getAllByRole('button', {name: 'Add effect'})
        expect(addButtons).toHaveLength(2)
        expect(addButtons[0].disabled).toBe(true)
        expect(addButtons[1].disabled).toBe(true)
    })

    it('refreshes the move arrows after a drag reorder', async () => {
        const flythrough = globalThis.lgs.settings.ui.flythrough
        const launch = createFlythroughEffectInstance(flythrough.effects.catalog.launch, 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch:    -35,
            },
        })
        const zoomIn = createFlythroughEffectInstance(flythrough.effects.catalog['zoom-in'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch:    -35,
            },
        })

        globalThis.lgs.theJourney.flythrough.start = [launch, zoomIn]
        globalThis.lgs.stores.flythrough.effects.start = [launch, zoomIn]

        const view = render(
            <FlythroughEffectsTab
                settings={flythrough}
                state={globalThis.lgs.stores.flythrough}
            />,
        )

        const startSection = view.getByText('Start').closest('section')
        const list = startSection.querySelector('.flythrough-effects-list')
        const sortable = globalThis.__flythroughSortableInstances[0]

        expect(list.querySelectorAll('.flythrough-effect-row-shell')).toHaveLength(2)
        expect(list.querySelectorAll('.flythrough-effect-row-shell')[0].textContent).toContain('Launch')
        expect(list.querySelectorAll('.flythrough-effect-row-shell')[1].textContent).toContain('ZoomIn')

        list.insertBefore(list.children[1], list.children[0])
        sortable.options.onEnd()

        await waitFor(() => {
            const rows = list.querySelectorAll('.flythrough-effect-row-shell')
            expect(rows[0].textContent).toContain('ZoomIn')
            expect(rows[1].textContent).toContain('Launch')
            expect(rows[0].querySelector('[aria-label="Move effect up"]').disabled).toBe(true)
            expect(rows[0].querySelector('[aria-label="Move effect down"]').disabled).toBe(false)
            expect(rows[1].querySelector('[aria-label="Move effect up"]').disabled).toBe(false)
            expect(rows[1].querySelector('[aria-label="Move effect down"]').disabled).toBe(true)
        })
    })
})
