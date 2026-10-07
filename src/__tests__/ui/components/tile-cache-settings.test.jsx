/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: tile-cache-settings.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

// Use native components with the browser wrapper: Node resolves Lit's SSR wrapper.
vi.mock('@web.awesome.me/webawesome-pro/dist/react', async () => {
    const React = await import('react')
    const {createComponent} = await import('../../../../node_modules/@lit/react/create-component.js')
    const components = {}
    for (const name of ['select', 'option', 'button', 'divider', 'icon']) {
        const {default: elementClass} = await import(`../../../../node_modules/@web.awesome.me/webawesome-pro/dist/components/${name}/${name}.js`)
        const componentName = `Wa${name[0].toUpperCase()}${name.slice(1)}`
        components[componentName] = createComponent({react: React, tagName: `wa-${name}`, elementClass})
    }
    return components
})

const mocks = vi.hoisted(() => ({refresh: vi.fn(async () => undefined), clear: vi.fn(async () => undefined)}))

vi.mock('@Core/cache/CartographicCacheController', async () => {
    const {proxy: createProxy} = await import('valtio')
    return {
        $cartographicCache: createProxy({usage: 320 * 1024 ** 2, available: true, effectiveMaxBytes: 512 * 1024 ** 2}),
        cartographicCacheController: mocks,
    }
})

import { TileCacheSettings } from '@Components/Settings/application/general/TileCacheSettings'
import { $cartographicCache } from '@Core/cache/CartographicCacheController'
import { SettingsSection } from '@Core/settings/SettingsSection'

beforeEach(() => {
    mocks.refresh.mockClear()
    mocks.clear.mockReset().mockResolvedValue(undefined)
    Object.assign($cartographicCache, {usage: 320 * 1024 ** 2, available: true, checking: false, error: '', effectiveMaxBytes: 512 * 1024 ** 2})
    vi.stubGlobal('lgs', {settings: {app: proxy({tileCacheMaxBytes: 512 * 1024 ** 2})}})
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('cartographic cache settings', () => {
    it('uses the native Web Awesome select and exposes all four sizes and current usage', async () => {
        const {container} = render(<TileCacheSettings/>)
        const select = container.querySelector('wa-select')
        expect(select.label).toBe('Maximum cartographic cache size')
        expect(select.value).toBe(String(512 * 1024 ** 2))
        expect([...container.querySelectorAll('wa-option')].map(option => option.textContent.trim())).toEqual(['256 MiB', '512 MiB (default)', '1 GiB', '2 GiB'])
        expect(screen.getByRole('status').textContent).toContain('320 MiB used of 512 MiB')
        await act(async () => { fireEvent.change(select, {target: {value: String(1024 ** 3)}}) })
        expect(lgs.settings.app.tileCacheMaxBytes).toBe(1024 ** 3)
        expect(screen.getByRole('status').textContent).toContain('1 GiB')
    })

    it('disables the purge while awaiting its acknowledgement', async () => {
        let complete
        mocks.clear.mockImplementation(() => new Promise(resolve => { complete = resolve }))
        const {container} = render(<TileCacheSettings/>)
        const button = container.querySelector('wa-button')
        await act(async () => { fireEvent.click(button) })
        expect(mocks.clear).toHaveBeenCalledOnce()
        expect(button.disabled).toBe(true)
        expect(button.loading).toBe(true)
        await act(async () => { complete() })
        expect(button.disabled).toBe(false)
    })

    it('displays storage-pressure limits and preserves controls when the cache is unavailable', async () => {
        $cartographicCache.effectiveMaxBytes = 256 * 1024 ** 2
        const {container} = render(<TileCacheSettings/>)
        expect(screen.getByText('Available storage currently limits the cache to 256 MiB.')).toBeDefined()
        await act(async () => { $cartographicCache.available = false })
        expect(screen.getByRole('status').textContent).toContain('continue to load from the network')
        expect(container.querySelector('wa-button').disabled).toBe(true)
        expect(container.querySelector('wa-select').disabled).toBe(false)
    })

    it('removes the usage refresh interval on unmount', async () => {
        vi.useFakeTimers()
        const {unmount} = render(<TileCacheSettings/>)
        expect(mocks.refresh).toHaveBeenCalledOnce()
        await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
        expect(mocks.refresh).toHaveBeenCalledTimes(2)
        unmount()
        await vi.advanceTimersByTimeAsync(5000)
        expect(mocks.refresh).toHaveBeenCalledTimes(2)
    })

    it('uses a warning summary only after unavailability is confirmed and restores it on recovery', async () => {
        const {container} = render(<TileCacheSettings/>)
        const summary = container.querySelector('[slot="summary"]')
        expect(summary.querySelector('wa-icon').name).toBe('map')
        expect(summary.style.color).toBe('')
        await act(async () => {
            $cartographicCache.available = false
            $cartographicCache.error = 'This page has no active service worker.'
        })
        expect(summary.querySelector('wa-icon').name).toBe('triangle-exclamation')
        expect(summary.style.color).toBe('var(--wa-color-warning-on-quiet)')
        expect(screen.getByRole('status').textContent).toContain('This page has no active service worker.')
        await act(async () => { $cartographicCache.available = true })
        expect(summary.querySelector('wa-icon').name).toBe('map')
        expect(summary.style.color).toBe('')
    })

    it('shows a neutral summary while checking the initial availability', () => {
        Object.assign($cartographicCache, {available: false, checking: true})
        const {container} = render(<TileCacheSettings/>)
        expect(screen.getByRole('status').textContent).toBe('Checking cartographic cache availability…')
        expect(container.querySelector('[slot="summary"] wa-icon').name).toBe('map')
        expect(container.querySelector('[slot="summary"]').style.color).toBe('')
        expect(container.querySelector('wa-button').disabled).toBe(true)
    })

    it('preserves the selected budget through existing settings hydration', () => {
        const section = new SettingsSection('app')
        const selected = {tileCacheMaxBytes: 1024 ** 3}
        const restored = section.update(selected, {tileCacheMaxBytes: 512 * 1024 ** 2, firstVisit: true})
        expect(restored.tileCacheMaxBytes).toBe(1024 ** 3)
        expect(restored.firstVisit).toBe(true)
    })
})
