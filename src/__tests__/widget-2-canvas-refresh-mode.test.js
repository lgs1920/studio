/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-2-canvas-refresh-mode.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-09
 * Last modified: 2026-06-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget2Canvas } from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Widget2Canvas refresh modes', () => {
    let target = null
    let child = null
    let mirror = null
    let rafCallbacks = []
    let canvasContext = null

    const flushMicrotasks = async () => {
        await Promise.resolve()
        await Promise.resolve()
    }

    beforeEach(() => {
        target = document.createElement('div')
        child = document.createElement('div')
        target.appendChild(child)
        document.body.appendChild(target)

        rafCallbacks = []
        vi.stubGlobal('requestAnimationFrame', (callback) => {
            rafCallbacks.push(callback)
            return rafCallbacks.length
        })
        vi.stubGlobal('cancelAnimationFrame', () => {})
        canvasContext = {
            clearRect: vi.fn(),
            drawImage: vi.fn(),
            fillRect:  vi.fn(),
            strokeRect: vi.fn(),
            save:      vi.fn(),
            restore:   vi.fn(),
        }
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext)
    })

    afterEach(() => {
        mirror?.destroy?.()
        target?.remove?.()
        mirror = null
        target = null
        child = null
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
        rafCallbacks = []
        canvasContext = null
    })

    it('refreshes on DOM mutations by default', async () => {
        mirror = new Widget2Canvas(target)
        const refreshSpy = vi.spyOn(mirror, 'refresh').mockResolvedValue(undefined)

        await mirror.init()
        expect(refreshSpy).toHaveBeenCalledTimes(1)

        child.textContent = 'updated'
        await flushMicrotasks()
        expect(rafCallbacks).toHaveLength(1)

        await rafCallbacks.shift()(performance.now())
        await flushMicrotasks()

        expect(refreshSpy).toHaveBeenCalledTimes(2)
    })

    it('refreshes nested canvases continuously in live mode without snapshot refreshes', async () => {
        const chartCanvas = document.createElement('canvas')

        chartCanvas.width = 100
        chartCanvas.height = 50
        chartCanvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 50})
        target.appendChild(chartCanvas)
        target.style.backgroundColor = 'rgb(10, 20, 30)'
        target.style.border = '2px solid rgb(40, 50, 60)'
        Object.defineProperties(target, {
            offsetWidth:  {configurable: true, value: 100},
            offsetHeight: {configurable: true, value: 50},
        })
        target.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 50})

        mirror = new Widget2Canvas(target, {refreshMode: 'live'})
        const refreshSpy = vi.spyOn(mirror, 'refresh').mockResolvedValue(undefined)

        await mirror.init()
        expect(refreshSpy).not.toHaveBeenCalled()
        expect(rafCallbacks).toHaveLength(1)

        await rafCallbacks.shift()(performance.now())
        await flushMicrotasks()

        expect(refreshSpy).not.toHaveBeenCalled()
        expect(rafCallbacks).toHaveLength(1)

        await rafCallbacks.shift()(performance.now())
        await flushMicrotasks()

        expect(refreshSpy).not.toHaveBeenCalled()
        expect(canvasContext.fillRect).toHaveBeenCalled()
        expect(canvasContext.drawImage).toHaveBeenCalled()
    })
})
