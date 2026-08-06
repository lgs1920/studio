/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ion-token-manager.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-24
 * Last modified on: 2026-06-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { StoresManager } from '@Core/stores/StoresManager'
import { IonTokenManager } from '@Core/ui/IonTokenManager'
import { subscribe } from 'valtio'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('IonTokenManager', () => {
    let previousLgs

    beforeEach(() => {
        previousLgs = globalThis.lgs

        const stores = new StoresManager()
        stores.ion.token = 'shared-token'
        stores.ion.source = 'default'
        stores.ion.loaded = true
        stores.ion.showPrompt = true
        stores.ion.promptMode = 'blocked'
        stores.ion.timerActive = true
        stores.ion.accumulatedSeconds = 480
        stores.ion.dismissedThisSession = false
        stores.ion.introSeen = true
        stores.ion.promptDelaySeconds = 480
        stores.ion.promptWarningPercent = 80

        globalThis.lgs = {
            stores,
            configuration: {
                ion: {
                    sharedToken:          'shared-token',
                    promptDelaySeconds:   480,
                    promptWarningPercent: 80,
                },
            },
            settings: {
                ion: {
                    sharedToken:          'shared-token',
                    promptDelaySeconds:   480,
                    promptWarningPercent: 80,
                },
            },
            db: {
                settings: {
                    put:    vi.fn(async () => undefined),
                    delete: vi.fn(async () => undefined),
                    get:    vi.fn(async key => key === 'ion' ? globalThis.lgs.settings.ion : undefined),
                },
                vault: {
                    put:    vi.fn(async () => undefined),
                    delete: vi.fn(async () => undefined),
                    get:    vi.fn(async () => undefined),
                },
            },
        }

        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok:   true,
            json: vi.fn(async () => ({})),
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        globalThis.lgs = previousLgs
        vi.restoreAllMocks()
    })

    const prepareDefaultCountingState = () => {
        const state = globalThis.lgs.stores.ion
        state.token = 'shared-token'
        state.source = 'default'
        state.loaded = true
        state.showPrompt = false
        state.promptMode = null
        state.timerActive = false
        state.accumulatedSeconds = 0
        state.dismissedThisSession = false
        state.introSeen = true

        Object.assign(globalThis.lgs.stores.ui.mainUI.rotate, {running: false})
        Object.assign(globalThis.lgs.stores.ui.mainUI.panorama, {active: false})
        Object.assign(globalThis.lgs.stores.replay, {
            active:             false,
            playing:            false,
            paused:             false,
            recordingSync:      false,
            clipSequenceActive: false,
        })
        Object.assign(globalThis.lgs.stores.ui.video, {
            recording:    false,
            preRecording: false,
            snapshot:     false,
            finalizing:   false,
        })
    }

    it('saves a personal token into the observed ion store and closes blocked prompt state', async () => {
        const manager = new IonTokenManager()
        const updates = []
        const unsubscribe = subscribe(globalThis.lgs.stores.ion, () => {
            updates.push({
                             source:     globalThis.lgs.stores.ion.source,
                             showPrompt: globalThis.lgs.stores.ion.showPrompt,
                         })
        })

        await manager.save('personal-token')
        unsubscribe()

        expect(updates.length).toBeGreaterThan(0)
        expect(globalThis.lgs.stores.ion.token).toBe('personal-token')
        expect(globalThis.lgs.stores.ion.source).toBe('user')
        expect(globalThis.lgs.stores.ion.showPrompt).toBe(false)
        expect(globalThis.lgs.stores.ion.promptMode).toBeNull()
        expect(globalThis.lgs.stores.ion.timerActive).toBe(false)
    })

    it('stores usage and intro management data in settings, not vault', async () => {
        const manager = new IonTokenManager()

        globalThis.lgs.stores.ion.accumulatedSeconds = 123

        await manager.persistUsage()
        await manager.markIntroSeen()

        expect(globalThis.lgs.db.settings.put).toHaveBeenCalledWith(
            'ion',
            expect.objectContaining({usageSeconds: 123}),
            'settings',
        )
        expect(globalThis.lgs.db.settings.put).toHaveBeenCalledWith(
            'ion',
            expect.objectContaining({introSeen: true}),
            'settings',
        )
        expect(globalThis.lgs.db.vault.put).not.toHaveBeenCalled()
        expect(globalThis.lgs.db.vault.delete).toHaveBeenCalledWith('cesium_ion_token_usage_seconds', 'vault')
        expect(globalThis.lgs.db.vault.delete).toHaveBeenCalledWith('cesium_ion_intro_seen', 'vault')
        expect(globalThis.lgs.settings.ion.usageSeconds).toBe(123)
        expect(globalThis.lgs.settings.ion.introSeen).toBe(true)
    })

    it('rejects the shared application token as a personal token', async () => {
        const manager = new IonTokenManager()

        await expect(manager.save('shared-token')).rejects.toThrow('personal Cesium Ion token')

        expect(globalThis.lgs.db.vault.put).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.ion.token).toBe('shared-token')
        expect(globalThis.lgs.stores.ion.source).toBe('default')
        expect(globalThis.lgs.stores.ion.showPrompt).toBe(true)
        expect(globalThis.lgs.stores.ion.promptMode).toBe('blocked')
    })

    it('loads the shared application token from the ion settings section', async () => {
        const stores = globalThis.lgs.stores
        stores.ion.loaded = false
        globalThis.lgs.settings.ion.sharedToken = 'nested-shared-token'
        globalThis.lgs.configuration.ion.sharedToken = 'nested-shared-token'

        const manager = new IonTokenManager()
        await manager.load()

        expect(stores.ion.token).toBe('nested-shared-token')
        expect(stores.ion.source).toBe('default')
    })

    it('falls back to the shared application token and opens the invalid prompt when requested', async () => {
        const stores = globalThis.lgs.stores
        const manager = new IonTokenManager()
        await manager.fallbackToSharedToken('invalid')

        expect(stores.ion.token).toBe('shared-token')
        expect(stores.ion.source).toBe('default')
        expect(stores.ion.showPrompt).toBe(true)
        expect(stores.ion.promptMode).toBe('invalid')
        expect(globalThis.lgs.db.vault.delete).toHaveBeenCalledWith('cesium_ion_token', 'vault')
    })

    it('migrates legacy management data out of vault on load', async () => {
        const stores = globalThis.lgs.stores
        stores.ion.loaded = false
        globalThis.lgs.db.settings.get = vi.fn(async key => {
            if (key === 'ion') {
                return globalThis.lgs.settings.ion
            }
            if (key === 'cesium_ion_token_usage_seconds') {
                return 240
            }
            return undefined
        })
        globalThis.lgs.db.vault.get = vi.fn(async key => {
            if (key === 'cesium_ion_intro_seen') {
                return true
            }
            return undefined
        })

        const manager = new IonTokenManager()
        await manager.load()

        expect(globalThis.lgs.db.settings.put).toHaveBeenCalledWith(
            'ion',
            expect.objectContaining({usageSeconds: 240}),
            'settings',
        )
        expect(globalThis.lgs.db.settings.put).toHaveBeenCalledWith(
            'ion',
            expect.objectContaining({
                                        introSeen:     true,
                                        usageSeconds: 240,
                                    }),
            'settings',
        )
        expect(globalThis.lgs.db.settings.delete).toHaveBeenCalledWith('cesium_ion_token_usage_seconds', 'settings')
        expect(globalThis.lgs.db.settings.delete).toHaveBeenCalledWith('cesium_ion_intro_seen', 'settings')
        expect(globalThis.lgs.db.vault.delete).toHaveBeenCalledWith('cesium_ion_token_usage_seconds', 'vault')
        expect(globalThis.lgs.db.vault.delete).toHaveBeenCalledWith('cesium_ion_intro_seen', 'vault')
        expect(stores.ion.accumulatedSeconds).toBe(240)
        expect(stores.ion.introSeen).toBe(true)
    })

    it('pauses shared-token usage counting while the app is unfocused and resumes on focus', async () => {
        vi.useFakeTimers()
        let focused = true
        vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
        prepareDefaultCountingState()

        const manager = new IonTokenManager()
        await manager.startPromptTimer()

        await vi.advanceTimersByTimeAsync(2000)
        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(2)

        focused = false
        window.dispatchEvent(new Event('blur'))
        await vi.advanceTimersByTimeAsync(3000)
        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(2)
        expect(globalThis.lgs.stores.ion.timerActive).toBe(false)

        focused = true
        window.dispatchEvent(new Event('focus'))
        await vi.advanceTimersByTimeAsync(2000)
        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(4)
        expect(globalThis.lgs.stores.ion.timerActive).toBe(true)

        await manager.stopPromptTimer({persist: false})
    })

    it('pauses shared-token usage counting after five seconds without user activity', async () => {
        vi.useFakeTimers()
        vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        prepareDefaultCountingState()

        const manager = new IonTokenManager()
        await manager.startPromptTimer()

        await vi.advanceTimersByTimeAsync(4000)
        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(4)
        expect(globalThis.lgs.stores.ion.timerActive).toBe(true)

        await vi.advanceTimersByTimeAsync(2000)
        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(4)
        expect(globalThis.lgs.stores.ion.timerActive).toBe(false)

        window.dispatchEvent(new Event('pointerdown'))
        await vi.advanceTimersByTimeAsync(2000)
        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(6)
        expect(globalThis.lgs.stores.ion.timerActive).toBe(true)

        await manager.stopPromptTimer({persist: false})
    })

    it.each([
        ['replay', () => {
            globalThis.lgs.stores.replay.playing = true
        }],
        ['video recording', () => {
            globalThis.lgs.stores.ui.video.recording = true
        }],
    ])('keeps shared-token usage counting past inactivity during %s', async (_label, activateMode) => {
        vi.useFakeTimers()
        vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        prepareDefaultCountingState()
        activateMode()

        const manager = new IonTokenManager()
        await manager.startPromptTimer()

        await vi.advanceTimersByTimeAsync(8000)
        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(8)
        expect(globalThis.lgs.stores.ion.timerActive).toBe(true)

        await manager.stopPromptTimer({persist: false})
    })

    it.each([
        ['replay', () => {
            globalThis.lgs.stores.replay.playing = true
        }],
        ['video recording', () => {
            globalThis.lgs.stores.ui.video.recording = true
        }],
    ])('keeps shared-token usage counting while unfocused during %s', async (_label, activateMode) => {
        vi.useFakeTimers()
        let focused = true
        vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
        prepareDefaultCountingState()
        activateMode()

        const manager = new IonTokenManager()
        await manager.startPromptTimer()

        await vi.advanceTimersByTimeAsync(2000)
        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(2)

        focused = false
        window.dispatchEvent(new Event('blur'))
        await vi.advanceTimersByTimeAsync(4000)

        expect(globalThis.lgs.stores.ion.accumulatedSeconds).toBe(6)
        expect(globalThis.lgs.stores.ion.timerActive).toBe(true)

        await manager.stopPromptTimer({persist: false})
    })

    it('does not apply focus or activity counting while a personal token is active', async () => {
        vi.useFakeTimers()
        vi.spyOn(document, 'hasFocus').mockReturnValue(true)
        const state = globalThis.lgs.stores.ion
        state.token = 'personal-token'
        state.source = 'user'
        state.loaded = true
        state.showPrompt = false
        state.promptMode = null
        state.timerActive = false
        state.accumulatedSeconds = 0

        const manager = new IonTokenManager()
        await manager.startPromptTimer()
        window.dispatchEvent(new Event('focus'))
        window.dispatchEvent(new Event('pointerdown'))
        await vi.advanceTimersByTimeAsync(3000)

        expect(state.accumulatedSeconds).toBe(0)
        expect(state.timerActive).toBe(false)
    })
})
