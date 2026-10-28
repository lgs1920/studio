/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-filtered-list.test.jsx
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

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

vi.mock('@Components/MainUI/MapPOI/MapPOIListItem', () => ({
    MapPOIListItem: ({id}) => <div data-testid="poi-list-item">{id}</div>,
}))

import { MapPOIFilteredList } from '@Components/MainUI/MapPOI/MapPOIFilteredList'

describe('MapPOIFilteredList', () => {
    beforeEach(() => {
        const pois = proxy({
            list: proxyMap([
                ['trailhead-1', {id: 'trailhead-1', title: 'Trailhead', type: 'poi', category: 'trailhead'}],
                ['other-1', {id: 'other-1', title: 'Other', type: 'poi', category: 'waterfall'}],
            ]),
            filtered: {global: proxyMap(), journey: proxyMap()},
        })

        globalThis.lgs = {
            stores: {
                main: {components: {pois}},
                ui: {drawers: proxy({open: 'poi-editor'})},
            },
            settings: {
                poi: proxy({filter: {
                    global:      true,
                    journey:     false,
                    byName:      '',
                    byCategories: ['trailhead'],
                    exclude:     false,
                    alphabetic:  true,
                    active:      true,
                }}),
            },
            mainProxy: proxy({theJourney: null}),
            getJourneyByTrackSlug: vi.fn(),
        }
    })

    afterEach(() => {
        cleanup()
    })

    it('renders items matching the selected category', () => {
        render(<MapPOIFilteredList/>)

        expect(screen.getAllByTestId('poi-list-item').map(item => item.textContent)).toEqual(['trailhead-1'])
    })
})
