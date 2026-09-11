/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fa2wa.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-11
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { icon as renderFontAwesomeIcon } from '@fortawesome/fontawesome-svg-core'
import { faCameraSliders, faRegularCaveInMountains } from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    defaultResolver: vi.fn(name => `default:${name}`),
    getIconLibrary: vi.fn(() => ({
        name: 'default',
        resolver: mocks.defaultResolver,
        mutator: vi.fn(),
    })),
    registerIconLibrary: vi.fn(),
}))

vi.mock('@web.awesome.me/webawesome-pro', () => ({
    registerIconLibrary: mocks.registerIconLibrary,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/library.js', () => ({
    getIconLibrary: mocks.getIconLibrary,
}))

import { LGS1920_ICON_LIBRARY, registerLGS1920IconLibrary } from '@Utils/FA2WA'

describe('FA2WA', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('registers the LGS1920 library and resolves kit icons by their icon name', () => {
        registerLGS1920IconLibrary()

        const customRegistration = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === LGS1920_ICON_LIBRARY,
        )
        const source = customRegistration[1].resolver('camera-sliders')

        expect(customRegistration).toBeTruthy()
        expect(source).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toContain('<svg')
    })

    it('resolves icons from the kit duotone exports', () => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === LGS1920_ICON_LIBRARY,
        )
        const source = options.resolver('cave-in-mountains', 'duotone', 'regular')

        expect(source).toMatch(/^data:image\/svg\+xml,/)
    })

    it('uses the first matching definition from an ordered kit list', () => {
        const firstDefinition = {...faRegularCaveInMountains, iconName: 'camera-sliders'}

        registerLGS1920IconLibrary([
            {family: 'classic', variant: 'regular', icons: {faCameraSliders: firstDefinition}},
            {family: 'classic', variant: 'regular', icons: {faCameraSliders}},
        ])

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === LGS1920_ICON_LIBRARY,
        )
        const source = options.resolver('camera-sliders', 'classic', 'regular')

        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toBe(
            renderFontAwesomeIcon(firstDefinition).html.join(''),
        )
    })

    it('uses the kit resolver automatically when no library is specified', () => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )

        expect(options.resolver('camera-sliders')).toMatch(/^data:image\/svg\+xml,/)
        expect(options.resolver('cave-in-mountains', 'duotone', 'regular')).toMatch(/^data:image\/svg\+xml,/)
        expect(options.resolver('cave-in-mountains', 'classic', 'regular')).toMatch(/^data:image\/svg\+xml,/)
        expect(options.resolver('house', 'classic', 'solid', false)).toBe('default:house')
        expect(mocks.defaultResolver).toHaveBeenCalledWith('house', 'classic', 'solid', false)
    })

    it('rejects unknown LGS1920 icon names', () => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === LGS1920_ICON_LIBRARY,
        )

        expect(() => options.resolver('faCameraSliders')).toThrow('Unknown LGS1920 icon')
    })
})
