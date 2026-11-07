/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: add-poi-to-library.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { addPOIToLibrary } from '@Components/MainUI/MapPOI/addPOIToLibrary'
import { SECOND } from '@Core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { openPOIEditor, hideGeocodingPOIAddOverlay, showPOICreationDuplicateToast, toastError, toastSuccess } = vi.hoisted(() => ({
    openPOIEditor: vi.fn(),
    hideGeocodingPOIAddOverlay: vi.fn(),
    showPOICreationDuplicateToast: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}))

vi.mock('@Components/MainUI/MapPOI/openPOIEditor', () => ({openPOIEditor}))
vi.mock('@Components/MainUI/MapPOI/showPOICreationDuplicateToast', () => ({showPOICreationDuplicateToast}))
vi.mock('@Core/stores/geocodingPOIAddOverlay', () => ({hideGeocodingPOIAddOverlay}))
vi.mock('@Utils/UIToast', () => ({
    UIToast: {error: toastError, success: toastSuccess},
}))

describe('addPOIToLibrary', () => {
    let addTemporaryPOIToLibrary

    beforeEach(() => {
        vi.clearAllMocks()
        addTemporaryPOIToLibrary = vi.fn()
        globalThis.__ = {ui: {poiManager: {addTemporaryPOIToLibrary}}}
    })

    afterEach(() => {
        globalThis.__ = undefined
    })

    it('coalesces repeated clicks and reports success only once after persistence', async () => {
        const poi = {id: 'temporary-library-poi', title: 'Paris'}
        let resolveAdd
        addTemporaryPOIToLibrary.mockImplementation(() => new Promise(resolve => {
            resolveAdd = resolve
        }))

        const first = addPOIToLibrary(poi)
        const second = addPOIToLibrary(poi.id)
        expect(addTemporaryPOIToLibrary).toHaveBeenCalledOnce()
        expect(toastSuccess).not.toHaveBeenCalled()
        resolveAdd({status: 'added', poi})

        await expect(Promise.all([first, second])).resolves.toEqual([
            {status: 'added', poi},
            {status: 'added', poi},
        ])
        expect(hideGeocodingPOIAddOverlay).toHaveBeenCalledWith(poi.id)
        expect(toastSuccess).toHaveBeenCalledOnce()
        expect(toastSuccess).toHaveBeenCalledWith({caption: 'POI added to library.', text: 'Paris'}, 8 * SECOND)
        expect(openPOIEditor).toHaveBeenCalledOnce()
    })

    it('shows a warning for a nearby saved POI without showing success', async () => {
        const nearbyPOI = {id: 'saved-nearby', title: 'Nearby'}
        addTemporaryPOIToLibrary.mockResolvedValue({
            status: 'duplicate',
            poi: {id: 'temporary-library-poi'},
            nearbyPOI,
        })

        await addPOIToLibrary('temporary-library-poi')

        expect(showPOICreationDuplicateToast).toHaveBeenCalledWith(nearbyPOI)
        expect(toastSuccess).not.toHaveBeenCalled()
        expect(openPOIEditor).not.toHaveBeenCalled()
    })

    it('keeps a failed temporary POI recoverable and reports no success', async () => {
        addTemporaryPOIToLibrary.mockRejectedValue(new Error('storage unavailable'))
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(addPOIToLibrary('temporary-library-poi')).resolves.toMatchObject({status: 'failed'})

        expect(toastError).toHaveBeenCalledWith({
            caption: 'POI not saved.',
            text: 'The POI could not be saved to your library. It remains temporary on the map; try Add again.',
        })
        expect(toastSuccess).not.toHaveBeenCalled()
        expect(openPOIEditor).not.toHaveBeenCalled()
        consoleError.mockRestore()
    })
})
