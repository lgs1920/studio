/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-utils-count.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-30
 * Last modified: 2026-11-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    axiosGet:  vi.fn(async () => ({data: {}})),
    sendVisit: vi.fn(async () => true),
    pingBackend: vi.fn(async () => ({alive: true})),
    registerIconLibraryFromKits: vi.fn(),
    fetchResponseOverrides: new Map(),
}))

vi.mock('@Utils/CountApi', () => ({
    CountApi: {
        sendVisit: mocks.sendVisit,
    },
}))

vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({get: mocks.axiosGet})),
    },
}))

vi.mock('cesium', async importOriginal => {
    const actual = await importOriginal()
    return {
        ...actual,
        Ion: {},
    }
})

vi.mock('@Core/Elevation/ElevationServer', () => ({
    ElevationServer: {
        SERVERS: {},
    },
}))

vi.mock('@Core/settings/Settings', () => ({
    Settings: class {
        add = vi.fn(async section => {
            this[section.key] = section.content
        })
    },
}))

vi.mock('@Core/settings/SettingsSection', () => ({
    SettingsSection: class {
        constructor(key) {
            this.key = key
            this.content = null
        }

        init = vi.fn(async () => {
            this.content = globalThis.lgs.configuration[this.key]
        })
    },
}))

vi.mock('@Core/ui/IonTokenManager', () => ({
    ionTokenManager: {
        load:         vi.fn(async () => undefined),
    },
}))

vi.mock('@Core/ui/replay/JourneyReplayProgressionStyle', () => ({
    ensureJourneyReplaySettings: vi.fn(() => ({})),
}))

vi.mock('@Utils/LGS1920IconLibrary', () => ({
    registerLGS1920IconLibrary: mocks.registerIconLibraryFromKits,
}))

import { AppUtils } from '@Utils/AppUtils'

describe('AppUtils bootstrap count instrumentation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.fetchResponseOverrides.clear()
        mocks.pingBackend.mockResolvedValue({alive: true})
        globalThis.__ = {
            app: {
                pingBackend: mocks.pingBackend,
                isDevelopment: vi.fn(() => false),
            },
            widgets: new Map(),
            countries: new Map(),
            ui: {
                css: {
                    getCSSVariable: vi.fn(() => '1rem'),
                    rem2px:        vi.fn(() => 16),
                    setCSSVariable: vi.fn(),
                },
                ui: {
                    hslaString2Hex: vi.fn(() => '#ffffff'),
                },
            },
        }
        globalThis.lgs = {
            stores: {
                replay: {},
                ion:    {token: 'ion-token'},
            },
            createDB: vi.fn(() => {
                globalThis.lgs.db = {
                    settings: {
                        keys:   vi.fn(async () => []),
                        delete: vi.fn(async () => undefined),
                    },
                    vault: {
                        get: vi.fn(async () => null),
                    },
                }
            }),
            setDefaultPOIConfiguration: vi.fn(),
        }
        vi.stubGlobal('fetch', vi.fn(async resource => {
            const responseOverride = mocks.fetchResponseOverrides.get(resource)
            if (responseOverride) {
                return responseOverride
            }

            const responses = {
                'config.yaml':          'applicationName: Studio\nswatches:\n  list: []\n',
                'settings.yaml':        'app: {}\nui: {}\nswatches:\n  list: []\n',
                'layers-terrains.yaml': 'providers: []\n',
                'widgets.yaml':         'widget-groups: {}\nwidgets: {}\n',
                'replay.yaml':          'replay: {}\n',
                'countries.yaml':       '[]\n',
            }
            return {
                text: vi.fn(async () => responses[resource] ?? ''),
                json: vi.fn(async () => resource === 'servers.json'
                    ? {platform: 'test', studio: {proxy: ''}, backend: {protocol: 'http', domain: 'localhost', port: 3000}}
                    : {version: 'test'}),
            }
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        delete globalThis.__
        delete globalThis.lgs
    })

    it('sends one visit event after a successful bootstrap', async () => {
        const onBackendReady = vi.fn()

        await expect(AppUtils.init({onBackendReady})).resolves.toEqual({status: true})

        expect(mocks.sendVisit).toHaveBeenCalledTimes(1)
        expect(mocks.registerIconLibraryFromKits).toHaveBeenCalledOnce()
        expect(onBackendReady).toHaveBeenCalledTimes(1)
    })

    it('does not send a visit event when the backend bootstrap fails', async () => {
        mocks.pingBackend.mockResolvedValueOnce({alive: false})

        const onBackendReady = vi.fn()

        await expect(AppUtils.init({onBackendReady})).resolves.toMatchObject({status: false})

        expect(mocks.sendVisit).not.toHaveBeenCalled()
        expect(onBackendReady).not.toHaveBeenCalled()
    })

    it('requests all independent configuration files while the settings body is pending', async () => {
        const backendReady = Promise.withResolvers()
        const settingsBody = Promise.withResolvers()
        mocks.fetchResponseOverrides.set('settings.yaml', {text: () => settingsBody.promise})

        const initialization = AppUtils.init({onBackendReady: backendReady.resolve})
        try {
            await backendReady.promise
            for (const resource of ['settings.yaml', 'layers-terrains.yaml', 'widgets.yaml', 'replay.yaml', 'countries.yaml', 'build.json']) {
                expect(globalThis.fetch).toHaveBeenCalledWith(resource, expect.anything())
            }
            expect(lgs.createDB).not.toHaveBeenCalled()
        }
        finally {
            settingsBody.resolve('app: {}\nui: {}\nswatches:\n  list: []\n')
            await initialization
        }
        await expect(initialization).resolves.toEqual({status: true})
    })

    it('reports a stalled YAML response body as a resource timeout', async () => {
        mocks.fetchResponseOverrides.set('settings.yaml', {
            text: async () => {
                throw new DOMException('The operation timed out', 'TimeoutError')
            },
        })

        await expect(AppUtils.init()).rejects.toMatchObject({
            code:    'STARTUP_RESOURCE_TIMEOUT',
            message: 'Timed out while loading settings.yaml after 10 seconds',
        })
    })

    it('identifies a startup resource that times out instead of leaving the splash pending', async () => {
        const fetchMock = vi.fn(async () => {
            throw new DOMException('The operation timed out', 'TimeoutError')
        })
        vi.stubGlobal('fetch', fetchMock)

        await expect(AppUtils.init()).rejects.toMatchObject({
            code:    'STARTUP_RESOURCE_TIMEOUT',
            message: 'Timed out while loading config.yaml after 10 seconds',
        })
        expect(fetchMock).toHaveBeenCalledWith('config.yaml', expect.objectContaining({
            cache: 'no-store',
            signal: expect.any(AbortSignal),
        }))
    })

    it('reports an unavailable JSON resource instead of exposing a JSON parse error', async () => {
        mocks.fetchResponseOverrides.set('servers.json', {
            ok:         false,
            status:     503,
            statusText: 'Offline',
            json:       vi.fn(async () => {
                throw new SyntaxError("Unexpected token 'O'")
            }),
        })

        await expect(AppUtils.init()).rejects.toMatchObject({
            code:    'JSON_RESOURCE_UNAVAILABLE',
            message: 'Unable to load servers.json (503 Offline)',
        })
    })
})
