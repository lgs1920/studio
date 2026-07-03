/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: orbit-button.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-09
 * Last modified: 2026-06-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { OrbitButton } from '@Components/MainUI/OrbitButton'
import {
    defaultJourneyReplaySettings,
    REPLAY_MARKER_MODE_NAVIGATION,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name}) => <span data-icon={name}/>,
    WaTooltip: () => null,
}))

vi.mock('@Core/OrbitSettings', () => ({
    getOrbitSettings: () => ({direction: 1, rpm: 0.3}),
    setOrbitStoreSettings: vi.fn(),
}))

describe('OrbitButton', () => {
    beforeEach(() => {
        const replay = defaultJourneyReplaySettings()
        replay.marker.mode = REPLAY_MARKER_MODE_NAVIGATION

        globalThis.__ = {
            ui: {
                sceneManager: {
                    target: null,
                    focus:  vi.fn(),
                },
            },
        }
        globalThis.lgs = {
            settings: {
                ui: {
                    replay,
                },
            },
            stores: {
                ui: proxy({
                    mainUI: {
                        rotate:   {running: false, target: null},
                        panorama: {active: false},
                    },
                }),
                main: proxy({
                    components: {
                        camera: {
                            target:   null,
                            position: {},
                        },
                        pois: {
                            list: new Map(),
                        },
                    },
                }),
                replay: proxy({
                    active:       false,
                    playing:      false,
                    paused:       false,
                    orbitAllowed: true,
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('enables orbit outside replay even when the replay marker is not passive', () => {
        render(<OrbitButton/>)

        expect(screen.getByRole('button').disabled).toBe(false)
    })

    it('disables orbit while any replay is active', () => {
        globalThis.lgs.stores.replay.active = true
        render(<OrbitButton/>)

        expect(screen.getByRole('button').disabled).toBe(true)
    })
})
