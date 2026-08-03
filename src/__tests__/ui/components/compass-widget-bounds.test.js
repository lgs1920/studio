import { describe, expect, it } from 'vitest'

import { resolveCompassWidgetDimensions } from '@Components/MainUI/compass/CompassWidgetBounds'

describe('compass widget bounds', () => {
    it('preserves persisted dimensions until a resize is requested', () => {
        const config = {dimensions: {width: 180, height: 140}}

        expect(resolveCompassWidgetDimensions({
            config,
            styledWidth: 50,
            styledHeight: 50,
            fallbackWidth: 50,
            fallbackHeight: 50,
        })).toEqual({width: 180, height: 140})

        expect(resolveCompassWidgetDimensions({
            config,
            forceResize: true,
            styledWidth: 50,
            styledHeight: 50,
            fallbackWidth: 50,
            fallbackHeight: 50,
        })).toEqual({width: 50, height: 50})
    })
})
