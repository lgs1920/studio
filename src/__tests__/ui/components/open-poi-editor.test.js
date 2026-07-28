/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: open-poi-editor.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { openPOIEditor }                             from '@Components/MainUI/MapPOI/openPOIEditor'
import { JOURNEY_EDITOR_DRAWER, POIS_EDITOR_DRAWER } from '@Core/constants'
import { Utils }                                     from '@Editor/Utils'
import { beforeEach, describe, expect, it, vi }      from 'vitest'

describe('openPOIEditor', () => {
    const track = {
        slug:         'track#journey#001#main',
        addToContext: vi.fn(),
        addToEditor:  vi.fn(),
    }
    const journey = {
        slug:   'journey#001',
        tracks: new Map([[track.slug, track]]),
    }

    beforeEach(() => {
        track.addToContext.mockReset()
        track.addToEditor.mockReset()

        vi.restoreAllMocks()
        vi.spyOn(Utils, 'updateJourneyEditor').mockResolvedValue()
        vi.spyOn(Utils, 'renderTracksList').mockImplementation(() => {
        })
        vi.spyOn(Utils, 'renderTrackSettings').mockImplementation(() => {
        })

        globalThis.lgs = {
            theJourney:            null,
            theJourneyEditorProxy: {
                journey:        null,
                track:          null,
                poi:            null,
                activeTab:      null,
                showPOIsFilter: false,
            },
            stores:                {
                main: {
                    components: {
                        pois: {
                            current: null,
                            list:    new Map(),
                        },
                    },
                },
            },
            getJourneyByTrackSlug: vi.fn((slug) => slug === track.slug ? journey : null),
        }

        globalThis.__ = {
            ui: {
                drawerManager: {
                    open: vi.fn(),
                },
            },
        }
    })

    it('opens the POI editor drawer for a global POI and selects it', async () => {
        const poi = {id: 'poi-global', parent: null}
        lgs.stores.main.components.pois.list.set(poi.id, poi)

        await openPOIEditor(poi.id)

        expect(lgs.stores.main.components.pois.current).toBe(poi.id)
        expect(__.ui.drawerManager.open).toHaveBeenCalledWith(POIS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: poi.id,
            stacked: false,
            tab:    null,
        })
        expect(Utils.updateJourneyEditor).not.toHaveBeenCalled()
    })

    it('opens the journey editor on the POIs tab for a journey POI', async () => {
        const poi = {id: 'poi-journey', parent: track.slug}
        lgs.theJourney = journey
        lgs.theJourneyEditorProxy.journey = journey
        lgs.stores.main.components.pois.list.set(poi.id, poi)

        await openPOIEditor(poi.id)

        expect(lgs.stores.main.components.pois.current).toBe(poi.id)
        expect(lgs.theJourneyEditorProxy.track).toBe(track)
        expect(lgs.theJourneyEditorProxy.poi).toBe(poi.id)
        expect(lgs.theJourneyEditorProxy.activeTab).toBe('tab-pois')
        expect(lgs.theJourneyEditorProxy.showPOIsFilter).toBe(true)
        expect(track.addToContext).toHaveBeenCalledTimes(1)
        expect(track.addToEditor).toHaveBeenCalledTimes(1)
        expect(__.ui.drawerManager.open).toHaveBeenCalledWith(JOURNEY_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: poi.id,
            stacked: false,
            tab:    'tab-pois',
        })
    })

    it('loads the matching journey before opening a journey POI when needed', async () => {
        const poi = {id: 'poi-other-journey', parent: track.slug}
        lgs.stores.main.components.pois.list.set(poi.id, poi)

        await openPOIEditor(poi.id)

        expect(Utils.updateJourneyEditor).toHaveBeenCalledWith(journey.slug, {focus: false})
        expect(__.ui.drawerManager.open).toHaveBeenCalledWith(JOURNEY_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: poi.id,
            stacked: false,
            tab:    'tab-pois',
        })
    })
})
