/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-drawer.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, fireEvent, render, waitFor }       from '@testing-library/react'
import { forwardRef, useState }                            from 'react'
import { REPLAY_DRAWER }                               from '@Core/constants'
import {
    defaultJourneyReplaySettings, REPLAY_CAMERA_PRESET_ULTRA_SMOOTH, REPLAY_MARKER_MODE_HYSTERESIS,
    REPLAY_EFFECT_GLOW, REPLAY_EFFECT_NONE, REPLAY_EFFECT_NEON,
    REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE, REPLAY_READINESS_POLICY_ADAPTIVE,
    ensureJourneyReplaySettings, toGlobalReplayCameraSettings,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { createJourneyReplayClipInstance }                          from '@Core/ui/replay/JourneyReplayClips'
import { JourneyReplayDrawer }                                from '@Components/JourneyReplay/JourneyReplayDrawer'
import { JourneyReplayCameraAngleGuide } from '@Components/JourneyReplay/JourneyReplayCameraAngleGuide'
import { ELEVATION_UNITS, UnitUtils }                      from '@Utils/UnitUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                                           from 'valtio'
import { proxyMap }                                        from 'valtio/utils'

const cameraGuideHarness = vi.hoisted(() => ({
    mount: vi.fn(() => true),
    remove: vi.fn(),
    resolve: vi.fn(({camera}) => ({
        angleDegrees: camera.cameraAngle ?? 180,
        anchor: {height: 0, latitude: 48, longitude: 2},
        coneHeading: (camera.cameraAngle ?? 180) * Math.PI / 180,
    })),
    changeEvent: 'lgs:replay:camera-angle-guide-change',
    update: vi.fn(() => true),
}))

vi.mock('@Core/ui/replay/JourneyReplayCameraAngleGuide', () => ({
    REPLAY_CAMERA_ANGLE_GUIDE_CHANGE_EVENT: cameraGuideHarness.changeEvent,
    mountJourneyReplayCameraAngleGuide: cameraGuideHarness.mount,
    removeJourneyReplayCameraAngleGuide: cameraGuideHarness.remove,
    resolveJourneyReplayCameraAngleGuide: cameraGuideHarness.resolve,
    updateJourneyReplayCameraAngleGuide: cameraGuideHarness.update,
}))

vi.mock('@Components/DrawerFooter', () => ({
    default: () => <div data-testid="drawer-footer"/>,
}))

vi.mock('@Components/JourneyReplay/JourneyReplayProgressBar', () => ({
    JourneyReplayProgressBar: () => <div data-testid="replay-progress"/>,
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <div>{children}</div>,
}))

vi.mock('@Components/PopupAnchor', () => ({
    PopupAnchor: ({id}) => <hr id={id}/>,
}))

vi.mock('@Components/PopupDrawer', () => ({
    PopupDrawer: ({active, anchor, children, header, headerActions, className, popupProps}) => active ? (
        <div
            data-testid="replay-advanced-camera-popup"
            data-anchor={anchor}
            data-placement={popupProps?.placement}
            className={className}
        >
            {header}
            {headerActions}
            {children}
        </div>
    ) : null,
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
    const WaBadge = ({children, ...props}) => <span {...props}>{children}</span>
    const WaButton = ({children, ...props}) => <button {...props}>{children}</button>
    const WaCard = ({children, ...props}) => <div {...props}>{children}</div>
    const WaColorPicker = props => <input data-testid={props['aria-label'] ?? 'color'} {...props} />
    const WaDivider = () => <hr/>
    const WaIcon = ({name, ...props}) => <span data-icon={name} {...props}/>
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
    const WaSlider = forwardRef(({label, onInput, value, ...props}, ref) => (
        <label>
            {label}
            <input ref={ref} type="range" aria-label={label} value={value} onInput={onInput} {...props}/>
        </label>
    ))
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
        WaBadge,
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
        const replay = proxy({...defaultJourneyReplaySettings(), userMode: 'expert'})
        replay.marker.mode = REPLAY_MARKER_MODE_NAVIGATION
        const runtimeCamera = {...replay.camera}
        replay.camera = toGlobalReplayCameraSettings(runtimeCamera)
        const journey = proxy({
            slug: 'journey-a',
            replay: {expert: {camera: runtimeCamera}},
        })
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
                    video: proxy({}),
                }),
                main: proxy({
                    theJourney: journey,
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                }),
                replay: proxy({
                    ...replay,
                    camera: proxy({...runtimeCamera}),
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
        globalThis.lgs.theJourney = journey
        ensureJourneyReplaySettings()

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
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
        globalThis.lgs = undefined
        globalThis.__ = undefined
        vi.unstubAllGlobals()
    })

    it('keeps the prepared Simple camera when recording changes the runtime duration', async () => {
        lgs.settings.ui.replay.userMode = 'basic'
        lgs.stores.main.theJourney.replay = {simple: {camera: {
            ...defaultJourneyReplaySettings().camera, altitude: 539, pitch: -5,
        }}}
        const view = render(<JourneyReplayDrawer/>)
        await act(async () => {
            lgs.stores.replay.simplePreparationActive = true
            lgs.stores.replay.camera = {...lgs.stores.replay.camera, altitude: 2630, pitch: -23}
            lgs.stores.ui.video.preRecording = true
            lgs.stores.replay.duration += 1
        })

        expect(lgs.stores.replay.camera).toMatchObject({altitude: 2630, pitch: -23})
        expect(view.getByLabelText('Pitch (deg)').value).toBe('-23')
    })

    it('keeps the prepared height and pitch when only the Simple cone angle changes', async () => {
        lgs.settings.ui.replay.userMode = 'basic'
        lgs.stores.main.theJourney.replay = {simple: {camera: {
            ...defaultJourneyReplaySettings().camera, altitude: 539, pitch: -5,
        }}}
        lgs.stores.replay.simplePreparationActive = true
        lgs.stores.replay.camera = {...lgs.stores.replay.camera, altitude: 2630, pitch: -23}
        lgs.stores.ui.video.editing = true
        render(<JourneyReplayCameraAngleGuide/>)
        await act(async () => {
            cameraGuideHarness.mount.mock.calls.at(-1)[3].onCameraChange({cameraAngle: -113})
        })

        expect(lgs.stores.replay.camera).toMatchObject({altitude: 2630, pitch: -23, cameraAngle: -113})
        expect(lgs.stores.main.theJourney.replay.simple.camera).toMatchObject({altitude: 2630, pitch: -23, cameraAngle: -113})
    })

    it('keeps the drawer limited to Replay configuration', () => {
        const view = render(<JourneyReplayDrawer/>)

        expect(document.body.querySelector('.replay-drawer-title [data-icon="sliders"]')).not.toBeNull()
        expect(view.queryByTestId('replay-progress')).toBeNull()
        expect(view.queryByText('Sync with Video')).toBeNull()
        expect(view.queryByRole('button', {name: 'Start Journey Replay'})).toBeNull()
        expect(view.queryByRole('button', {name: 'Pause Journey Replay'})).toBeNull()
        expect(view.queryByRole('button', {name: 'Reset Expert Replay from Simple Replay'})).toBeNull()
    })

    it('keeps normal Cesium rotation independent while editing the prepared pitch', async () => {
        globalThis.lgs.stores.ui.mainUI = proxy({rotate: {running: true}})
        const view = render(<JourneyReplayDrawer/>)
        const pitchInput = view.getByLabelText('Pitch (deg)')
        fireEvent.focus(pitchInput)
        fireEvent.input(pitchInput, {target: {value: '-38'}})
        await waitFor(() => expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.pitch).toBe(-38))
        expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('pitch')
        expect(globalThis.__.ui.cameraManager.stopRotate).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.ui.mainUI.rotate.running).toBe(true)
    })

    it('commits pitch edits while typing', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const pitchInput = view.getByLabelText('Pitch (deg)')

        fireEvent.focus(pitchInput)
        fireEvent.input(pitchInput, {target: {value: '-20'}})

        expect(pitchInput.value).toBe('-20')

        await waitFor(() => {
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.pitch).toBe(-20)
            expect(globalThis.lgs.stores.replay.camera.pitch).toBe(-20)
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('pitch')
        })

        fireEvent.blur(pitchInput)

        await waitFor(() => {
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.pitch).toBe(-20)
            expect(globalThis.lgs.stores.replay.camera.pitch).toBe(-20)
        })
    })

    it('writes Expert camera preparation edits back to the current journey', async () => {
        const camera = {
            ...defaultJourneyReplaySettings().camera,
        }
        const journey = {
            slug: 'journey-a',
            replay: {expert: {camera}},
            persistToDatabase: vi.fn(),
        }
        globalThis.lgs.theJourney = journey
        globalThis.lgs.stores.main.theJourney = journey
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        globalThis.lgs.settings.ui.replay.camera = toGlobalReplayCameraSettings(camera)
        globalThis.lgs.stores.replay.camera = proxy({...camera})

        const view = render(<JourneyReplayDrawer/>)
        const pitchInput = view.getByLabelText('Pitch (deg)')
        fireEvent.focus(pitchInput)
        fireEvent.input(pitchInput, {target: {value: '-38'}})

        await waitFor(() => {
            expect(globalThis.lgs.theJourney.replay.expert.camera.pitch).toBe(-38)
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('pitch')
            expect(globalThis.lgs.stores.replay.camera.pitch).toBe(-38)
        })
    })

    it('exposes the shared replay effect controls in the Style tab', async () => {
        const view = render(<JourneyReplayDrawer/>)

        fireEvent.click(view.getByText('Style'))

        const effectSelect = view.getByLabelText('Effect')
        const effectPreview = view.getByTestId('replay-effect-preview')

        expect(effectPreview).toBeTruthy()
        expect(effectPreview.dataset.previewFillWidth).toBe('2')
        expect(effectPreview.dataset.previewBorderWidth).toBe('0.75')
        expect(effectPreview.style.getPropertyValue('--replay-effect-preview-route-core-width')).toBe('0.24rem')
        expect(effectPreview.style.getPropertyValue('--replay-effect-preview-route-inner-width')).toBe('0.36rem')
        expect(effectPreview.style.getPropertyValue('--replay-effect-preview-marker-size')).toBe('0.94rem')
        expect(effectPreview.querySelector('.replay-effect-preview-route-border')).toBeTruthy()
        expect(effectPreview.querySelector('.replay-effect-preview-route-inner')).toBeTruthy()
        expect(effectPreview.querySelector('.replay-effect-preview-route-core')).toBeTruthy()
        expect(effectPreview.querySelector('.replay-effect-preview-route-core').getAttribute('d')).toBe('M -10 40 H 170')
        expect(effectPreview.querySelector('.replay-effect-preview-marker-outer')).toBeTruthy()
        expect(effectPreview.querySelector('.replay-effect-preview-marker-inner')).toBeTruthy()
        expect([...effectSelect.options].map(option => option.value)).toEqual([
            REPLAY_EFFECT_NONE,
            REPLAY_EFFECT_GLOW,
            REPLAY_EFFECT_NEON,
        ])
        expect(effectSelect.value).toBe(REPLAY_EFFECT_NONE)

        fireEvent.change(effectSelect, {target: {value: REPLAY_EFFECT_NEON}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.progression.effect).toEqual({
                mode: REPLAY_EFFECT_NEON,
            })
            expect(globalThis.lgs.stores.replay.progression.effect).toEqual({
                mode: REPLAY_EFFECT_NEON,
            })
        })

        fireEvent.change(effectSelect, {target: {value: REPLAY_EFFECT_NONE}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.progression.effect).toEqual({
                mode: REPLAY_EFFECT_NONE,
            })
        })
    })

    it('does not restore Journey camera pose in global Simple settings when saving presentation style', async () => {
        lgs.settings.ui.replay.userMode = 'basic'
        lgs.stores.replay.userMode = 'basic'
        lgs.stores.main.theJourney.replay = {}
        lgs.settings.ui.replay.simple = {
            camera: {altitude: 3454, pitch: -30, cameraAngle: 82},
        }

        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByText('Style'))
        fireEvent.change(view.getByLabelText('Effect'), {target: {value: REPLAY_EFFECT_NEON}})

        await waitFor(() => {
            expect(lgs.settings.ui.replay.simple.camera).not.toHaveProperty('altitude')
            expect(lgs.settings.ui.replay.simple.camera).not.toHaveProperty('pitch')
            expect(lgs.settings.ui.replay.simple.camera.cameraAngle).toBe(0)
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
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(900)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(900)
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.settings.ui.replay.camera.groundOffset).toBeUndefined()
            expect(globalThis.lgs.stores.replay.camera.groundOffset).toBeUndefined()
            expect(view.getByLabelText('Ground offset (m)')).toBeTruthy()
        })
    })

    it('converts the prepared altitude without borrowing normal Cesium height', async () => {
        lgs.settings.ui.replay.userMode = 'basic'
        const preparedCamera = {...defaultJourneyReplaySettings().camera, altitude: 2630, pitch: -23}
        lgs.settings.ui.replay.simple = {
            camera: toGlobalReplayCameraSettings(preparedCamera),
        }
        lgs.stores.main.theJourney.replay.simple = {camera: preparedCamera}
        lgs.stores.replay.simplePreparationActive = true
        lgs.stores.replay.camera = {...preparedCamera}
        lgs.stores.replay.sample = {longitude: 2, latitude: 48}
        lgs.viewer.camera = {positionCartographic: {height: 1300}, pitch: -0.1}
        const view = render(<JourneyReplayDrawer/>)

        fireEvent.change(view.getByLabelText('Camera altitude'), {target: {value: 'ground-offset'}})
        await waitFor(() => expect(lgs.stores.replay.camera).toMatchObject({altitude: 2330, pitch: -23, altitudeMode: 'ground-offset'}))
        expect(lgs.stores.main.theJourney.replay.simple.camera).toMatchObject({altitude: 2330, pitch: -23, altitudeMode: 'ground-offset'})
        fireEvent.change(view.getByLabelText('Camera altitude'), {target: {value: 'constant'}})
        await waitFor(() => expect(lgs.stores.replay.camera).toMatchObject({altitude: 2630, pitch: -23, altitudeMode: 'constant'}))
        expect(lgs.viewer.camera.positionCartographic.height).toBe(1300)
    })

    it('keeps camera azimuth controls in Expert Replay only', () => {
        globalThis.lgs.settings.ui.replay.userMode = 'basic'
        globalThis.lgs.stores.replay.userMode = 'basic'
        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))

        expect(view.queryByLabelText('Camera position')).toBeNull()
        expect(view.queryByLabelText('Camera angle')).toBeNull()
        expect(view.queryByRole('heading', {name: 'Position', level: 4})).toBeNull()
        expect(view.getByRole('heading', {name: 'Framing', level: 4})).toBeTruthy()
    })

    it('shows the single camera angle field in Expert Replay', () => {
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        globalThis.lgs.stores.replay.marker.mode = REPLAY_MARKER_MODE_TRACE
        globalThis.lgs.settings.ui.replay.marker.mode = REPLAY_MARKER_MODE_TRACE
        globalThis.lgs.stores.replay.camera.cameraAngle = -165
        globalThis.lgs.stores.main.theJourney.replay.expert.camera.cameraAngle = -165

        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))

        expect(view.getByTestId('replay-advanced-camera-popup').getAttribute('data-anchor')).toBe(
            'replay-advanced-camera-popup-anchor',
        )
        expect(view.getByTestId('replay-advanced-camera-popup').getAttribute('data-placement')).toBe('bottom')
        const setupButton = view.getByTestId('panel-actions').querySelector('button')
        expect(setupButton).toBeTruthy()
        const setupIcon = setupButton.querySelector('[data-icon="camera-sliders"]')
        expect(setupIcon).toBeTruthy()
        expect(view.queryByLabelText('Camera position')).toBeNull()
        expect(view.getByLabelText('Camera angle')).toBeTruthy()
        expect(view.getByLabelText('Camera angle').value).toBe('-165')
        expect(view.getByText('0° along trace · +90° right · −90° left · ±180° opposite')).toBeTruthy()
        expect(view.getByLabelText('Camera altitude')).toBeTruthy()
        expect(view.getByLabelText('Altitude (m)')).toBeTruthy()
        expect(view.getByLabelText('Pitch (deg)')).toBeTruthy()
        expect(view.queryByLabelText('Heading (deg)')).toBeNull()
        expect(view.getByLabelText('Camera feel')).toBeTruthy()
        expect(view.getByLabelText('Wait for visible tiles')).toBeTruthy()
        expect(view.getByLabelText('Readiness policy')).toBeTruthy()
        expect(view.getByLabelText('Camera tile preloading')).toBeTruthy()
        expect(view.getByRole('heading', {name: 'Position', level: 4})).toBeTruthy()
        expect(view.getByRole('heading', {name: 'Framing', level: 4})).toBeTruthy()
        expect(view.getByRole('heading', {name: 'Motion', level: 4})).toBeTruthy()
        expect(view.getByRole('heading', {name: 'Recenter', level: 4})).toBeTruthy()
        expect(view.getByRole('heading', {name: 'Diagnostics', level: 4})).toBeTruthy()

        fireEvent.click(view.getByTestId('panel-actions').querySelector('button'))
        expect(view.queryByTestId('replay-advanced-camera-popup')).toBeNull()
    })

    it('persists readiness and camera preloading controls', async () => {
        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))
        const readinessSwitch = view.getByLabelText('Wait for visible tiles')
        const readinessPolicy = view.getByLabelText('Readiness policy')
        const tilePreloading = view.getByLabelText('Camera tile preloading')
        expect(readinessPolicy.value).toBe(REPLAY_READINESS_POLICY_ADAPTIVE)
        expect(tilePreloading.value).toBe(String(defaultJourneyReplaySettings().camera.playback.tilePreloadHorizonMs))

        fireEvent.click(readinessSwitch)
        await waitFor(() => {
            expect(view.queryByLabelText('Readiness policy')).toBeNull()
            expect(view.queryByLabelText('Camera tile preloading')).toBeNull()
        })

        fireEvent.click(readinessSwitch)
        await waitFor(() => {
            expect(view.getByLabelText('Readiness policy')).toBeTruthy()
            expect(view.getByLabelText('Camera tile preloading')).toBeTruthy()
        })
        fireEvent.change(view.getByLabelText('Readiness policy'), {target: {value: 'strict'}})
        fireEvent.change(view.getByLabelText('Camera tile preloading'), {target: {value: '2000'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.readiness.enabled).toBe(true)
            expect(globalThis.lgs.settings.ui.replay.readiness.policy).toBe('strict')
            expect(globalThis.lgs.stores.replay.readiness.policy).toBe('strict')
            expect(globalThis.lgs.settings.ui.replay.camera.playback.tilePreloadHorizonMs).toBe(2000)
            expect(globalThis.lgs.stores.replay.camera.playback.tilePreloadHorizonMs).toBe(2000)
            expect(view.getByLabelText('Readiness policy').value).toBe('strict')
            expect(view.getByLabelText('Camera tile preloading').value).toBe('2000')
        })
    })

    it('styles custom readiness wait fields with hints', async () => {
        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))

        fireEvent.change(view.getByLabelText('Readiness policy'), {target: {value: 'custom'}})

        await waitFor(() => {
            const movingWait = view.getByLabelText('Moving wait (ms)')
            const settledWait = view.getByLabelText('Settled wait (ms)')
            const waitFields = movingWait.closest('.replay-style-field-grid')

            expect(movingWait.className).toContain('half-width')
            expect(movingWait.getAttribute('hint')).toBe('Maximum tile wait while the camera is moving.')
            expect(settledWait.className).toContain('half-width')
            expect(settledWait.getAttribute('hint')).toBe('Maximum tile wait after the camera settles.')
            expect(waitFields.className).toContain('is-single')
        })
    })

    it('turns the master switch off when both tile features are off and restores defaults when re-enabled', async () => {
        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))
        const readinessSwitch = view.getByLabelText('Wait for visible tiles')

        fireEvent.change(view.getByLabelText('Readiness policy'), {target: {value: 'off'}})
        fireEvent.change(view.getByLabelText('Camera tile preloading'), {target: {value: '0'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.readiness.enabled).toBe(false)
            expect(readinessSwitch.checked).toBe(false)
        })

        fireEvent.click(readinessSwitch)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.readiness.enabled).toBe(true)
            expect(globalThis.lgs.settings.ui.replay.readiness.policy).toBe(REPLAY_READINESS_POLICY_ADAPTIVE)
            expect(globalThis.lgs.settings.ui.replay.camera.playback.tilePreloadHorizonMs).toBe(1000)
            expect(view.getByLabelText('Readiness policy').value).toBe(REPLAY_READINESS_POLICY_ADAPTIVE)
            expect(view.getByLabelText('Camera tile preloading').value).toBe(String(
                defaultJourneyReplaySettings().camera.playback.tilePreloadHorizonMs,
            ))
        })
    })

    it('shows and persists capability-specific camera sensitivities', async () => {
        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))
        const popup = view.getByTestId('replay-advanced-camera-popup')

        expect(popup.querySelectorAll('.replay-camera-sensitivity-slider')).toHaveLength(3)
        expect(view.getByText('Add drift')).toBeTruthy()
        expect(view.getByText('Add roll')).toBeTruthy()
        expect(view.getByText('Add hidden marker correction')).toBeTruthy()

        const sensitivityInputs = popup.querySelectorAll('.replay-camera-sensitivity-slider')
        fireEvent.input(sensitivityInputs[2], {target: {value: '0.25'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.rollSensitivity).toBe(0.25)
            expect(globalThis.lgs.stores.replay.camera.rollSensitivity).toBe(0.25)
        })

        for (const label of ['Add drift', 'Add roll', 'Add hidden marker correction']) {
            fireEvent.click(view.getByLabelText(label))
            await waitFor(() => {
                expect(view.getByLabelText(label).checked).toBe(false)
            })
        }

        expect(popup.querySelectorAll('.replay-camera-sensitivity-slider')).toHaveLength(0)
    })

    it('shows the debug camera switch as a Replay setting and keeps it disabled by default', async () => {
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))

        const debugSwitch = await view.findByLabelText('Debug camera')
        expect(debugSwitch.checked).toBe(false)

        fireEvent.click(debugSwitch)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.debug).toBe(true)
            expect(globalThis.lgs.stores.replay.camera.debug).toBe(true)
        })
    })

    it('hides camera diagnostics in Simple Replay even when they are persisted as enabled', async () => {
        globalThis.lgs.settings.ui.replay.simple = {camera: {...defaultJourneyReplaySettings().camera, debug: true}}
        globalThis.lgs.settings.ui.replay.userMode = 'basic'
        globalThis.lgs.stores.replay.userMode = 'basic'
        globalThis.lgs.stores.replay.camera.debug = true
        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))

        expect(view.queryByLabelText('Debug camera')).toBeNull()
        expect(view.queryByRole('heading', {name: 'Diagnostics', level: 4})).toBeNull()
    })

    it('applies the camera angle slider without mutating the Cesium scene', async () => {
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        globalThis.lgs.stores.replay.camera.cameraAngle = 180
        globalThis.lgs.stores.main.theJourney.replay.expert.camera.cameraAngle = 180
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
        expect(globalThis.lgs.viewer.entities.getById('journey-start').show).toBe(true)
        expect(globalThis.lgs.viewer.entities.getById('journey-stop').show).toBe(true)
        globalThis.__.ui.replay.refreshCamera.mockClear()
        fireEvent.input(angleInput, {target: {value: '20'}})
        fireEvent.input(angleInput, {target: {value: '40'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(0)
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.cameraAngle).toBe(40)
            expect(globalThis.lgs.stores.replay.camera.cameraAngle).toBe(40)
        })
        expect(globalThis.__.ui.replay.refreshCamera).toHaveBeenCalledTimes(2)

        expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 5000)

        fireEvent.blur(angleInput)
        expect(globalThis.lgs.viewer.entities.getById('journey-start').show).toBe(true)
        expect(globalThis.lgs.viewer.entities.getById('journey-stop').show).toBe(true)
        setTimeoutSpy.mockRestore()
    })

    it('synchronizes the preparation camera sliders and map guide in both directions without moving Cesium', async () => {
        const camera = {
            ...defaultJourneyReplaySettings().camera,
            cameraAngle: 180,
        }
        const journey = proxy({
            replay: {expert: {camera}},
            slug: 'journey-a',
        })
        globalThis.lgs.theJourney = journey
        globalThis.lgs.stores.main.theJourney = journey
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        globalThis.lgs.settings.ui.replay.camera = proxy(toGlobalReplayCameraSettings(camera))
        globalThis.lgs.stores.replay.userMode = 'expert'
        globalThis.lgs.stores.replay.camera = proxy({...camera})
        globalThis.lgs.stores.ui.video.editing = true

        const view = render(
            <>
                <JourneyReplayDrawer/>
                <JourneyReplayCameraAngleGuide/>
            </>,
        )
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))

        const angleSlider = view.getByLabelText('Camera angle')
        await waitFor(() => expect(cameraGuideHarness.mount).toHaveBeenCalled())
        expect(cameraGuideHarness.mount.mock.calls.at(-1)[3].screenLocked).toBe(true)
        globalThis.__.ui.replay.refreshCamera.mockClear()
        globalThis.__.ui.replay.refresh.mockClear()
        globalThis.lgs.stores.replay.cameraUpdateSource = null

        fireEvent.input(angleSlider, {target: {value: '35'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(0)
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.cameraAngle).toBe(35)
            expect(cameraGuideHarness.update).toHaveBeenLastCalledWith(
                expect.anything(),
                expect.objectContaining({angleDegrees: 35, coneHeading: (35 * Math.PI) / 180}),
                expect.objectContaining({onCameraChange: expect.any(Function)}),
            )
        })
        expect(angleSlider.value).toBe('35')
        expect(globalThis.__.ui.replay.refreshCamera).not.toHaveBeenCalled()
        expect(globalThis.__.ui.replay.refresh).toHaveBeenLastCalledWith({camera: false})
        expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBe(null)
        expect(globalThis.__.ui.replay.refreshCamera).not.toHaveBeenCalled()

        act(() => {
            cameraGuideHarness.mount.mock.calls.at(-1)[3].onCameraChange({cameraAngle: -25})
        })

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(0)
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.cameraAngle).toBe(-25)
            expect(view.getByLabelText('Camera angle').value).toBe('-25')
            expect(document.activeElement).toBe(view.getByLabelText('Camera angle'))
        })
        expect(globalThis.lgs.stores.replay.camera.cameraAngle).toBe(-25)

        act(() => {
            globalThis.lgs.stores.replay.recordingSync = true
            globalThis.lgs.stores.replay.active = true
        })
        await waitFor(() => expect(cameraGuideHarness.remove).toHaveBeenCalled())
        globalThis.__.ui.replay.refreshCamera.mockClear()
        globalThis.lgs.stores.replay.cameraUpdateSource = null
        fireEvent.input(angleSlider, {target: {value: '15'}})

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(0)
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.cameraAngle).toBe(15)
            expect(globalThis.__.ui.replay.refreshCamera).toHaveBeenCalledTimes(1)
        })
        expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBe('drawer')
    })

    it('keeps the advanced camera setup closed and focuses the range after a map-guide change', async () => {
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        globalThis.lgs.stores.replay.userMode = 'expert'
        globalThis.lgs.stores.main.theJourney.replay.expert.camera.cameraAngle = 180
        globalThis.lgs.stores.replay.camera.cameraAngle = 180
        globalThis.lgs.stores.ui.video.editing = true

        const view = render(
            <>
                <JourneyReplayDrawer/>
                <JourneyReplayCameraAngleGuide/>
            </>,
        )

        await waitFor(() => expect(cameraGuideHarness.mount).toHaveBeenCalled())

        act(() => {
            cameraGuideHarness.mount.mock.calls.at(-1)[3].onCameraChange({cameraAngle: -25})
        })

        await waitFor(() => {
            const angleSlider = view.getByLabelText('Camera angle')
            expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(0)
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.cameraAngle).toBe(-25)
            expect(globalThis.lgs.stores.replay.camera.cameraAngle).toBe(-25)
            expect(angleSlider.value).toBe('-25')
            expect(document.activeElement).toBe(angleSlider)
        })
        expect(view.queryByTestId('replay-advanced-camera-popup')).toBeNull()
    })

    it('shows the ground offset label when the camera mode is ground offset', () => {
        globalThis.lgs.stores.replay.camera.altitudeMode = 'ground-offset'
        globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitudeMode = 'ground-offset'
        globalThis.lgs.settings.ui.replay.camera.altitudeMode = 'ground-offset'

        const view = render(<JourneyReplayDrawer/>)

        expect(view.getByLabelText('Camera altitude')).toBeTruthy()
        expect(view.getByLabelText('Ground offset (m)')).toBeTruthy()
    })

    it('shows badges on clips and POIs tabs when replay data is available', () => {
        globalThis.lgs.settings.ui.replay.clips = {
            catalog: {
                'take-off': {id: 'take-off', slots: ['start']},
                landing:    {id: 'landing', slots: ['stop']},
            },
            start: [
                {
                    ...createJourneyReplayClipInstance({id: 'take-off', slots: ['start']}, 'start'),
                    enabled: false,
                },
            ],
            stop: [
                createJourneyReplayClipInstance({id: 'landing', slots: ['stop']}, 'stop'),
            ],
        }
        globalThis.lgs.stores.main.theJourney.replay = {
            start: [...globalThis.lgs.settings.ui.replay.clips.start],
            stop:  [...globalThis.lgs.settings.ui.replay.clips.stop],
        }
        globalThis.lgs.stores.replay.clips = globalThis.lgs.settings.ui.replay.clips

        const view = render(<JourneyReplayDrawer/>)

        expect(view.getByLabelText('2 selected clips')).toBeTruthy()
        expect(view.getByLabelText('1 visible or animated POI')).toBeTruthy()
    })

    it('restores altitude on blur when the draft is emptied', async () => {
        globalThis.lgs.settings.unitSystem.current = 1
        globalThis.lgs.stores.replay.camera.altitude = 1000
        globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude = 1000

        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (ft)')

        expect(Number(altitudeInput.value)).toBe(Math.round(UnitUtils.convert(1000).to(ELEVATION_UNITS[1])))

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: ''}})

        expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
        expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1000)
        expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1000)
        expect(altitudeInput.value).toBe('')

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1000)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1000)
            expect(altitudeInput.value).toBe(String(Math.round(UnitUtils.convert(1000).to(ELEVATION_UNITS[1]))))
        })
    })

    it('commits valid altitude edits before blur and retains them on blur', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '1500'}})

        expect(altitudeInput.value).toBe('1500')
        expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
        expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1500)
        expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1500)

        fireEvent.blur(altitudeInput)
        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1500)
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
        expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
        expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1200)

        fireEvent.input(altitudeInput, {target: {value: '10'}})
        expect(altitudeInput.value).toBe('10')
        expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(10)

        fireEvent.input(altitudeInput, {target: {value: '100'}})
        expect(altitudeInput.value).toBe('100')
        expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(100)

        fireEvent.input(altitudeInput, {target: {value: '1000'}})
        expect(altitudeInput.value).toBe('1000')
        expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1000)

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1000)
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
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1500)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1500)
        })

        expect(globalThis.__.ui.replay.refresh).toHaveBeenLastCalledWith({camera: false})
        expect(globalThis.__.ui.replay.refreshCamera).not.toHaveBeenCalled()
    })

    it('keeps a ground offset change stable even when change fires before focus', async () => {
        globalThis.lgs.stores.replay.camera.altitudeMode = 'ground-offset'
        globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitudeMode = 'ground-offset'
        globalThis.lgs.settings.ui.replay.camera.altitudeMode = 'ground-offset'

        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Ground offset (m)')

        fireEvent.change(altitudeInput, {target: {value: '1000'}})

        expect(altitudeInput.value).toBe('1000')
        expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBe('drawer')

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1000)
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

    it('does not expose a second absolute heading control', async () => {
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        globalThis.lgs.stores.replay.userMode = 'expert'
        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))
        expect(view.queryByLabelText('Heading (deg)')).toBeNull()
        expect(view.getByLabelText('Camera angle')).toBeTruthy()
    })

    it('does not commit altitude values below the minimum while typing', async () => {
        const view = render(<JourneyReplayDrawer/>)
        const altitudeInput = view.getByLabelText('Altitude (m)')

        fireEvent.focus(altitudeInput)
        fireEvent.input(altitudeInput, {target: {value: '9'}})

        expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
        expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1200)
        expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1200)
        expect(altitudeInput.value).toBe('9')

        fireEvent.blur(altitudeInput)

        await waitFor(() => {
            expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('altitude')
            expect(globalThis.lgs.stores.main.theJourney.replay.expert.camera.altitude).toBe(1200)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1200)
        })
    })

    it('applies the ultra smooth camera preset from the drawer', async () => {
        globalThis.lgs.stores.replay.marker.mode = REPLAY_MARKER_MODE_HYSTERESIS
        globalThis.lgs.settings.ui.replay.marker.mode = REPLAY_MARKER_MODE_HYSTERESIS

        const view = render(<JourneyReplayDrawer/>)
        fireEvent.click(view.getByRole('button', {name: 'Advanced camera setup'}))
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
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        globalThis.lgs.stores.replay.userMode = 'expert'
        const view = render(<JourneyReplayDrawer/>)
        const hideOtherJourneysSwitch = view.getByLabelText('Hide other journeys')

        expect(hideOtherJourneysSwitch.checked).toBe(true)

        fireEvent.click(hideOtherJourneysSwitch)

        await waitFor(() => {
            expect(globalThis.lgs.stores.replay.hideOtherJourneys).toBe(false)
            expect(__.ui.replay.setHideOtherJourneys).toHaveBeenCalledWith(false)
            expect(globalThis.lgs.settings.ui.replay.hideOtherJourneys).toBe(false)
            expect(hideOtherJourneysSwitch.checked).toBe(false)
        })
    })

    it('does not expose the other-journeys switch in Simple Replay', () => {
        globalThis.lgs.settings.ui.replay.userMode = 'basic'
        globalThis.lgs.stores.replay.userMode = 'basic'

        const view = render(<JourneyReplayDrawer/>)

        expect(view.queryByLabelText('Hide other journeys')).toBeNull()
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
