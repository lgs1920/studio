import { getNextTextWidgetPosition, resetTextWidgetPositionSequence } from '@Components/Text/textWidgetPosition'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('text widget creation positions', () => {
    beforeEach(() => {
        resetTextWidgetPositionSequence()
    })

    afterEach(() => {
        resetTextWidgetPositionSequence()
    })

    it('increments the horizontal and vertical position by five percent', () => {
        expect(getNextTextWidgetPosition(1)).toMatchObject({left: '20%', top: '20%', attachTo: 'top-left'})
        expect(getNextTextWidgetPosition(2)).toMatchObject({left: '25%', top: '25%', attachTo: 'top-left'})
        expect(getNextTextWidgetPosition(3)).toMatchObject({left: '30%', top: '30%', attachTo: 'top-left'})
    })

    it('restarts at twenty percent after ten creations', () => {
        for (let index = 0; index < 10; index += 1) {
            getNextTextWidgetPosition(index + 1)
        }

        expect(getNextTextWidgetPosition(11)).toMatchObject({left: '20%', top: '20%'})
    })

    it('restarts at twenty percent when the previous creation is at least two minutes old', () => {
        expect(getNextTextWidgetPosition(1000)).toMatchObject({left: '20%', top: '20%'})
        expect(getNextTextWidgetPosition(2000)).toMatchObject({left: '25%', top: '25%'})

        expect(getNextTextWidgetPosition(122000)).toMatchObject({left: '20%', top: '20%'})
    })
})
