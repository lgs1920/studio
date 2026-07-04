/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-drawer.test.jsx
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

import { cleanup, fireEvent, render, waitFor }            from '@testing-library/react'
import { useState }                                        from 'react'
import { REPLAY_DRAWER }                               from '@Core/constants'
import {
    defaultJourneyReplaySettings, REPLAY_CAMERA_PRESET_ULTRA_SMOOTH, REPLAY_MARKER_MODE_HYSTERESIS,
    REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { createJourneyReplayClipInstance }                          from '@Core/ui/replay/JourneyReplayClips'
import { JourneyReplayDrawer }                                from '@Components/JourneyReplay/JourneyReplayDrawer'
import { ELEVATION_UNITS, UnitUtils }                      from '@Utils/UnitUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                                           from 'valtio'
import { proxyMap }                                        from 'valtio/utils'

vi.mock('@Components/DrawerFooter', () => ({
    default: () => <div data-testid="drawer-footer"/>,
}))

vi.mock('@Components/JourneyReplay/JourneyReplayProgressBar', () => ({
    JourneyReplayProgressBar: () => <div data-testid="replay-progress"/>,
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <div>{children}</div>,
}))

vi.mock('@Components/PanelsActions', () => ({
    default: ({stackedPanel, onBack, children}) => (
        <div
            data-testid="panel-actions"
            data-stacked={String(Boolean(stackedPanel))}
            data-has-back={String(Boolean(onBack))}
        >
            {children}
        </div>
    ),
}))

vi.mock('@Components/WaDrawerNonModal', () => ({
    default: ({children, open, ...props}) => open ? <div data-testid="wa-drawer" {...props}>{children}</div> : null,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => {
    const WaTab = ({children}) => <>{children}</>
    const WaTabPanel = ({children}) => <>{children}</>
    const WaButton = ({children, ...props}) => <button {...props}>{children}</button>
    const WaCard = ({children, ...props}) => <div {...props}>{children}</div>
    const WaColorPicker = props => <input data-testid={props['aria-label'] ?? 'color'} {...props} />
    const WaDivider = () => <hr/>
    const WaIcon = () => <span/>
    const WaDetails = ({children, ...props}) => <div {...props}>{children}</div>
    const WaNumberInput = ({label, onInput, value, ...props}) => (
        <label>
            {label}
            <input aria-label={label} value={value} onInput={onInput} {...props}/>
        </label>
    )
    const WaOption = ({children, value}) => <option value={value}>{children}</option>
    const WaSelect = ({children, label, onChange, value, ...props}) => (
        <label>
            {label}
            <select aria-label={label} value={value} onChange={onChange} {...props}>{children}</select>
        </label>
    )
    const WaSlider = ({label, onInput, value, ...props}) => (
        <label>
            {label}
            <input aria-label={label} value={value} onInput={onInput} {...props}/>
        </label>
    )
    const WaSwitch = ({children, checked, onChange, onInput, ...props}) => (
        <label>
            <input type="checkbox" checked={checked} onChange={onInput ?? onChange} {...props}/>
            {children}
        </label>
    )
    const WaTabGroup = ({children, onWaTabShow}) => {
        const childrenArray = Array.isArray(children) ? children : [children]
        const tabs = childrenArray.filter(child => child?.type === WaTab)
        const panels = childrenArray.filter(child => child?.type === WaTabPanel)
        const [active, setActive] = useState(tabs[0]?.props?.panel)

        return (
            <div>
                <div>
                    {tabs.map(tab => (
                        <button
                            key={tab.props.panel}
                            type="button"
                            onClick={() => {
                                setActive(tab.props.panel)
                                tab.props.onClick?.()
                                onWaTabShow?.({detail: {name: tab.props.panel}})
                            }}
                        >
                            {tab.props.children}
                        </button>
                    ))}
                </div>
                {panels.map(panel => (
                    panel.props.name === active ? <div key={panel.props.name}>{panel.props.children}</div> : null
                ))}
            </div>
        )
    }
    const WaTextarea = ({label, value, ...props}) => (
        <label>
            {label}
            <textarea aria-label={label} value={value} readOnly {...props}/>
        </label>
    )
    const WaTooltip = ({children}) => <span>{children}</span>

    return {
        WaButton,
        WaCard,
        WaColorPicker,
        WaDetails,
        WaDivider,
        WaIcon,
        WaNumberInput,
        WaOption,
        WaSelect,
        WaSlider,
        WaSwitch,
        WaTab,
        WaTabGroup,
        WaTabPanel,
        WaTextarea,
        WaTooltip,
    }
})

describe('JourneyReplayDrawer', () => {
    beforeEach(() => {
        const replay = proxy(defaultJourneyReplaySettings())
        replay.marker.mode = REPLAY_MARKER_MODE_NAVIGATION
        const poiList = proxyMap()
        poiList.set('poi-1', {
            id: 'poi-1',
            title: 'POI One',
            replay: {
                displayDurationSeconds: 4,
                hiddenFields: {
                    location: true,
                },
            },
        })
        poiList.set('take-off', {
            id:       'take-off',
            title:    'Take-off',
            visible:  true,
            replay: {
                visible: true,
            },
        })
        poiList.set('landing', {
            id:       'landing',
            title:    'Landing',
            visible:  true,
            replay: {
                visible: true,
            },
        })
        const poiEntities = new Map([
            ['take-off', {id: 'take-off', show: true, billboard: {show: true}}],
            ['landing', {id: 'landing', show: true, billboard: {show: true}}],
            ['journey-start', {id: 'journey-start', show: true, billboard: {show: true}}],
            ['journey-stop', {id: 'journey-stop', show: true, billboard: {show: true}}],
        ])
        globalThis.lgs = {
            colors: {
                poiDefault:           '#fff',
                poiDefaultBackground: '#000',
            },
            settings: proxy({
                ui: {
                    replay: proxy(replay),
                },
                unitSystem: proxy({current: 0}),
                getSwatches: {
                    list: ['#ffffff', '#000000'],
                },
            }),
            stores: {
                ui: proxy({
                    drawers: proxy({open: REPLAY_DRAWER}),
                }),
                main: proxy({
                    theJourney: {slug: 'journey-a'},
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                }),
                replay: proxy({
                    ...replay,
                    camera: proxy({...replay.camera}),
                    trace: proxy({...replay.trace, remaining: {...replay.trace.remaining}}),
                    marker: proxy({...replay.marker}),
                    progression: proxy({...replay.progression, fill: {...replay.progression.fill}, border: {...replay.progression.border}}),
                    nearbyPois: [],
                }),
            },
            scene: {
                requestRender: vi.fn(),
                globe:          {
                    getHeight: vi.fn(() => 300),
                },
            },
            viewer: {
                container: document.body,
                entities: {
                    getById: id => poiEntities.get(id) ?? null,
                },
                dataSources: {
                    length: 0,
                    get: vi.fn(),
                    getByName: vi.fn(() => []),
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
                    isStacked:   vi.fn(() => false),
                    open:        vi.fn(),
                    restoreDrawerUiState: vi.fn(),
                },
                poiManager: {
                    updatePOI: vi.fn(async (id, updates) => {
                        const current = poiList.get(id)
                        poiList.set(id, {...current, ...updates})
                        return poiList.get(id)
                    }),
                    getJourneyReplayPOIsForJourney: vi.fn(() => [{poi: {id: 'poi-1'}, source: 'global-near-journey'}]),
                },
                replay: {
                    configure:     vi.fn(),
                    refresh:       vi.fn(),
                    refreshCamera: vi.fn(),
                    stop:          vi.fn(),
                    setHideOtherJourneys: vi.fn(),
                    getAnglePreviewPoiIds: vi.fn(() => {
                        const journey = globalThis.lgs?.stores?.main?.theJourney
                        const tracks = Array.from(journey?.tracks?.values?.() ?? [])
                        if (tracks.length === 0) {
                            return []
                        }

                        return Array.from(new Set([
                            tracks[0]?.flags?.start,
                            tracks[tracks.length - 1]?.flags?.stop,
                        ].filter(Boolean)))
                    }),
                    showCameraAnglePreview: vi.fn(() => {
                        for (const poiId of globalThis.__.ui.replay.getAnglePreviewPoiIds()) {
                            const poi = poiEntities.get(poiId)
                            if (poi) {
                                poi.show = false
                            }
                        }
                    }),
                    hideCameraAnglePreview: vi.fn(() => {
                        for (const poiId of globalThis.__.ui.replay.getAnglePreviewPoiIds()) {
                            const poi = poiEntities.get(poiId)
                            if (poi) {
                                poi.show = true
                            }
                        }
                    }),
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
        const view = render(<JourneyReplayDrawer/>)
        const pitchInput = view.getByLabelText('Pitch (deg)')

        fireEvent.focus(pitchInput)
        fireEvent.input(pitchInput, {target: {value: '-20'}})

        expect(pitchInput.value).toBe('-20')

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(-20)
            expect(globalThis.lgs.stores.replay.camera.pitch).toBe(-20)
        })

        fireEvent.blur(pitchInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(-20)
            expect(globalThis.lgs.stores.replay.camera.pitch).toBe(-20)
        })
    })

    it('keeps altitude as a single value when switching to ground offset mode', async () => {
        globalThis.lgs.stores.replay.sample = {
            longitude: 2,
            latitude:  48,
        }

        const view = render(<JourneyReplayDrawer/>)
        const altitudeModeSelect = view.getByLabelText('Camera altitude')

        fireEvent.change(altitudeModeSelect, {target: {value: 'ground-offset'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.altitudeMode).toBe('ground-offset')
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(900)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(900)
            expect(globalThis.lgs.settings.ui.replay.camera.groundOffset).toBeUndefined()
            expect(globalThis.lgs.stores.replay.camera.groundOffset).toBeUndefined()
            expect(view.getByLabelText('Ground offset (m)')).toBeTruthy()
        })
    })

    it('shows advanced camera setup fields in passive mode', () => {
        globalThis.lgs.stores.replay.marker.mode = REPLAY_MARKER_MODE_TRACE
        globalThis.lgs.settings.ui.replay.marker.mode = REPLAY_MARKER_MODE_TRACE
        globalThis.lgs.stores.replay.camera.positionMode = 'behind'
        globalThis.lgs.settings.ui.replay.camera.positionMode = 'behind'
        globalThis.lgs.stores.replay.camera.headingOffset = 15
        globalThis.lgs.settings.ui.replay.camera.headingOffset = 15

        const view = render(<JourneyReplayDrawer/>)

        expect(view.getByText('Advanced camera setup')).toBeTruthy()
        expect(view.getByLabelText('Camera position')).toBeTruthy()
        expect(view.getByLabelText('Camera angle')).toBeTruthy()
        expect(view.getByLabelText('Camera angle').value).toBe('-15')
        expect(view.getByLabelText('Camera altitude')).toBeTruthy()
        expect(view.getByLabelText('Altitude (m)')).toBeTruthy()
        expect(view.getByLabelText('Pitch (deg)')).toBeTruthy()
        expect(view.getByLabelText('Heading (deg)')).toBeTruthy()
        expect(view.getByLabelText('Camera feel')).toBeTruthy()
    })

    it('inverts the camera angle slider and shows the runtime preview while editing', async () => {
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
        globalThis.lgs.stores.replay.camera.positionMode = 'behind'
        globalThis.lgs.settings.ui.replay.camera.positionMode = 'behind'
        globalThis.lgs.settings.ui.replay.clips = {
            catalog: {
                'take-off': {id: 'take-off', slots: ['start']},
                landing:    {id: 'landing', slots: ['stop']},
            },
            start: [
                createJourneyReplayClipInstance({id: 'take-off', slots: ['start']}, 'start'),
            ],
            stop: [
                createJourneyReplayClipInstance({id: 'landing', slots: ['stop']}, 'stop'),
            ],
        }
        globalThis.lgs.stores.main.theJourney.replay = {
            start: [...globalThis.lgs.settings.ui.replay.clips.start],
            stop:  [...globalThis.lgs.settings.ui.replay.clips.stop],
        }
        globalThis.lgs.stores.main.theJourney.tracks = new Map([
            ['track#journey-a#main', {
                slug:  'track#journey-a#main',
                flags: {
                    start: 'journey-start',
                    stop:  'journey-stop',
                },
            }],
        ])
        globalThis.lgs.stores.replay.clips = globalThis.lgs.settings.ui.replay.clips

        const view = render(<JourneyReplayDrawer/>)
        const angleInput = view.getByLabelText('Camera angle')

        fireEvent.focus(angleInput)
        expect(globalThis.__.ui.replay.showCameraAnglePreview).toHaveBeenCalledTimes(1)
        expect(globalThis.__.ui.replay.showCameraAnglePreview.mock.calls[0][0].positionMode).toBe('behind')
        expect(Math.abs(globalThis.__.ui.replay.showCameraAnglePreview.mock.calls[0][0].displayOffset)).toBe(0)
        expect(globalThis.lgs.viewer.entities.getById('journey-start').show).toBe(false)
        expect(globalThis.lgs.viewer.entities.getById('journey-stop').show).toBe(false)
        fireEvent.input(angleInput, {target: {value: '20'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.headingOffset).toBe(-20)
            expect(globalThis.lgs.stores.replay.camera.headingOffset).toBe(-20)
        })

        expect(globalThis.__.ui.replay.showCameraAnglePreview).toHaveBeenLastCalledWith(expect.objectContaining({
            displayOffset: -20,
            positionMode:  'behind',
        }))
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000)

        fireEvent.blur(angleInput)
        expect(globalThis.__.ui.replay.hideCameraAnglePreview).toHaveBeenCalledTimes(1)
        expect(globalThis.lgs.viewer.entities.getById('journey-start').show).toBe(true)
        expect(globalThis.lgs.viewer.entities.getById('journey-stop').show).toBe(true)
        setTimeoutSpy.mockRestore()
    })

    it('shows the ground offset label when the camera mode is ground offset', () => {
        globalThis.lgs.stores.replay.camera.altitudeMode = 'ground-offset'
        globalThis.lgs.settings.ui.replay.camera.altitudeMode = 'ground-offset'

        const view = render(<JourneyReplayDrawer/>)

        expect(view.getByLabelText('Camera altitude')).toBeTruthy()
        expect(view.getByLabelText('Ground offset (m)')).toBeTruthy()
    })

    it('restores altitude on blur when the draft is emptied', async () => {
        globalThis.lgs.settings.unitSystem.current = 1
        globalThis.lgs.stores.replay.camera.altitude = 1000
        globalThis.lgs.settings.ui.replay.camera.altitude = 1000

        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (ft)')

        expect(Number(altitudeInput.value)).toBe(Math.round(UnitUtils.convert(1000).to(ELEVATION_UNITS[1])))

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: ''}})

        expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1000)
        expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1000)
        expect(altitudeInput.value).toBe('')

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1000)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1000)
            expect(altitudeInput.value).toBe(String(Math.round(UnitUtils.convert(1000).to(ELEVATION_UNITS[1]))))
        })
    })

    it('commits altitude edits on blur when the value is valid', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '1500'}})

        expect(altitudeInput.value).toBe('1500')
        expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1200)
        expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1200)

        fireEvent.blur(altitudeInput)
        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1500)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1500)
            expect(altitudeInput.value).toBe('1500')
        })
    })

    it('keeps the altitude draft stable while typing a multi-digit value', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '1'}})
        expect(altitudeInput.value).toBe('1')
        expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1200)

        fireEvent.input(altitudeInput, {target: {value: '10'}})
        expect(altitudeInput.value).toBe('10')
        expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1200)

        fireEvent.input(altitudeInput, {target: {value: '100'}})
        expect(altitudeInput.value).toBe('100')
        expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1200)

        fireEvent.input(altitudeInput, {target: {value: '1000'}})
        expect(altitudeInput.value).toBe('1000')
        expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1200)

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1000)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1000)
        })
    })

    it('updates altitude settings without moving the Cesium camera', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '1500'}})
        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1500)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1500)
        })

        expect(globalThis.__.ui.replay.refresh).toHaveBeenLastCalledWith({camera: false})
        expect(globalThis.__.ui.replay.refreshCamera).not.toHaveBeenCalled()
    })

    it('keeps a ground offset change stable even when change fires before focus', async () => {
        globalThis.lgs.stores.replay.camera.altitudeMode = 'ground-offset'
        globalThis.lgs.settings.ui.replay.camera.altitudeMode = 'ground-offset'

        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Ground offset (m)')

        fireEvent.change(altitudeInput, {target: {value: '1000'}})

        expect(altitudeInput.value).toBe('1000')
        expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBe('drawer')

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1000)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1000)
        })

        expect(globalThis.__.ui.replay.refresh).toHaveBeenLastCalledWith({camera: false})
        expect(globalThis.__.ui.replay.refreshCamera).not.toHaveBeenCalled()
    })

    it('keeps drawer camera updates locked while the altitude draft is active', async () => {
        vi.useFakeTimers()
        try {
            const view = render(<JourneyReplayDrawer/>)
            const altitudeInput = view.getByLabelText('Altitude (m)')

            fireEvent.focus(altitudeInput)
            fireEvent.input(altitudeInput, {target: {value: '2000'}})

            await Promise.resolve()
            await Promise.resolve()

            expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBe('drawer')

            await vi.advanceTimersByTimeAsync(500)

            expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBe('drawer')

            fireEvent.blur(altitudeInput)

            await vi.advanceTimersByTimeAsync(200)

            expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBeNull()
        }
        finally {
            vi.useRealTimers()
        }
    })

    it('commits heading edits while typing', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const headingInput = view.getByLabelText('Heading (deg)')

        fireEvent.focus(headingInput)
        fireEvent.input(headingInput, {target: {value: '15'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.heading).toBe(15)
            expect(globalThis.lgs.stores.replay.camera.heading).toBe(15)
        })

        fireEvent.blur(headingInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.heading).toBe(15)
            expect(globalThis.lgs.stores.replay.camera.heading).toBe(15)
        })
    })

    it('does not commit altitude values below the minimum while typing', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '9'}})

        expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1200)
        expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1200)
        expect(altitudeInput.value).toBe('9')

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1200)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1200)
        })
    })

    it('applies the ultra smooth camera preset from the drawer', async () => {
        globalThis.lgs.stores.replay.marker.mode = REPLAY_MARKER_MODE_HYSTERESIS
        globalThis.lgs.settings.ui.replay.marker.mode = REPLAY_MARKER_MODE_HYSTERESIS

        const view = render(<JourneyReplayDrawer/>)
        const presetSelect = view.getByLabelText('Camera feel')

        fireEvent.change(presetSelect, {target: {value: REPLAY_CAMERA_PRESET_ULTRA_SMOOTH}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.hysteresis.marginRatio).toBeCloseTo(0.2, 6)
            expect(globalThis.lgs.settings.ui.replay.camera.hysteresis.easing).toBeCloseTo(0.3, 6)
            expect(globalThis.lgs.stores.replay.camera.hysteresis.marginRatio).toBeCloseTo(0.2, 6)
            expect(globalThis.lgs.stores.replay.camera.hysteresis.easing).toBeCloseTo(0.3, 6)
        })
    })

    it('toggles hiding other journeys from the drawer', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const hideOtherJourneysSwitch = view.getByLabelText('Hide other journeys')

        expect(hideOtherJourneysSwitch.checked).toBe(false)

        fireEvent.click(hideOtherJourneysSwitch)

        await waitFor(() => {
            expect(globalThis.lgs.stores.replay.hideOtherJourneys).toBe(true)
            expect(__.ui.replay.setHideOtherJourneys).toHaveBeenCalledWith(true)
            expect(globalThis.lgs.settings.ui.replay.hideOtherJourneys).toBe(true)
        })
    })

    it('shows the total video duration above the tabs', () => {
        const replay = globalThis.lgs.settings.ui.replay
        replay.duration = 60
        replay.clips = {
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
        currentJourney.replay = {
            start: [
                createJourneyReplayClipInstance(replay.clips.catalog['take-off'], 'start', {
                    params: {duration: 2},
                }),
            ],
            stop: [
                createJourneyReplayClipInstance(replay.clips.catalog.landing, 'stop', {
                    params: {duration: 3},
                }),
            ],
        }

        const view = render(<JourneyReplayDrawer/>)

        expect(view.getByText('Total duration (s)')).toBeTruthy()
        expect(view.getByText('65')).toBeTruthy()
    })

    it('loads nearby poi candidates when the POIs tab opens', async () => {
        const view = render(<JourneyReplayDrawer/>)

        expect(__.ui.poiManager.getJourneyReplayPOIsForJourney).not.toHaveBeenCalled()
        fireEvent.click(view.getByText('POIs'))

        await waitFor(() => {
            expect(__.ui.poiManager.getJourneyReplayPOIsForJourney).toHaveBeenCalledWith(
                globalThis.lgs.stores.main.theJourney,
                globalThis.lgs.settings.ui.replay.poiDistance,
            )
            expect(globalThis.lgs.stores.replay.nearbyPois).toEqual([
                {poi: {id: 'poi-1'}, source: 'global-near-journey'},
            ])
        })
    })

    it('updates the nearby poi distance from the drawer', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const distanceInput = view.getByLabelText('Nearby POIs (m)')

        fireEvent.input(distanceInput, {target: {value: '2500'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.poiDistance).toBe(2500)
            expect(globalThis.lgs.stores.replay.poiDistance).toBe(2500)
        })
    })

    it('sorts POIs by replay distance in the POIs tab', async () => {
        const view = render(<JourneyReplayDrawer/>)

        globalThis.lgs.stores.main.components.pois.list.set('poi-2', {
            id: 'poi-2',
            title: 'POI Two',
            replay: {},
        })
        globalThis.lgs.stores.main.components.pois.list.set('poi-3', {
            id: 'poi-3',
            title: 'POI Three',
            replay: {},
        })
        globalThis.lgs.stores.replay.nearbyPois = [
            {poi: {id: 'poi-3'}, projectedAbscissa: 1200},
            {poi: {id: 'poi-1'}, projectedAbscissa: 200},
            {poi: {id: 'poi-2'}, projectedAbscissa: 800},
        ]

        fireEvent.click(view.getByText('POIs'))

        await waitFor(() => {
            const titles = view.getAllByText(/^POI /).map(node => node.textContent)
            expect(titles).toEqual(['POI One', 'POI Two', 'POI Three'])
        })
    })

    it('toggles global POI replay visibility and animation behavior', async () => {
        const view = render(<JourneyReplayDrawer/>)

        fireEvent.click(view.getByText('POIs'))

        await waitFor(() => {
            expect(view.getByLabelText('Hide all POIs during replay')).toBeTruthy()
            expect(view.getByLabelText('Animate all POIs during replay')).toBeTruthy()
        })

        fireEvent.click(view.getByLabelText('Hide all POIs during replay'))

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.hideAllPoisDuringJourneyReplay).toBe(true)
            expect(globalThis.lgs.stores.replay.hideAllPoisDuringJourneyReplay).toBe(true)
            expect(view.queryByLabelText('Animate all POIs during replay')).toBeNull()
            expect(view.getByLabelText('Show during replay').disabled).toBe(true)
            expect(view.queryByLabelText('Animate during replay')).toBeNull()
        })

        fireEvent.click(view.getByLabelText('Hide all POIs during replay'))

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.hideAllPoisDuringJourneyReplay).toBe(false)
            expect(globalThis.lgs.stores.replay.hideAllPoisDuringJourneyReplay).toBe(false)
            expect(view.getByLabelText('Animate all POIs during replay')).toBeTruthy()
            expect(view.getByLabelText('Show during replay').disabled).toBe(false)
        })

        fireEvent.click(view.getByLabelText('Animate all POIs during replay'))

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.animateAllPoisDuringJourneyReplay).toBe(true)
            expect(globalThis.lgs.stores.replay.animateAllPoisDuringJourneyReplay).toBe(true)
        })
    })

    it('exposes header shortcuts to toggle POI visibility and animation', async () => {
        const view = render(<JourneyReplayDrawer/>)

        fireEvent.click(view.getByText('POIs'))

        await waitFor(() => {
            expect(view.getByLabelText('Hide POI during replay')).toBeTruthy()
            expect(view.getByLabelText('Disable POI animation during replay')).toBeTruthy()
        })

        fireEvent.click(view.getByLabelText('Disable POI animation during replay'))

        await waitFor(() => {
            const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-1')
            expect(poi.replay.animated).toBe(false)
            expect(view.getByLabelText('Enable POI animation during replay')).toBeTruthy()
        })

        fireEvent.click(view.getByLabelText('Hide POI during replay'))

        await waitFor(() => {
            const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-1')
            expect(poi.replay.visible).toBe(false)
            expect(view.getByLabelText('Show POI during replay')).toBeTruthy()
        })
    })

    it('persists replay poi settings from the POIs tab and opens POI editor stacked', async () => {
        const view = render(<JourneyReplayDrawer/>)

        expect(view.getByText('POIs')).toBeTruthy()
        fireEvent.click(view.getByText('POIs'))

        await waitFor(() => {
            expect(view.getByText('POI One')).toBeTruthy()
        })

        const durationInput = view.getAllByLabelText('Duration (s)').at(-1)
        const showDuringJourneyReplay = view.getByLabelText('Show during replay')
        const hideCategory = view.getByLabelText('Hide category')
        const editButton = view.getByText('Edit POI')

        fireEvent.input(durationInput, {target: {value: '6'}})
        fireEvent.click(hideCategory)
        fireEvent.click(showDuringJourneyReplay)

        await waitFor(() => {
            const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-1')
            expect(poi.replay.displayDurationSeconds).toBe(6)
            expect(poi.replay.hiddenFields.category).toBe(true)
            expect(poi.replay.visible).toBe(false)
            expect(poi.replay.animated).toBe(true)
            expect(view.queryByLabelText('Animate during replay')).toBeNull()
            expect(view.queryByLabelText('Hide category')).toBeNull()
        })

        fireEvent.click(view.getByLabelText('Show during replay'))

        await waitFor(() => {
            const poi = globalThis.lgs.stores.main.components.pois.list.get('poi-1')
            expect(poi.replay.visible).toBe(true)
            expect(view.getByLabelText('Animate during replay')).toBeTruthy()
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

    it('marks the replay drawer as stacked when a previous drawer is in history', () => {
        __.ui.drawerManager.isStacked.mockReturnValue(true)

        const view = render(<JourneyReplayDrawer/>)
        const drawer = view.getByTestId('wa-drawer')
        const panelActions = view.getByTestId('panel-actions')

        expect(drawer.className).toContain('drawer-is-stacked')
        expect(panelActions.dataset.stacked).toBe('true')
        expect(panelActions.dataset.hasBack).toBe('true')
    })
})
