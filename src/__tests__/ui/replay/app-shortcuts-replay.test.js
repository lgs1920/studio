/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-shortcuts-replay.test.js
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

import { defaultJourneyReplaySettings, REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const SHORTCUTS_YAML = `
- action: Show journey toolbar
  description: Makes the journey toolbar available on the map.
  id: journey-toolbar-show
  keys:
    - Alt+Shift+J
  scope: App
- action: Toggle orbit
  description: Starts or stops map orbit around the current target.
  id: orbit-toggle
  keys:
    - Alt+Shift+O
  scope: App
- action: Open Replay settings
  description: Opens Replay settings for the selected Journey.
  id: replay-management-show
  keys:
    - Alt+Shift+R
  scope: App
`

describe('app replay shortcuts', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.stubGlobal('fetch', vi.fn(async () => ({
            text: async () => SHORTCUTS_YAML,
        })))
        globalThis.lgs = {
            settings: proxy({
                camera: {
                    heading: 0,
                    pitch:   0,
                    roll:    0,
                    range:   1000,
                },
                ui: {
                    replay: proxy({
                        ...defaultJourneyReplaySettings(),
                        marker: {
                            ...defaultJourneyReplaySettings().marker,
                            mode: REPLAY_MARKER_MODE_NAVIGATION,
                        },
                        journeyToolbar: {
                            show:  true,
                            usage: true,
                        },
                    }),
                    journeyToolbar: proxy({
                        show:  true,
                        usage: true,
                    }),
                },
            }),
            stores: {
                replay: proxy({
                    active:  true,
                    playing: false,
                    paused:  false,
                    marker:  {
                        mode: REPLAY_MARKER_MODE_NAVIGATION,
                    },
                }),
                main: proxy({
                    components: proxy({
                        camera: proxy({
                            target:  null,
                            position: {
                                heading: 0,
                                pitch:   0,
                                roll:    0,
                                range:   1000,
                            },
                        }),
                        pois:    proxy({
                            current: null,
                            list:    new Map(),
                        }),
                    }),
                }),
                ui: proxy({
                    mainUI: proxy({
                        callForActions: proxy({active: true}),
                        rotate: proxy({
                            running: false,
                            target:   null,
                        }),
                        panorama: proxy({
                            active: false,
                        }),
                    }),
                }),
            },
        }
        globalThis.__ = {
            ui: {
                poiManager: {
                    stopRotationAndSync: vi.fn(async () => undefined),
                },
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                    updatePositionInformation: vi.fn(async () => undefined),
                },
                sceneManager: {
                    target: {element: 'track', longitude: 2, latitude: 48, height: 120},
                    focus: vi.fn(async () => undefined),
                },
                drawerManager: {
                    open: vi.fn(),
                },
            },
        }
    })

    afterEach(() => {
        globalThis.lgs = undefined
        globalThis.__ = undefined
        vi.unstubAllGlobals()
    })

    it('keeps the journey toolbar shortcut disabled while replay is running', async () => {
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const callbacks = new Map()
        const shortcutManager = {
            addShortcut: vi.fn((target, keys, callback) => {
                callbacks.set(keys.join(','), callback)
                return vi.fn()
            }),
        }

        installAppShortcuts(shortcutManager)

        const callback = callbacks.get('Alt+Shift+J')
        expect(callback).toBeTypeOf('function')

        const event = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            stopImmediatePropagation: vi.fn(),
        }

        await callback(event)

        expect(globalThis.lgs.settings.ui.journeyToolbar.show).toBe(true)
        expect(globalThis.lgs.settings.ui.journeyToolbar.usage).toBe(true)
        expect(event.preventDefault).toHaveBeenCalled()
    })

    it('refuses to relaunch orbit outside Passive replay mode', async () => {
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const callbacks = new Map()
        const shortcutManager = {
            addShortcut: vi.fn((target, keys, callback) => {
                callbacks.set(keys.join(','), callback)
                return vi.fn()
            }),
        }

        installAppShortcuts(shortcutManager)

        const callback = callbacks.get('Alt+Shift+O')
        expect(callback).toBeTypeOf('function')

        const event = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            stopImmediatePropagation: vi.fn(),
        }

        await callback(event)

        expect(globalThis.__.ui.poiManager.stopRotationAndSync).not.toHaveBeenCalled()
        expect(globalThis.__.ui.sceneManager.focus).not.toHaveBeenCalled()

        globalThis.lgs.settings.ui.replay.marker.mode = REPLAY_MARKER_MODE_TRACE
        globalThis.lgs.stores.replay.marker.mode = REPLAY_MARKER_MODE_TRACE

        await callback(event)

        expect(globalThis.__.ui.sceneManager.focus).toHaveBeenCalled()
    })

    it('adjusts replay camera pitch and angle from arrows during Expert preparation', async () => {
        const canvas = document.createElement('canvas')
        document.body.appendChild(canvas)
        globalThis.lgs.viewer = {scene: {canvas}}
        globalThis.lgs.theJourney = {
            replay: {
                expert: {
                    camera: {...globalThis.lgs.settings.ui.replay.camera},
                },
            },
        }
        globalThis.lgs.settings.ui.replay.camera = {
            ...globalThis.lgs.settings.ui.replay.camera,
            cameraAngle: 10,
            pitch: -50,
        }
        globalThis.lgs.theJourney.replay.expert.camera = {
            ...globalThis.lgs.theJourney.replay.expert.camera,
            cameraAngle: 10,
            pitch: -50,
        }
        globalThis.lgs.settings.ui.replay.userMode = 'expert'
        globalThis.lgs.stores.replay.camera = globalThis.lgs.settings.ui.replay.camera
        globalThis.lgs.stores.ui.video = proxy({editing: true})
        globalThis.lgs.stores.ui.drawers = proxy({open: null})
        globalThis.lgs.stores.ui.widget = proxy({current: null})
        globalThis.__.ui.replay = {
            refreshCamera: vi.fn(),
        }
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const removers = installAppShortcuts({
            addShortcut: vi.fn(() => vi.fn()),
        })

        window.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'ArrowUp'}))
        await Promise.resolve()
        expect(globalThis.lgs.theJourney.replay.expert.camera.pitch).toBe(-49)
        expect(globalThis.lgs.theJourney.replay.expert.camera.cameraAngle).toBe(10)
        expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('pitch')
        expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(0)

        window.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'ArrowRight'}))
        await Promise.resolve()

        expect(globalThis.lgs.theJourney.replay.expert.camera.pitch).toBe(-49)
        expect(globalThis.lgs.theJourney.replay.expert.camera.cameraAngle).toBe(11)
        expect(globalThis.lgs.settings.ui.replay.camera).not.toHaveProperty('pitch')
        expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(0)
        expect(globalThis.__.ui.replay.refreshCamera).toHaveBeenCalledTimes(2)
        expect(globalThis.__.ui.replay.refreshCamera).toHaveBeenLastCalledWith(expect.objectContaining({
            preparation: true,
        }))
        expect(globalThis.lgs.stores.replay.cameraUpdateSource).toBe('keyboard')
        removers.forEach(remove => remove?.())
        canvas.remove()
    })

    it('does not adjust the Replay camera from arrows in Basic Replay', async () => {
        const canvas = document.createElement('canvas')
        document.body.appendChild(canvas)
        globalThis.lgs.viewer = {scene: {canvas}}
        globalThis.lgs.settings.ui.replay.camera = {
            ...globalThis.lgs.settings.ui.replay.camera,
            cameraAngle: 10,
            pitch: -50,
        }
        globalThis.lgs.stores.replay.camera = globalThis.lgs.settings.ui.replay.camera
        globalThis.lgs.stores.ui.video = proxy({editing: true})
        globalThis.lgs.stores.ui.drawers = proxy({open: null})
        globalThis.lgs.stores.ui.widget = proxy({current: null})
        globalThis.__.ui.replay = {
            refreshCamera: vi.fn(),
        }
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const removers = installAppShortcuts({
            addShortcut: vi.fn(() => vi.fn()),
        })

        window.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: 'ArrowRight'}))
        await Promise.resolve()

        expect(globalThis.lgs.settings.ui.replay.camera.cameraAngle).toBe(10)
        expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(-50)
        expect(globalThis.__.ui.replay.refreshCamera).not.toHaveBeenCalled()
        removers.forEach(remove => remove?.())
        canvas.remove()
    })

    it('does not open Replay from its shortcut without a selected Journey', async () => {
        globalThis.lgs.theJourney = null
        globalThis.lgs.stores.main.theJourney = null
        const callbacks = new Map()
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        installAppShortcuts({
            addShortcut: vi.fn((target, keys, callback) => {
                callbacks.set(keys.join(','), callback)
                return vi.fn()
            }),
        })

        await callbacks.get('Alt+Shift+R')({
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            stopImmediatePropagation: vi.fn(),
        })

        expect(globalThis.__.ui.drawerManager.open).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.ui.mainUI.callForActions.active).toBe(true)
    })
})
