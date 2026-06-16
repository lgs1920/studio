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
    FLYTHROUGH_MARKER_MODE_NAVIGATION, FLYTHROUGH_MARKER_MODE_TRACE,
} from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { createFlythroughClipInstance }                          from '@Core/ui/flythrough/FlythroughClips'
import { FlythroughDrawer }                                from '@Components/Flythrough/FlythroughDrawer'
import { ELEVATION_UNITS, UnitUtils }                      from '@Utils/UnitUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                                           from 'valtio'
import { proxyMap }                                        from 'valtio/utils'

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
    WaDetails: ({children, ...props}) => <div {...props}>{children}</div>,
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
    WaSwitch: ({children, checked, onChange, onInput, ...props}) => (
        <label>
            <input type="checkbox" checked={checked} onChange={onInput ?? onChange} {...props}/>
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
        const poiList = proxyMap()
        poiList.set('poi-1', {
            id: 'poi-1',
            title: 'POI One',
            flythrough: {
                displayDurationSeconds: 4,
                hiddenFields: {
                    location: true,
                },
            },
        })
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
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                }),
                flythrough: proxy({
                    ...flythrough,
                    camera: proxy({...flythrough.camera}),
                    trace: proxy({...flythrough.trace, remaining: {...flythrough.trace.remaining}}),
                    marker: proxy({...flythrough.marker}),
                    progression: proxy({...flythrough.progression, fill: {...flythrough.progression.fill}, border: {...flythrough.progression.border}}),
                    nearbyPois: [],
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
                    open:        vi.fn(),
                },
                poiManager: {
                    updatePOI: vi.fn(async (id, updates) => {
                        const current = poiList.get(id)
                        poiList.set(id, {...current, ...updates})
                        return poiList.get(id)
                    }),
                    getFlythroughPOIsForJourney: vi.fn(() => [{poi: {id: 'poi-1'}, source: 'global-near-journey'}]),
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

    it('commits pitch edits while typing', async () => {
        const view = render(<FlythroughDrawer/>)
        const pitchInput = view.getByLabelText('Pitch (deg)')

        fireEvent.focus(pitchInput)
        fireEvent.input(pitchInput, {target: {value: '-20'}})

        expect(pitchInput.value).toBe('-20')

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.pitch).toBe(-20)
            expect(globalThis.lgs.stores.flythrough.camera.pitch).toBe(-20)
        })

        fireEvent.blur(pitchInput)

        await waitFor(() => {
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
            expect(view.getByLabelText('Ground offset (m)')).toBeTruthy()
        })
    })

    it('shows altitude and pitch fields in passive mode', () => {
        globalThis.lgs.stores.flythrough.marker.mode = FLYTHROUGH_MARKER_MODE_TRACE
        globalThis.lgs.settings.ui.flythrough.marker.mode = FLYTHROUGH_MARKER_MODE_TRACE

        const view = render(<FlythroughDrawer/>)

        expect(view.getByLabelText('Camera altitude')).toBeTruthy()
        expect(view.getByLabelText('Altitude (m)')).toBeTruthy()
        expect(view.getByLabelText('Pitch (deg)')).toBeTruthy()
        expect(view.queryByLabelText('Heading (deg)')).toBeNull()
    })

    it('shows the ground offset label when the camera mode is ground offset', () => {
        globalThis.lgs.stores.flythrough.camera.altitudeMode = 'ground-offset'
        globalThis.lgs.settings.ui.flythrough.camera.altitudeMode = 'ground-offset'

        const view = render(<FlythroughDrawer/>)

        expect(view.getByLabelText('Camera altitude')).toBeTruthy()
        expect(view.getByLabelText('Ground offset (m)')).toBeTruthy()
    })

    it('restores altitude on blur when the draft is emptied', async () => {
        globalThis.lgs.settings.unitSystem.current = 1
        globalThis.lgs.stores.flythrough.camera.altitude = 1000
        globalThis.lgs.settings.ui.flythrough.camera.altitude = 1000

        const view = render(<FlythroughDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (ft)')

        expect(Number(altitudeInput.value)).toBe(Math.round(UnitUtils.convert(1000).to(ELEVATION_UNITS[1])))

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: ''}})

        expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1000)
        expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1000)
        expect(altitudeInput.value).toBe('')

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1000)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1000)
            expect(altitudeInput.value).toBe(String(Math.round(UnitUtils.convert(1000).to(ELEVATION_UNITS[1]))))
        })
    })

    it('commits altitude edits on blur when the value is valid', async () => {
        const view = render(<FlythroughDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '1500'}})

        expect(altitudeInput.value).toBe('1500')
        expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1200)
        expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1200)

        fireEvent.blur(altitudeInput)
        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1500)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1500)
            expect(altitudeInput.value).toBe('1500')
        })
    })

    it('keeps the altitude draft stable while typing a multi-digit value', async () => {
        const view = render(<FlythroughDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '1'}})
        expect(altitudeInput.value).toBe('1')
        expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1200)

        fireEvent.input(altitudeInput, {target: {value: '10'}})
        expect(altitudeInput.value).toBe('10')
        expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1200)

        fireEvent.input(altitudeInput, {target: {value: '100'}})
        expect(altitudeInput.value).toBe('100')
        expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1200)

        fireEvent.input(altitudeInput, {target: {value: '1000'}})
        expect(altitudeInput.value).toBe('1000')
        expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1200)

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1000)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1000)
        })
    })

    it('updates altitude settings without moving the Cesium camera', async () => {
        const view = render(<FlythroughDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '1500'}})
        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1500)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1500)
        })

        expect(globalThis.__.ui.flythrough.refresh).toHaveBeenLastCalledWith({camera: false})
        expect(globalThis.__.ui.flythrough.refreshCamera).not.toHaveBeenCalled()
    })

    it('keeps a ground offset change stable even when change fires before focus', async () => {
        globalThis.lgs.stores.flythrough.camera.altitudeMode = 'ground-offset'
        globalThis.lgs.settings.ui.flythrough.camera.altitudeMode = 'ground-offset'

        const view = render(<FlythroughDrawer/>)
        const altitudeInput = view.getByLabelText('Ground offset (m)')

        fireEvent.change(altitudeInput, {target: {value: '1000'}})

        expect(altitudeInput.value).toBe('1000')
        expect(globalThis.lgs.stores.flythrough.cameraUpdateSource).toBe('drawer')

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1000)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1000)
        })

        expect(globalThis.__.ui.flythrough.refresh).toHaveBeenLastCalledWith({camera: false})
        expect(globalThis.__.ui.flythrough.refreshCamera).not.toHaveBeenCalled()
    })

    it('keeps drawer camera updates locked while the altitude draft is active', async () => {
        vi.useFakeTimers()
        try {
            const view = render(<FlythroughDrawer/>)
            const altitudeInput = view.getByLabelText('Altitude (m)')

            fireEvent.focus(altitudeInput)
            fireEvent.input(altitudeInput, {target: {value: '2000'}})

            await Promise.resolve()
            await Promise.resolve()

            expect(globalThis.lgs.stores.flythrough.cameraUpdateSource).toBe('drawer')

            await vi.advanceTimersByTimeAsync(500)

            expect(globalThis.lgs.stores.flythrough.cameraUpdateSource).toBe('drawer')

            fireEvent.blur(altitudeInput)

            await vi.advanceTimersByTimeAsync(200)

            expect(globalThis.lgs.stores.flythrough.cameraUpdateSource).toBeNull()
        }
        finally {
            vi.useRealTimers()
        }
    })

    it('commits heading edits while typing', async () => {
        const view = render(<FlythroughDrawer/>)
        const headingInput = view.getByLabelText('Heading (deg)')

        fireEvent.focus(headingInput)
        fireEvent.input(headingInput, {target: {value: '15'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.heading).toBe(15)
            expect(globalThis.lgs.stores.flythrough.camera.heading).toBe(15)
        })

        fireEvent.blur(headingInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.heading).toBe(15)
            expect(globalThis.lgs.stores.flythrough.camera.heading).toBe(15)
        })
    })

    it('does not commit altitude values below the minimum while typing', async () => {
        const view = render(<FlythroughDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '9'}})

        expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1200)
        expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1200)
        expect(altitudeInput.value).toBe('9')

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1200)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1200)
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
            expect(globalThis.lgs.stores.flythrough.hideOtherJourneys).toBe(true)
            expect(__.ui.flythrough.setHideOtherJourneys).toHaveBeenCalledWith(true)
            expect(globalThis.lgs.settings.ui.flythrough.hideOtherJourneys).toBe(true)
        })
    })

    it('shows the total video duration above the tabs', () => {
        const flythrough = globalThis.lgs.settings.ui.flythrough
        flythrough.duration = 60
        flythrough.clips = {
            catalog: {
                'take-off': {
                    id:       'take-off',
                    label:    'TakeOff',
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
                createFlythroughClipInstance(flythrough.clips.catalog['take-off'], 'start', {
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

    it('loads nearby poi candidates when the flythrough drawer opens', async () => {
        render(<FlythroughDrawer/>)

        await waitFor(() => {
            expect(__.ui.poiManager.getFlythroughPOIsForJourney).toHaveBeenCalledWith(
                globalThis.lgs.stores.main.theJourney,
                globalThis.lgs.settings.ui.flythrough.poiDistance,
            )
            expect(globalThis.lgs.stores.flythrough.nearbyPois).toEqual([
                {poi: {id: 'poi-1'}, source: 'global-near-journey'},
            ])
        })
    })

    it('updates the nearby poi distance from the drawer', async () => {
        const view = render(<FlythroughDrawer/>)
        const distanceInput = view.getByLabelText('Nearby POIs (m)')

        fireEvent.input(distanceInput, {target: {value: '2500'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.flythrough.poiDistance).toBe(2500)
            expect(globalThis.lgs.stores.flythrough.poiDistance).toBe(2500)
        })
    })

    it('exposes header shortcuts to toggle POI visibility and animation', async () => {
        const view = render(<FlythroughDrawer/>)

        await waitFor(() => {
            expect(view.getByLabelText('Hide POI during flythrough')).toBeTruthy()
            expect(view.getByLabelText('Disable POI animation during flythrough')).toBeTruthy()
        })

        fireEvent.click(view.getByLabelText('Disable POI animation during flythrough'))

        await waitFor(() => {
            const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-1')
            expect(poi.flythrough.animated).toBe(false)
            expect(view.getByLabelText('Enable POI animation during flythrough')).toBeTruthy()
        })

        fireEvent.click(view.getByLabelText('Hide POI during flythrough'))

        await waitFor(() => {
            const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-1')
            expect(poi.flythrough.visible).toBe(false)
            expect(view.getByLabelText('Show POI during flythrough')).toBeTruthy()
        })
    })

    it('persists flythrough poi settings from the POIs tab and opens POI editor stacked', async () => {
        const view = render(<FlythroughDrawer/>)

        expect(view.getByText('POIs')).toBeTruthy()

        await waitFor(() => {
            expect(view.getByText('POI One')).toBeTruthy()
        })

        const durationInput = view.getAllByLabelText('Duration (s)').at(-1)
        const showDuringFlythrough = view.getByLabelText('Show during flythrough')
        const hideCategory = view.getByLabelText('Hide category')
        const editButton = view.getByText('Edit POI')

        fireEvent.input(durationInput, {target: {value: '6'}})
        fireEvent.click(hideCategory)
        fireEvent.click(showDuringFlythrough)

        await waitFor(() => {
            const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-1')
            expect(poi.flythrough.displayDurationSeconds).toBe(6)
            expect(poi.flythrough.hiddenFields.category).toBe(true)
            expect(poi.flythrough.visible).toBe(false)
            expect(poi.flythrough.animated).toBe(true)
            expect(view.queryByLabelText('Animate during flythrough')).toBeNull()
            expect(view.queryByLabelText('Hide category')).toBeNull()
        })

        fireEvent.click(view.getByLabelText('Show during flythrough'))

        await waitFor(() => {
            const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-1')
            expect(poi.flythrough.visible).toBe(true)
            expect(view.getByLabelText('Animate during flythrough')).toBeTruthy()
            expect(view.getByLabelText('Hide category')).toBeTruthy()
        })

        fireEvent.click(editButton)

        await waitFor(() => {
            expect(__.ui.drawerManager.open).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    entity: 'poi-1',
                    stacked: true,
                }),
            )
        })
    })
})
