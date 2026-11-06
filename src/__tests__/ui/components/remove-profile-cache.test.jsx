/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: remove-profile-cache.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-06
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    deleteAll: vi.fn(async () => undefined),
    confirm: vi.fn(async () => true),
    deleteJourneyDb: vi.fn(async () => undefined),
    deleteSettingsDb: vi.fn(async () => undefined),
    deleteVaultDb: vi.fn(async () => undefined),
}))

vi.mock('@Core/cache/CartographicCacheController', () => ({
    cartographicCacheController: {deleteAll: mocks.deleteAll},
}))

vi.mock('@Components/Modals/ConfirmUI', () => ({
    useConfirm: () => [() => null, mocks.confirm],
}))

vi.mock('@awesome.me/webawesome/dist/react', async () => {
    const React = await import('react')
    const {createComponent} = await import('../../../../node_modules/@lit/react/create-component.js')
    const components = {}
    for (const name of ['button', 'callout', 'details', 'divider', 'icon']) {
        const {default: elementClass} = await import(`../../../../node_modules/@awesome.me/webawesome/dist/components/${name}/${name}.js`)
        const componentName = `Wa${name[0].toUpperCase()}${name.slice(1)}`
        components[componentName] = createComponent({react: React, tagName: `wa-${name}`, elementClass})
    }
    return components
})

import { RemoveProfile } from '@Components/Settings/application/profile/RemoveProfile'

beforeEach(() => {
    mocks.deleteAll.mockReset().mockResolvedValue(undefined)
    mocks.confirm.mockReset().mockResolvedValue(true)
    mocks.deleteJourneyDb.mockReset().mockResolvedValue(undefined)
    mocks.deleteSettingsDb.mockReset().mockResolvedValue(undefined)
    mocks.deleteVaultDb.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal('location', {href: ''})
    vi.stubGlobal('lgs', {
        editorSettingsProxy: {account: {}},
        db: {
            lgs1920: {deleteDB: mocks.deleteJourneyDb},
            settings: {deleteDB: mocks.deleteSettingsDb},
            vault: {deleteDB: mocks.deleteVaultDb},
        },
        servers: {site: {protocol: 'https', domain: 'lgs1920.fr'}},
    })
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('profile deletion and cartographic data', () => {
    it('waits for deletion of every tile-cache partition before removing local databases', async () => {
        let acknowledgeDeletion
        mocks.deleteAll.mockReturnValue(new Promise(resolve => { acknowledgeDeletion = resolve }))
        const {container} = render(<RemoveProfile/>)

        await act(async () => { fireEvent.click(container.querySelector('wa-button')) })
        await waitFor(() => expect(mocks.deleteAll).toHaveBeenCalledOnce())
        expect(mocks.deleteJourneyDb).not.toHaveBeenCalled()
        expect(mocks.deleteSettingsDb).not.toHaveBeenCalled()
        expect(mocks.deleteVaultDb).not.toHaveBeenCalled()

        await act(async () => { acknowledgeDeletion({available: true, entries: 0}) })
        await waitFor(() => expect(mocks.deleteJourneyDb).toHaveBeenCalledOnce())
        expect(mocks.deleteSettingsDb).toHaveBeenCalledOnce()
        expect(mocks.deleteVaultDb).toHaveBeenCalledOnce()
        expect(location.href).toBe('https://lgs1920.fr')
    })

    it('keeps profile databases when the service worker cannot acknowledge tile-cache deletion', async () => {
        mocks.deleteAll.mockRejectedValue(new Error('The cartographic cache did not respond.'))
        const {container} = render(<RemoveProfile/>)

        await act(async () => { fireEvent.click(container.querySelector('wa-button')) })
        expect((await screen.findByRole('alert')).textContent).toContain('The cartographic cache did not respond.')
        expect(mocks.deleteJourneyDb).not.toHaveBeenCalled()
        expect(mocks.deleteSettingsDb).not.toHaveBeenCalled()
        expect(mocks.deleteVaultDb).not.toHaveBeenCalled()
        expect(location.href).toBe('')
    })
})
