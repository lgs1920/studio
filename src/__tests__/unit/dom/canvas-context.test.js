import {describe, expect, it} from 'vitest'

describe('jsdom canvas setup', () => {
    it('provides a native 2D context through the canvas package', () => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        expect(context).not.toBeNull()
        expect(context.constructor.name).toBe('CanvasRenderingContext2D')
    })
})
