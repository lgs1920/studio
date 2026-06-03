/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-shortcuts-flythrough.test.js
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

import { defaultFlythroughSettings, FLYTHROUGH_MARKER_MODE_NAVIGATION, FLYTHROUGH_MARKER_MODE_TRACE } from '@Core/ui/flythrough/FlythroughProgressionStyle'
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
    - Alt+Shift+R
  scope: App
`

describe('app flythrough shortcuts', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.stubGlobal('fetch', vi.fn(async () => ({
            text: async () => SHORTCUTS_YAML,
        })))
        globalThis.lgs = {
            settings: proxy({
                ui: {
                    flythrough: proxy({
                        ...defaultFlythroughSettings(),
                        marker: {
                            ...defaultFlythroughSettings().marker,
                            mode: FLYTHROUGH_MARKER_MODE_NAVIGATION,
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
                flythrough: proxy({
                    active:  true,
                    playing: false,
                    paused:  false,
                    marker:  {
                        mode: FLYTHROUGH_MARKER_MODE_NAVIGATION,
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
            },
        }
    })

    afterEach(() => {
        globalThis.lgs = undefined
        globalThis.__ = undefined
        vi.unstubAllGlobals()
    })

    it('keeps the journey toolbar shortcut disabled while flythrough is running', async () => {
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

    it('refuses to relaunch orbit outside Passive flythrough mode', async () => {
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const callbacks = new Map()
        const shortcutManager = {
            addShortcut: vi.fn((target, keys, callback) => {
                callbacks.set(keys.join(','), callback)
                return vi.fn()
            }),
        }

        installAppShortcuts(shortcutManager)

        const callback = callbacks.get('Alt+Shift+R')
        expect(callback).toBeTypeOf('function')

        const event = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            stopImmediatePropagation: vi.fn(),
        }

        await callback(event)

        expect(globalThis.__.ui.poiManager.stopRotationAndSync).not.toHaveBeenCalled()
        expect(globalThis.__.ui.sceneManager.focus).not.toHaveBeenCalled()

        globalThis.lgs.settings.ui.flythrough.marker.mode = FLYTHROUGH_MARKER_MODE_TRACE
        globalThis.lgs.stores.flythrough.marker.mode = FLYTHROUGH_MARKER_MODE_TRACE

        await callback(event)

        expect(globalThis.__.ui.sceneManager.focus).toHaveBeenCalled()
    })
})
