import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    axiosGet:  vi.fn(async () => ({data: {}})),
    sendVisit: vi.fn(async () => true),
    pingBackend: vi.fn(async () => ({alive: true})),
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
        sharedToken:  'shared-token',
    },
}))

vi.mock('@Core/ui/replay/JourneyReplayProgressionStyle', () => ({
    ensureJourneyReplaySettings: vi.fn(() => ({})),
}))

vi.mock('@Utils/FA2SL', () => ({
    FA2SL: {
        registerFontAwesomeInShoelace: vi.fn(),
    },
}))

import { AppUtils } from '@Utils/AppUtils'

describe('AppUtils bootstrap count instrumentation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
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
        await expect(AppUtils.init()).resolves.toEqual({status: true})

        expect(mocks.sendVisit).toHaveBeenCalledTimes(1)
    })

    it('does not send a visit event when the backend bootstrap fails', async () => {
        mocks.pingBackend.mockResolvedValueOnce({alive: false})

        await expect(AppUtils.init()).resolves.toMatchObject({status: false})

        expect(mocks.sendVisit).not.toHaveBeenCalled()
    })
})
