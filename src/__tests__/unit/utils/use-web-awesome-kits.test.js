/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: use-web-awesome-kits.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-11
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { icon as renderFontAwesomeIcon } from '@fortawesome/fontawesome-svg-core'
import * as kitIcons from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import * as kitDuotoneIcons from '@awesome.me/kit-eb5c406148/icons/kit-duotone/custom'
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

vi.mock('@awesome.me/webawesome/dist/components/icon/library.js', () => ({
    getIconLibrary: mocks.getIconLibrary,
    registerIconLibrary: mocks.registerIconLibrary,
}))

import { LGS1920_ICON_LIBRARY, registerIconLibraryFromKits } from '@Utils/useWebAwesomeKits'
import { registerLGS1920IconLibrary } from '@Utils/LGS1920IconLibrary'

const testKits = [
    {family: 'classic', icons: kitIcons},
    {family: 'duotone', icons: kitDuotoneIcons},
]

describe('useWebAwesomeKits', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('registers the LGS1920 library and resolves kit icons by their icon name', () => {
        registerIconLibraryFromKits(LGS1920_ICON_LIBRARY, testKits)

        const customRegistration = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === LGS1920_ICON_LIBRARY,
        )
        const source = customRegistration[1].resolver('camera-sliders')

        expect(customRegistration).toBeTruthy()
        expect(source).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toContain('<svg')
    })

    it('resolves the Picture-in-Picture reattach icon from the custom kit', () => {
        registerIconLibraryFromKits(LGS1920_ICON_LIBRARY, testKits)

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === LGS1920_ICON_LIBRARY,
        )
        const source = options.resolver('picture-in-picture-out', 'classic', 'regular')

        expect(source).toMatch(/^data:image\/svg\+xml,/)
    })

    it('bundles the regular question icon independently of the remote Kit', () => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )
        const source = options.resolver('question', 'classic', 'regular')

        expect(source).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toContain('<svg')
    })

    it('bundles the regular circle-plus icon independently of the remote Kit', () => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )
        const source = options.resolver('circle-plus', 'classic', 'regular')

        expect(source).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toContain('data-prefix="far"')
    })

    it.each(['arrows-up-down', 'arrows-left-right', 'lasso', 'square-dashed', 'magnifying-glass-plus', 'magnifying-glass-minus', 'arrow-rotate-left', 'arrow-rotate-right'])('bundles the solid %s cursor icon independently of the remote Kit', name => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )
        const source = options.resolver(name, 'classic', 'solid')

        expect(source).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toContain('data-prefix="fas"')
        expect(mocks.defaultResolver).not.toHaveBeenCalled()
    })

    it('bundles the solid location-pin icon used by POI movement independently of the remote Kit', () => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )
        const source = options.resolver('location-pin', 'classic', 'solid')

        expect(source).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toContain('data-prefix="fas"')
        expect(mocks.defaultResolver).not.toHaveBeenCalled()
    })

    it('bundles the solid location-dot cursor icon independently of the remote Kit', () => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )
        const source = options.resolver('location-dot', 'classic', 'solid')

        expect(source).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toContain('data-prefix="fas"')
        expect(mocks.defaultResolver).not.toHaveBeenCalled()
    })

    it.each([
        ['square', 'regular', 'far'],
        ['square-b', 'regular', 'far'],
        ['square-m', 'regular', 'far'],
        ['square-h', 'regular', 'far'],
        ['square-check', 'regular', 'far'],
        ['square-full', 'solid', 'fas'],
    ])('bundles the %s %s icon independently of the remote Kit', (name, variant, prefix) => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )
        const source = options.resolver(name, 'classic', variant)

        expect(source).toMatch(/^data:image\/svg\+xml,/)
        expect(decodeURIComponent(source.slice('data:image/svg+xml,'.length))).toContain('data-prefix="' + prefix + '"')
        expect(mocks.defaultResolver).not.toHaveBeenCalled()
    })

    it('resolves icons from the kit duotone exports', () => {
        registerIconLibraryFromKits(LGS1920_ICON_LIBRARY, testKits)

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === LGS1920_ICON_LIBRARY,
        )
        const source = options.resolver('cave-in-mountains', 'duotone', 'regular')

        expect(source).toMatch(/^data:image\/svg\+xml,/)
    })

    it.each(['circle', 'diamond'])('bundles both visible layers of the regular duotone %s', name => {
        registerLGS1920IconLibrary()

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )
        const source = options.resolver(name, 'duotone', 'regular')
        expect(source).toMatch(/^data:image\/svg\+xml,/)
        const svg = decodeURIComponent(source.slice('data:image/svg+xml,'.length))
        expect(svg).toContain('data-prefix="fadr"')
        const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]*)"/g)]
        expect(paths).toHaveLength(2)
        expect(paths.every(path => path[1].length > 0)).toBe(true)
        expect(mocks.defaultResolver).not.toHaveBeenCalled()
    })

    it('uses the first matching definition from an ordered kit list', () => {
        const firstDefinition = {...faRegularCaveInMountains, iconName: 'camera-sliders'}

        registerIconLibraryFromKits(LGS1920_ICON_LIBRARY, [
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
        registerIconLibraryFromKits(LGS1920_ICON_LIBRARY, testKits)

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'default',
        )

        expect(options.resolver('camera-sliders')).toMatch(/^data:image\/svg\+xml,/)
        expect(options.resolver('camera-circle-arrow-down', 'classic', 'regular')).toMatch(/^data:image\/svg\+xml,/)
        expect(options.resolver('cave-in-mountains', 'duotone', 'regular')).toMatch(/^data:image\/svg\+xml,/)
        expect(options.resolver('cave-in-mountains', 'classic', 'regular')).toMatch(/^data:image\/svg\+xml,/)
        expect(options.resolver('house', 'classic', 'solid', false)).toBe('default:house')
        expect(mocks.defaultResolver).toHaveBeenCalledWith('house', 'classic', 'solid', false)
    })

    it('rejects unknown LGS1920 icon names', () => {
        registerIconLibraryFromKits('custom-icons', testKits)

        const [, options] = mocks.registerIconLibrary.mock.calls.find(
            ([libraryName]) => libraryName === 'custom-icons',
        )

        expect(() => options.resolver('faCameraSliders')).toThrow('Unknown LGS1920 icon')
    })

    it('requires a library name and an ordered kit list', () => {
        expect(() => registerIconLibraryFromKits('', testKits)).toThrow('library name is required')
        expect(() => registerIconLibraryFromKits(LGS1920_ICON_LIBRARY)).toThrow('kits must be an array')
    })
})
