/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-filter.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import { filterAndSortPOIs } from '@Components/MainUI/MapPOI/filterAndSortPOIs'

describe('filterAndSortPOIs', () => {
    const list = new Map([
        ['global-summit', {id: 'global-summit', title: 'Global Summit', type: 'poi', category: 'summit'}],
        ['journey-falls', {id: 'journey-falls', title: 'Journey Falls', type: 'poi', category: 'waterfall', parent: 'track-a'}],
        ['other-summit', {id: 'other-summit', title: 'Other Summit', type: 'poi', category: 'summit', parent: 'track-b'}],
        ['nearby-summit', {id: 'nearby-summit', title: 'Nearby Summit', type: 'poi', category: 'summit', tooClose: true}],
    ])
    /** Resolves fixture track slugs to their parent journeys. */
    const getJourneyByTrackSlug = slug => ({slug: slug === 'track-a' ? 'journey-a' : 'journey-b'})

    it('filters on the POI category and limits journey entries to the active journey', () => {
        const ids = filterAndSortPOIs({
            onlyJourney: false,
            filterSettings: {global: true, journey: true, byCategories: ['summit']},
            list,
            journeySlug: 'journey-a',
            getJourneyByTrackSlug,
        })

        expect(ids).toEqual(['global-summit'])
        expect(ids.length).toBe(1)
    })

    it('supports category exclusion and counts the same POIs as the list', () => {
        const ids = filterAndSortPOIs({
            onlyJourney: true,
            filterSettings: {byCategories: ['summit'], exclude: true},
            list,
            journeySlug: 'journey-a',
            getJourneyByTrackSlug,
        })

        expect(ids).toEqual(['journey-falls'])
        expect(ids.length).toBe(1)
    })

    it('does not treat journey POIs as belonging to a journey when none is active', () => {
        const ids = filterAndSortPOIs({
            onlyJourney: false,
            filterSettings: {journey: true},
            list,
            journeySlug: null,
            getJourneyByTrackSlug,
        })

        expect(ids).toEqual([])
    })
})
