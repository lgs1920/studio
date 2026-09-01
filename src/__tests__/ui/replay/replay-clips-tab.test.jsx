/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-clips-tab.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-07
 * Last modified: 2026-09-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { JourneyReplayClipsTab } from '@Components/JourneyReplay/JourneyReplayClipsTab'
import { defaultJourneyReplaySettings } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { createJourneyReplayClipInstance } from '@Core/ui/replay/JourneyReplayClips'
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
    WaDetails: ({children, ...props}) => <div {...props}>{children}</div>,
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
            globalThis.__replaySortableInstances = globalThis.__replaySortableInstances ?? []
            globalThis.__replaySortableInstances.push(this)
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

const loadJourneyReplayClipsCatalog = () => YAML.parse(readFileSync('public/replay.yaml', 'utf8')).replay.clips.catalog

describe('JourneyReplayClipsTab', () => {
    beforeEach(() => {
        const replay = proxy(defaultJourneyReplaySettings())
        replay.clips.catalog = loadJourneyReplayClipsCatalog()
        replay.clips.start = []
        replay.clips.stop = []
        const journey = proxy({
            slug:            'journey#test',
            replay:      {
                start: [],
                stop:  [],
            },
            persistToDatabase: vi.fn(),
        })

        globalThis.lgs = {
            settings: proxy({
                ui: {
                    replay: proxy(replay),
                },
                unitSystem: proxy({current: 0}),
            }),
            stores: {
                main: proxy({
                    theJourney: journey,
                }),
                replay: proxy({
                    ...replay,
                }),
            },
            theJourney: journey,
        }
        globalThis.__replaySortableInstances = []
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__replaySortableInstances = []
        vi.unstubAllGlobals()
    })

    it('uses the requested labels and icons for the built-in clips', () => {
        const catalog = globalThis.lgs.settings.ui.replay.clips.catalog

        expect(catalog['zoom-out']).toMatchObject({label: 'ZoomOut', icon: 'circle-minus'})
        expect(catalog['zoom-in']).toMatchObject({label: 'ZoomIn', icon: 'circle-plus'})
        expect(catalog['take-off']).toMatchObject({label: 'Take off', icon: 'arrow-up-right'})
        expect(catalog.landing).toMatchObject({label: 'land', icon: 'arrow-down-right'})
    })

    it('adds a clip from the add popup and updates the lists', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        const takeOff = replay.clips.catalog['take-off']
        const journey = globalThis.lgs.theJourney
        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        fireEvent.click(view.getAllByRole('button', {name: 'Add clip'})[0])
        fireEvent.click(view.getByText(takeOff.label))

        await waitFor(() => {
            expect(journey.replay.start).toHaveLength(1)
            expect(globalThis.lgs.stores.replay.clips.start).toHaveLength(1)
        })

        expect(view.getByText(takeOff.label)).toBeTruthy()
    })

    it('uses whole-second steps for duration fields', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        fireEvent.click(view.getAllByRole('button', {name: 'Add clip'})[0])
        fireEvent.click(view.getByText(replay.clips.catalog['take-off'].label))

        const durationInput = await view.findByLabelText('Duration (s)')
        expect(durationInput.getAttribute('step')).toBe('1')
    })

    it('opens and persists select fields on a clip', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        const zoomIn = createJourneyReplayClipInstance(replay.clips.catalog['zoom-in'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
                pathMode: 'auto',
            },
        })

        globalThis.lgs.theJourney.replay.start = [zoomIn]
        globalThis.lgs.theJourney.replay.stop = []
        globalThis.lgs.stores.replay.clips.start = [zoomIn]

        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        const pathSelect = view.getByLabelText('Path')
        expect(globalThis.__replaySortableInstances[0].options.preventOnFilter).toBe(false)
        fireEvent.pointerDown(pathSelect)
        fireEvent.change(pathSelect, {target: {value: 'spiral-conical'}})

        await waitFor(() => {
            expect(globalThis.lgs.theJourney.replay.start[0].params.pathMode).toBe('spiral-conical')
            expect(globalThis.lgs.stores.replay.clips.start[0].params.pathMode).toBe('spiral-conical')
        })
    })

    it('labels altitude as ground offset and derives its minimum from the replay and previous clip', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        replay.camera.altitudeMode = 'ground-offset'
        replay.camera.altitude = 1200
        const takeOff = createJourneyReplayClipInstance(replay.clips.catalog['take-off'], 'start', {
            params: {
                duration: 2,
                altitude: 1800,
                pitch: -35,
            },
        })
        const zoomIn = createJourneyReplayClipInstance(replay.clips.catalog['zoom-in'], 'start', {
            params: {
                duration: 2,
                altitude: 1500,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.replay.start = [takeOff, zoomIn]
        globalThis.lgs.theJourney.replay.stop = []
        globalThis.lgs.stores.replay.clips.start = [takeOff, zoomIn]

        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        const offsets = view.getAllByLabelText('Ground offset (m)')
        expect(offsets).toHaveLength(2)
        expect(offsets[1].getAttribute('min')).toBe('1800')
    })

    it('edits a clip in place without duplicating it', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        const takeOff = createJourneyReplayClipInstance(replay.clips.catalog['take-off'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.replay.start = [takeOff]
        globalThis.lgs.theJourney.replay.stop = []
        globalThis.lgs.stores.replay.clips.start = [takeOff]

        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        const durationInput = view.getByLabelText('Duration (s)')
        fireEvent.focus(durationInput)
        fireEvent.input(durationInput, {target: {value: '4'}})
        fireEvent.blur(durationInput)

        await waitFor(() => {
            expect(globalThis.lgs.theJourney.replay.start).toHaveLength(1)
            expect(globalThis.lgs.theJourney.replay.start[0].id).toBe(takeOff.id)
            expect(globalThis.lgs.theJourney.replay.start[0].params.duration).toBe(4)
            expect(globalThis.lgs.stores.replay.clips.start).toHaveLength(1)
            expect(globalThis.lgs.stores.replay.clips.start[0].params.duration).toBe(4)
        })
    })

    it('renders a stable internal anchor for every clip instance', () => {
        const replay = globalThis.lgs.settings.ui.replay
        const takeOff = createJourneyReplayClipInstance(replay.clips.catalog['take-off'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.replay.start = [takeOff]
        globalThis.lgs.stores.replay.clips.start = [takeOff]

        const view = render(<JourneyReplayClipsTab settings={replay}/>)

        expect(view.container.querySelector(`#replay-clip-${takeOff.id}`)).not.toBeNull()
    })

    it('removes a clip from the list', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        const takeOff = createJourneyReplayClipInstance(replay.clips.catalog['take-off'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.replay.start = [takeOff]
        globalThis.lgs.theJourney.replay.stop = []
        globalThis.lgs.stores.replay.clips.start = [takeOff]

        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        fireEvent.click(view.getByRole('button', {name: 'Remove clip'}))

        await waitFor(() => {
            expect(globalThis.lgs.theJourney.replay.start).toHaveLength(0)
            expect(globalThis.lgs.stores.replay.clips.start).toHaveLength(0)
        })
    })

    it('removes saturated clips from the add popup list', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        const zoomOut = createJourneyReplayClipInstance(replay.clips.catalog['zoom-out'], 'stop', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.replay.stop = [zoomOut]
        globalThis.lgs.stores.replay.clips.stop = [zoomOut]

        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        fireEvent.click(view.getAllByRole('button', {name: 'Add clip'})[1])

        const popup = within(view.getByTestId('popup-body'))

        expect(popup.queryByText('ZoomOut')).toBeNull()
        expect(popup.getByText('Focus')).toBeTruthy()
        expect(popup.getByText('land')).toBeTruthy()
    })

    it('filters add options from the current runtime clips, not only from settings', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        const zoomIn = createJourneyReplayClipInstance(replay.clips.catalog['zoom-in'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch: -35,
            },
        })

        globalThis.lgs.theJourney.replay.start = [zoomIn]
        globalThis.lgs.theJourney.replay.stop = []
        globalThis.lgs.stores.replay.clips.start = [zoomIn]

        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        fireEvent.click(view.getAllByRole('button', {name: 'Add clip'})[0])

        const popup = within(view.getByTestId('popup-body'))
        expect(popup.queryByText('ZoomIn')).toBeNull()
        expect(popup.getByText('Take off')).toBeTruthy()
    })

    it('removes the add clip button when no clip is available for the slot', () => {
        const replay = globalThis.lgs.settings.ui.replay
        const zoomInDefinition = replay.clips.catalog['zoom-in']
        const zoomIn = createJourneyReplayClipInstance(zoomInDefinition, 'start')
        const limitedJourneyReplay = {
            ...replay,
            clips: {
                ...replay.clips,
                catalog: {
                    'zoom-in': zoomInDefinition,
                },
            },
        }

        globalThis.lgs.theJourney.replay.start = [zoomIn]
        globalThis.lgs.theJourney.replay.stop = []
        globalThis.lgs.stores.replay.clips.start = [zoomIn]
        globalThis.lgs.stores.replay.clips.catalog = {
            'zoom-in': zoomInDefinition,
        }

        const view = render(
            <JourneyReplayClipsTab
                settings={limitedJourneyReplay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        const addButtons = view.getAllByRole('button', {name: 'Add clip'})
        expect(addButtons).toHaveLength(2)
        expect(addButtons[0].disabled).toBe(true)
        expect(addButtons[1].disabled).toBe(true)
    })

    it('refreshes the move arrows after a drag reorder', async () => {
        const replay = globalThis.lgs.settings.ui.replay
        const takeOff = createJourneyReplayClipInstance(replay.clips.catalog['take-off'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch:    -35,
            },
        })
        const zoomIn = createJourneyReplayClipInstance(replay.clips.catalog['zoom-in'], 'start', {
            params: {
                duration: 2,
                altitude: 300,
                pitch:    -35,
            },
        })

        globalThis.lgs.theJourney.replay.start = [takeOff, zoomIn]
        globalThis.lgs.stores.replay.clips.start = [takeOff, zoomIn]

        const view = render(
            <JourneyReplayClipsTab
                settings={replay}
                state={globalThis.lgs.stores.replay}
            />,
        )

        const startSection = view.getByText('Pre-replay').closest('section')
        const list = startSection.querySelector('.replay-clips-list')
        const sortable = globalThis.__replaySortableInstances[0]

        expect(list.querySelectorAll('.replay-clip-details')).toHaveLength(2)
        expect(list.querySelectorAll('.replay-clip-details')[0].textContent).toContain('Take off')
        expect(list.querySelectorAll('.replay-clip-details')[1].textContent).toContain('ZoomIn')

        list.insertBefore(list.children[1], list.children[0])
        sortable.options.onEnd()

        await waitFor(() => {
            const rows = list.querySelectorAll('.replay-clip-details')
            expect(rows[0].textContent).toContain('ZoomIn')
            expect(rows[1].textContent).toContain('Take off')
            expect(rows[0].querySelector('[aria-label="Move clip up"]').disabled).toBe(true)
            expect(rows[0].querySelector('[aria-label="Move clip down"]').disabled).toBe(false)
            expect(rows[1].querySelector('[aria-label="Move clip up"]').disabled).toBe(false)
            expect(rows[1].querySelector('[aria-label="Move clip down"]').disabled).toBe(true)
        })
    })
})
