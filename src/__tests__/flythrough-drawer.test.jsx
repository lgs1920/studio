/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythrough-drawer.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-01
 * Last modified: 2026-06-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, waitFor }             from '@testing-library/react'
import { FLYTHROUGH_DRAWER }                               from '@Core/constants'
import {
    defaultFlythroughSettings, FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH, FLYTHROUGH_MARKER_MODE_HYSTERESIS,
    FLYTHROUGH_MARKER_MODE_NAVIGATION,
} from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { createFlythroughClipInstance }                          from '@Core/ui/flythrough/FlythroughClips'
import { FlythroughDrawer }                                from '@Components/Flythrough/FlythroughDrawer'
import { ELEVATION_UNITS, UnitUtils }                      from '@Utils/UnitUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                                           from 'valtio'

vi.mock('@Components/DrawerFooter', () => ({
    default: () => <div data-testid="drawer-footer"/>,
}))

vi.mock('@Components/Flythrough/FlythroughProgressBar', () => ({
    FlythroughProgressBar: () => <div data-testid="flythrough-progress"/>,
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <div>{children}</div>,
}))

vi.mock('@Components/PanelsActions', () => ({
    default: () => <div data-testid="panel-actions"/>,
}))

vi.mock('@Components/WaDrawerNonModal', () => ({
    default: ({children, open, ...props}) => open ? <div data-testid="wa-drawer" {...props}>{children}</div> : null,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaCard: ({children, ...props}) => <div {...props}>{children}</div>,
    WaColorPicker: props => <input data-testid={props['aria-label'] ?? 'color'} {...props} />,
    WaDivider: () => <hr/>,
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
    WaSlider: ({label, onInput, value, ...props}) => (
        <label>
            {label}
            <input aria-label={label} value={value} onInput={onInput} {...props}/>
        </label>
    ),
    WaSwitch: ({children, checked, onChange, ...props}) => (
        <label>
            <input type="checkbox" checked={checked} onChange={onChange} {...props}/>
            {children}
        </label>
    ),
    WaTab: ({children}) => <button type="button">{children}</button>,
    WaTabGroup: ({children}) => <div>{children}</div>,
    WaTabPanel: ({children}) => <div>{children}</div>,
    WaTextarea: ({label, value, ...props}) => (
        <label>
            {label}
            <textarea aria-label={label} value={value} readOnly {...props}/>
        </label>
    ),
    WaTooltip: ({children}) => <span>{children}</span>,
}))

