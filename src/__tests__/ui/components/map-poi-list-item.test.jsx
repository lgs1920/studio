/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-poi-list-item.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render, waitFor }                        from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                                           from 'valtio'
import { proxyMap }                                        from 'valtio/utils'
import { useEffect }                                       from 'react'

vi.mock('@Components/MainUI/MapPOI/MapPOIEditContent', () => ({
    MapPOIEditContent: ({poi}) => <div>{poi}</div>,
}))

vi.mock('@Components/MainUI/MapPOI/MapPOISummary', () => ({
    MapPOISummary: ({poi}) => <div>{poi}</div>,
}))

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaDetails: ({children, open, onWaAfterShow, ...props}) => {
        useEffect(() => {
            if (open) {
                onWaAfterShow?.()
            }
        }, [open, onWaAfterShow])

        return <div data-open={open ? 'true' : 'false'} {...props}>{children}</div>
    },
    WaIcon:    () => <span/>,
}))

import { MapPOIListItem } from '@Components/MainUI/MapPOI/MapPOIListItem'

describe('MapPOIListItem', () => {
    let scrollIntoViewSpy

    beforeEach(() => {
        scrollIntoViewSpy = vi.fn()
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value:        scrollIntoViewSpy,
        })

        globalThis.lgs = {
            stores: {
                main: {
                    components: {
                        pois: proxy({
                                        current:  'poi-2',
                                        bulkList: proxyMap(),
                                        list:     proxyMap([
                                                               ['poi-2', {id: 'poi-2', title: 'Bravo', visible: true}],
                                                           ]),
                                    }),
                    },
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
    })

    it('scrolls the current POI item into view after it becomes active', async () => {
        render(<MapPOIListItem id="poi-2" canSelect={false}/>)

        await waitFor(() => {
            expect(scrollIntoViewSpy).toHaveBeenCalledWith({behavior: 'smooth', block: 'nearest'})
        })
    })

    it('keeps the bulk-selection checkbox outside the details so it can align with the summary title', () => {
        const {container} = render(<MapPOIListItem id="poi-2" canSelect/>)
        const wrapper = container.querySelector('.edit-map-poi-item-wrapper')
        const details = container.querySelector('.edit-map-poi-item')
        const checkbox = container.querySelector('.map-poi-item-checkbox')

        expect(checkbox.parentElement).toBe(wrapper)
        expect(details.parentElement).toBe(wrapper)
        expect(checkbox.nextElementSibling).toBe(details)
    })
})
