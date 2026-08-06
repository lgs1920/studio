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
 * Last modified: 2026-05-09
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

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
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
})