describe('FlythroughDrawer', () => {
    beforeEach(() => {
        const flythrough = proxy(defaultFlythroughSettings())
        flythrough.marker.mode = FLYTHROUGH_MARKER_MODE_NAVIGATION
        globalThis.lgs = {
            colors: {
                poiDefault:           '#fff',
                poiDefaultBackground: '#000',
            },
            settings: proxy({
                ui: {
                    flythrough: proxy(flythrough),
                },
                unitSystem: proxy({current: 0}),
                getSwatches: {
                    list: ['#ffffff', '#000000'],
                },
            }),
            stores: {
                ui: proxy({
                    drawers: proxy({open: FLYTHROUGH_DRAWER}),
                }),
                main: proxy({
                    theJourney: {slug: 'journey-a'},
                }),
                flythrough: proxy({
                    ...flythrough,
                    camera: proxy({...flythrough.camera}),
                    trace: proxy({...flythrough.trace, remaining: {...flythrough.trace.remaining}}),
                    marker: proxy({...flythrough.marker}),
                    progression: proxy({...flythrough.progression, fill: {...flythrough.progression.fill}, border: {...flythrough.progression.border}}),
                }),
            },
            scene: {
                requestRender: vi.fn(),
                globe:          {
                    getHeight: vi.fn(() => 300),
                },
            },
            editorSettingsProxy: {
                menu: proxy({
                    drawer: 'right',
                }),
            },
        }

        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
                drawerManager: {
                    drawerRoot: document.body,
                    close:       vi.fn(),
                    isCurrent:   vi.fn(() => true),
                },
                flythrough: {
                    configure:     vi.fn(),
                    refresh:       vi.fn(),
                    refreshCamera: vi.fn(),
                    stop:          vi.fn(),
                    setHideOtherJourneys: vi.fn(),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
        vi.unstubAllGlobals()
    })

    it('applies camera edits to Cesium immediately', async () => {
        const view = render(<FlythroughDrawer/>)
        const pitchInput = view.getByLabelText('Pitch (deg)')

        fireEvent.input(pitchInput, {target: {value: '-20'}})

        await waitFor(() => {
            expect(__.ui.flythrough.refresh).toHaveBeenCalledWith({camera: true})
            expect(__.ui.flythrough.refreshCamera).toHaveBeenCalledWith({
                sample:             null,
                suppressMoveEvents: false,
            })
            expect(globalThis.lgs.settings.ui.flythrough.camera.pitch).toBe(-20)
            expect(globalThis.lgs.stores.flythrough.camera.pitch).toBe(-20)
        })
    })

    it('keeps altitude as a single value when switching to ground offset mode', async () => {
        globalThis.lgs.stores.flythrough.sample = {
            longitude: 2,
            latitude:  48,
        }

        const view = render(<FlythroughDrawer/>)
        const altitudeModeSelect = view.getByLabelText('Camera altitude')

        fireEvent.change(altitudeModeSelect, {target: {value: 'ground-offset'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitudeMode).toBe('ground-offset')
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(900)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(900)
            expect(globalThis.lgs.settings.ui.flythrough.camera.groundOffset).toBeUndefined()
            expect(globalThis.lgs.stores.flythrough.camera.groundOffset).toBeUndefined()
        })
    })

    it('displays camera altitude in imperial units and stores it in meters', async () => {
        globalThis.lgs.settings.unitSystem.current = 1
        globalThis.lgs.stores.flythrough.camera.altitude = 1000
        globalThis.lgs.settings.ui.flythrough.camera.altitude = 1000

        const view = render(<FlythroughDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (ft)')

        expect(Number(altitudeInput.value)).toBe(Math.round(UnitUtils.convert(1000).to(ELEVATION_UNITS[1])))

        fireEvent.input(altitudeInput, {target: {value: '3280.84'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBeCloseTo(1000, 1)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBeCloseTo(1000, 1)
        })
    })

    it('applies the ultra smooth camera preset from the drawer', async () => {
        globalThis.lgs.stores.flythrough.marker.mode = FLYTHROUGH_MARKER_MODE_HYSTERESIS
        globalThis.lgs.settings.ui.flythrough.marker.mode = FLYTHROUGH_MARKER_MODE_HYSTERESIS

        const view = render(<FlythroughDrawer/>)
        const presetSelect = view.getByLabelText('Camera feel')

        fireEvent.change(presetSelect, {target: {value: FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.hysteresis.marginRatio).toBeCloseTo(0.2, 6)
            expect(globalThis.lgs.settings.ui.flythrough.camera.hysteresis.easing).toBeCloseTo(0.3, 6)
            expect(globalThis.lgs.stores.flythrough.camera.hysteresis.marginRatio).toBeCloseTo(0.2, 6)
            expect(globalThis.lgs.stores.flythrough.camera.hysteresis.easing).toBeCloseTo(0.3, 6)
        })
    })

    it('toggles hiding other journeys from the drawer', async () => {
        const view = render(<FlythroughDrawer/>)
        const hideOtherJourneysSwitch = view.getByLabelText('Hide other journeys')

        expect(hideOtherJourneysSwitch.checked).toBe(false)

        fireEvent.click(hideOtherJourneysSwitch)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.hideOtherJourneys).toBe(true)
            expect(globalThis.lgs.stores.flythrough.hideOtherJourneys).toBe(true)
            expect(__.ui.flythrough.setHideOtherJourneys).toHaveBeenCalledWith(true)
        })
    })

    it('shows the total video duration above the tabs', () => {
        const flythrough = globalThis.lgs.settings.ui.flythrough
        flythrough.duration = 60
        flythrough.clips = {
            catalog: {
                launch: {
                    id:       'launch',
                    label:    'Launch',
                    slots:    ['start'],
                    defaults: {duration: 2},
                    fields:   [],
                },
                landing: {
                    id:       'landing',
                    label:    'Landing',
                    slots:    ['stop'],
                    defaults: {duration: 3},
                    fields:   [],
                },
            },
            start: [],
            stop:  [],
        }

        const currentJourney = globalThis.lgs.stores.main.theJourney
        currentJourney.flythrough = {
            start: [
                createFlythroughClipInstance(flythrough.clips.catalog.launch, 'start', {
                    params: {duration: 2},
                }),
            ],
            stop: [
                createFlythroughClipInstance(flythrough.clips.catalog.landing, 'stop', {
                    params: {duration: 3},
                }),
            ],
        }

        const view = render(<FlythroughDrawer/>)

        expect(view.getByText('Total duration (s)')).toBeTruthy()
        expect(view.getByText('65')).toBeTruthy()
    })
})
