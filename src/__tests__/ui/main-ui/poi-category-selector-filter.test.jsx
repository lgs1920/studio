/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-category-selector-filter.test.jsx
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

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon:   () => <span/>,
    WaOption: ({children}) => <div>{children}</div>,
    WaSelect: ({children, ...props}) => <div data-testid="category-select" {...props}>{children}</div>,
    WaSwitch: ({children, ...props}) => <div data-testid="exclude-switch" {...props}>{children}</div>,
}))

import { MapPOICategorySelectorFilter } from '@Components/MainUI/MapPOI/MapPOICategorySelectorFilter'

describe('MapPOICategorySelectorFilter', () => {
    beforeEach(() => {
        globalThis.lgs = {
            settings: {
                poi: proxy({filter: {byCategories: ['trailhead']}}),
            },
            stores: {
                main: {
                    components: {
                        pois: proxy({categories: proxyMap([['trailhead', {title: 'Trailhead'}]])}),
                    },
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
    })

    it('places the exclusion switch on the right side of the category label row', () => {
        const {container} = render(
            <MapPOICategorySelectorFilter
                exclude={false}
                handleCategories={vi.fn()}
                handleExclusion={vi.fn()}
            />,
        )
        const select = screen.getByTestId('category-select')
        const exclusion = screen.getByTestId('exclude-switch')
        const categoryLabel = screen.getByText('By Categories')

        expect(categoryLabel.closest('.map-poi-category-label-row')).not.toBeNull()
        expect(exclusion.closest('.map-poi-category-label-row')).toBe(categoryLabel.parentElement)
        expect(select.contains(categoryLabel)).toBe(true)
        expect(container.querySelector('.map-poi-category-exclusion')).toBeNull()
    })
})
