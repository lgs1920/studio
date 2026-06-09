/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profile-widget-preview.test.jsx
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

import { cleanup, render } from '@testing-library/react'
import { proxy } from 'valtio'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProfileWidgetPreview } from '@Components/Profile/ProfileWidgetPreview'

describe('ProfileWidgetPreview', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                profiler: {
                    prepareData: vi.fn(() => ({dataset: [{source: [[0, 0]]}], options: [{color: '#fff'}]})),
                },
            },
        }

        globalThis.ResizeObserver = class {
            constructor(callback) {
                this.callback = callback
            }

            observe = (element) => {
                this.callback([{target: element}])
            }

            disconnect = () => {}
        }

        globalThis.lgs = {
            settings: {
                unitSystem: proxy({current: 0}),
                ui: {
                    flythrough: proxy({
                        profileInfo: proxy({
                            useTrackStyle: false,
                            color:         '#ffffff',
                        }),
                    }),
                },
            },
            stores: {
                main: {
                    components: {
                        profile: proxy({key: 'profile-key'}),
                    },
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
        globalThis.ResizeObserver = undefined
    })

    it('fills the preview surface height', () => {
        const {container} = render(<ProfileWidgetPreview entity="profile-widget#1"/>)
        const surface = container.querySelector('.profile-widget-preview-surface')

        expect(surface.style.height).toBe('100%')
        expect(surface.style.width).toBe('100%')
    })
})
