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
import { defaultFlythroughSettings, FLYTHROUGH_MARKER_MODE_NAVIGATION } from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { FlythroughDrawer }                                from '@Components/Flythrough/FlythroughDrawer'
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
    WaSwitch: ({children}) => <label>{children}</label>,
    WaTab: ({children}) => <button type="button">{children}</button>,
    WaTabGroup: ({children}) => <div>{children}</div>,
    WaTabPanel: ({children}) => <div>{children}</div>,
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
            expect(__.ui.flythrough.refreshCamera).not.toHaveBeenCalled()
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
})
