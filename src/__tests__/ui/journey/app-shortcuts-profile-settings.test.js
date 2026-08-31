/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-shortcuts-profile-settings.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-22
 * Last modified: 2026-07-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SETTINGS_EDITOR_DRAWER } from '@Core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SHORTCUTS_YAML = `
- action: Open user profile settings
  description: Opens the user profile settings section.
  id: profile-settings-show
  keys:
    - Alt+Shift+U
  scope: App
`

const makeEvent = () => ({
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    stopPropagation: vi.fn(),
})

describe('app profile settings shortcut', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.stubGlobal('fetch', vi.fn(async () => ({
            text: async () => SHORTCUTS_YAML,
        })))

        globalThis.lgs = {
            stores: {
                ui: {
                    mainUI: {
                        callForActions: {
                            active: true,
                        },
                    },
                },
            },
        }
        globalThis.__ = {
            ui: {
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

    it('opens the settings drawer on the manage user profile tab', async () => {
        const {installAppShortcuts} = await import('@Core/events/appShortcuts')
        const callbacks = new Map()
        const shortcutManager = {
            addShortcut: vi.fn((_target, keys, callback) => {
                callbacks.set(keys.join(','), callback)
                return vi.fn()
            }),
        }

        installAppShortcuts(shortcutManager)

        const callback = callbacks.get('Alt+Shift+U')
        expect(callback).toBeTypeOf('function')

        await callback(makeEvent())

        expect(globalThis.lgs.stores.ui.mainUI.callForActions.active).toBe(false)
        expect(globalThis.__.ui.drawerManager.open).toHaveBeenCalledWith(SETTINGS_EDITOR_DRAWER, {
            tab: 'manage-user-profile',
        })
    })
})
