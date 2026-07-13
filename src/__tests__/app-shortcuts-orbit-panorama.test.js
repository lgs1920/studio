/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-shortcuts-orbit-panorama.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-14
 * Last modified: 2026-06-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const SHORTCUTS_YAML = `
- action: Toggle orbit
  description: Starts or stops map orbit around the current target.
  id: orbit-toggle
  keys:
    - Alt+Shift+O
  scope: App
- action: Toggle Orbit widget
  description: Shows or hides the Orbit widget while Orbit is running.
  id: orbit-widget-toggle
  keys:
    - Alt+O
  scope: Orbit mode
- action: Toggle panorama
  description: Starts or stops panorama mode around the current target.
  id: panorama-toggle
  keys:
    - Alt+Shift+P
  scope: App
- action: Toggle Panorama widget
  description: Shows or hides the Panorama widget while Panorama is active.
  id: panorama-widget-toggle
  keys:
    - Alt+P
  scope: Panorama mode
`

const makeEvent = () => ({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
})

describe('app orbit and panorama shortcuts', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.stubGlobal('fetch', vi.fn(async () => ({
            text: async () => SHORTCUTS_YAML,
        })))

        globalThis.lgs = {
            settings: {
                camera: {
                    heading: 0,
                    pitch:   0,
                    range:   1000,
                    roll:    0,
                },
                scene: {
                    mode: {
                        value: '3d',
                    },
                },
                ui: {
                    replay: proxy({}),
                    journeyToolbar: proxy({
                        show:  true,
                        usage: true,
                    }),
                    menu: proxy({
                        toolBar: {
                            fromStart: false,
                        },
                    }),
                },
            },
            stores: {
                main: proxy({
                    components: proxy({
                        camera: proxy({
                            position: {
                                heading: 0,
                                pitch:   0,
                                range:   1000,
                                roll:    0,
                            },
                            target: null,
                        }),
                        pois: proxy({
                            current: null,
                            list:    new Map(),
                        }),
                    }),
                }),
                ui: proxy({
                    mainUI: proxy({
                        panorama: proxy({
                            active:  false,
                            target:  null,
                            visible: true,
                        }),
                        rotate: proxy({
                            direction: 1,
                            running:   false,
                            target:    null,
                            visible:   true,
                            rpm:       1,
                        }),
                    }),
                    drawers: proxy({
                        open: null,
                    }),
                    video: proxy({
                        editing: false,
                        recording: false,
                        preRecording: false,
                        snapshot: false,
                        finalizing: false,
                    }),
                    widget: proxy({
                        current: {id: null},
                        list:    new Map(),
                    }),
                }),
                replay: proxy({
                    active:  false,
                    playing: false,
                    paused:  false,
                }),
            },
        }

        globalThis.__ = {
            ui: {
                cameraManager: {
                    isRotating: vi.fn(() => false),
                    updatePositionInformation: vi.fn(async () => undefined),
                    stopRotate: vi.fn(async () => undefined),
                },
                poiManager: {
                    stopRotationAndSync: vi.fn(async () => undefined),
                    updatePOI: vi.fn(async () => undefined),
                },
                sceneManager: {
                    focus: vi.fn(async () => undefined),
                    target: {
                        element: 'map-point',
                        latitude: 48,
                        longitude: 2,
                        height: 120,
                    },
                },
            },
        }
    })

    afterEach(() => {
        globalThis.lgs = undefined
        globalThis.__ = undefined
        vi.unstubAllGlobals()
    })

    it('registers the updated launch shortcuts', async () => {
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const callbacks = new Map()
        const shortcutManager = {
            addShortcut: vi.fn((target, keys, callback) => {
                callbacks.set(keys.join(','), callback)
                return vi.fn()
            }),
        }

        installAppShortcuts(shortcutManager)

        expect(callbacks.has('Alt+Shift+O')).toBe(true)
        expect(callbacks.has('Alt+Shift+P')).toBe(true)
        expect(callbacks.has('Alt+O')).toBe(true)
        expect(callbacks.has('Alt+P')).toBe(true)
    })

    it('starts orbit with the launch shortcut and stops it when already running', async () => {
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

        const event = makeEvent()

        await callback(event)
        expect(globalThis.__.ui.sceneManager.focus).toHaveBeenCalled()
        expect(globalThis.__.ui.sceneManager.focus.mock.calls[0][1]).toMatchObject({
            flyingTime:   0,
            preserveView: true,
            rotate:       true,
        })

        globalThis.lgs.stores.ui.mainUI.rotate.running = true
        await callback(event)
        expect(globalThis.__.ui.poiManager.stopRotationAndSync).toHaveBeenCalled()
    })

    it('toggles orbit widget visibility only while orbit is running', async () => {
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const callbacks = new Map()
        const shortcutManager = {
            addShortcut: vi.fn((target, keys, callback) => {
                callbacks.set(keys.join(','), callback)
                return vi.fn()
            }),
        }

        installAppShortcuts(shortcutManager)

        const callback = callbacks.get('Alt+O')
        expect(callback).toBeTypeOf('function')

        const event = makeEvent()

        globalThis.lgs.stores.ui.mainUI.rotate.running = true
        globalThis.lgs.stores.ui.mainUI.rotate.visible = true

        await callback(event)
        expect(globalThis.lgs.stores.ui.mainUI.rotate.visible).toBe(false)

        await callback(event)
        expect(globalThis.lgs.stores.ui.mainUI.rotate.visible).toBe(true)

        globalThis.lgs.stores.ui.mainUI.rotate.running = false
        await callback(event)
        expect(globalThis.lgs.stores.ui.mainUI.rotate.visible).toBe(true)
    })

    it('toggles panorama widget visibility only while panorama is active', async () => {
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const callbacks = new Map()
        const shortcutManager = {
            addShortcut: vi.fn((target, keys, callback) => {
                callbacks.set(keys.join(','), callback)
                return vi.fn()
            }),
        }

        installAppShortcuts(shortcutManager)

        const callback = callbacks.get('Alt+P')
        expect(callback).toBeTypeOf('function')

        const event = makeEvent()

        globalThis.lgs.stores.ui.mainUI.panorama.active = true
        globalThis.lgs.stores.ui.mainUI.panorama.visible = true

        await callback(event)
        expect(globalThis.lgs.stores.ui.mainUI.panorama.visible).toBe(false)

        await callback(event)
        expect(globalThis.lgs.stores.ui.mainUI.panorama.visible).toBe(true)

        globalThis.lgs.stores.ui.mainUI.panorama.active = false
        await callback(event)
        expect(globalThis.lgs.stores.ui.mainUI.panorama.visible).toBe(true)
    })
})
