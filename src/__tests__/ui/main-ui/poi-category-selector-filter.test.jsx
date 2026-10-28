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
    WaSelect: ({label, children, ...props}) => (
        <div data-testid="category-select" data-label={label} {...props}>{children}</div>
    ),
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

    it('keeps the category label on the select row and puts exclusion on its own row', () => {
        const {container} = render(
            <MapPOICategorySelectorFilter
                exclude={false}
                handleCategories={vi.fn()}
                handleExclusion={vi.fn()}
            />,
        )
        const select = screen.getByTestId('category-select')
        const exclusion = screen.getByTestId('exclude-switch')

        expect(select.dataset.label).toBe('By Categories')
        expect(exclusion.closest('.map-poi-category-exclusion')).not.toBeNull()
        expect(container.querySelector('.map-poi-category-filter')).toBeNull()
    })
})
