/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-2-canvas-refresh-mode.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-09
 * Last modified: 2026-06-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {snapdomToCanvasMock} = vi.hoisted(() => ({
    snapdomToCanvasMock: vi.fn(async (element) => {
        const canvas = document.createElement('canvas')
        const rect = element?.getBoundingClientRect?.()
        const width = Math.max(1, Math.ceil(rect?.width ?? element?.offsetWidth ?? 1))
        const height = Math.max(1, Math.ceil(rect?.height ?? element?.offsetHeight ?? 1))

        canvas.width = width
        canvas.height = height
        return canvas
    }),
}))

vi.mock('@zumer/snapdom', () => ({
    snapdom: {
        toCanvas: snapdomToCanvasMock,
    },
}))

import { Widget2Canvas } from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'

describe('Widget2Canvas refresh modes', () => {
    let target = null
    let child = null
    let mirror = null
    let rafCallbacks = []
    let canvasContext = null

    const flushMicrotasks = async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
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
        snapdomToCanvasMock.mockClear()
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

    it('normalizes live canvas drawing against rendered transform scale', async () => {
        const chartCanvas = document.createElement('canvas')

        chartCanvas.width = 200
        chartCanvas.height = 100
        chartCanvas.getBoundingClientRect = () => ({left: 20, top: 10, width: 160, height: 80})
        target.appendChild(chartCanvas)
        Object.defineProperties(target, {
            offsetWidth:  {configurable: true, value: 100},
            offsetHeight: {configurable: true, value: 50},
        })
        target.getBoundingClientRect = () => ({left: 0, top: 0, width: 200, height: 100})

        mirror = new Widget2Canvas(target, {refreshMode: 'live', scale: 1})

        await mirror.init()
        await rafCallbacks.shift()?.(performance.now())
        await flushMicrotasks()

        const chartDrawCall = canvasContext.drawImage.mock.calls.find(call => call[0] === chartCanvas)
        expect(chartDrawCall?.[1]).toBe(10)
        expect(chartDrawCall?.[2]).toBe(5)
        expect(chartDrawCall?.[3]).toBe(80)
        expect(chartDrawCall?.[4]).toBe(40)
    })

    it('copies a canvas root directly instead of snapshotting it through snapdom', async () => {
        target?.remove?.()
        target = document.createElement('canvas')
        target.width = 180
        target.height = 90
        Object.defineProperties(target, {
            offsetWidth:  {configurable: true, value: 180},
            offsetHeight: {configurable: true, value: 90},
        })
        target.getBoundingClientRect = () => ({left: 0, top: 0, width: 180, height: 90})
        document.body.appendChild(target)

        mirror = new Widget2Canvas(target)
        await mirror.init()

        expect(snapdomToCanvasMock).not.toHaveBeenCalled()
        expect(canvasContext.drawImage.mock.calls.some(call => call[0] === target)).toBe(true)
    })

    it('passes capture exclusions to snapdom', async () => {
        mirror = new Widget2Canvas(target, {
            exclude:     ['[data-widget-capture="exclude"]'],
            excludeMode: 'remove',
        })

        await mirror.init()

        expect(snapdomToCanvasMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                exclude:     ['[data-widget-capture="exclude"]'],
                excludeMode: 'remove',
            }),
        )
    })

    it('reuses static widget zones and only re-renders dirty dynamic zones', async () => {
        target?.remove?.()
        target = document.createElement('div')
        target.className = 'static-widget-part'
        Object.defineProperties(target, {
            offsetWidth:  {configurable: true, value: 120},
            offsetHeight: {configurable: true, value: 40},
        })
        target.getBoundingClientRect = () => ({left: 0, top: 0, width: 120, height: 40})

        const staticLabel = document.createElement('div')
        staticLabel.textContent = 'Label'
        staticLabel.getBoundingClientRect = () => ({left: 0, top: 0, width: 60, height: 20})

        const dynamicValue = document.createElement('div')
        dynamicValue.textContent = '0'
        dynamicValue.className = 'dynamic-widget-part'
        dynamicValue.getBoundingClientRect = () => ({left: 60, top: 0, width: 20, height: 20})

        target.append(staticLabel, dynamicValue)
        document.body.appendChild(target)

        mirror = new Widget2Canvas(target, {scale: 1})
        await mirror.init()
        expect(snapdomToCanvasMock).toHaveBeenCalledTimes(2)
        expect(snapdomToCanvasMock.mock.calls[0][0]).not.toBe(target)
        expect(snapdomToCanvasMock.mock.calls[0][0].querySelector('.dynamic-widget-part')?.style.visibility).toBe('hidden')
        expect(snapdomToCanvasMock.mock.calls[1][0]).toBe(dynamicValue)

        dynamicValue.firstChild.nodeValue = '1'
        await flushMicrotasks()

        expect(rafCallbacks).toHaveLength(1)
        await rafCallbacks.shift()(performance.now())
        await flushMicrotasks()

        expect(snapdomToCanvasMock).toHaveBeenCalledTimes(3)
        expect(snapdomToCanvasMock.mock.calls[2][0]).toBe(dynamicValue)
    })

    it('captures the whole widget when visual effects must stay aligned', async () => {
        target?.remove?.()
        target = document.createElement('div')
        target.className = 'static-widget-part'
        Object.defineProperties(target, {
            offsetWidth:  {configurable: true, value: 120},
            offsetHeight: {configurable: true, value: 40},
        })
        target.getBoundingClientRect = () => ({left: 0, top: 0, width: 120, height: 40})

        const dynamicValue = document.createElement('div')
        dynamicValue.className = 'dynamic-widget-part'
        dynamicValue.textContent = '42'
        target.appendChild(dynamicValue)
        document.body.appendChild(target)

        mirror = new Widget2Canvas(target, {captureWholeWidget: true, scale: 1})
        await mirror.init()

        expect(snapdomToCanvasMock).toHaveBeenCalledTimes(1)
        expect(snapdomToCanvasMock).toHaveBeenCalledWith(target, expect.anything())
    })

    it('queues a fresh refresh while a refresh is already pending', async () => {
        let resolveSnapshot = null
        mirror = new Widget2Canvas(target, {widgetId: 'stats-widget#1'})

        await mirror.init()
        expect(Widget2Canvas.get('stats-widget#1')).toBe(mirror)
        expect(snapdomToCanvasMock).toHaveBeenCalledTimes(1)

        snapdomToCanvasMock.mockImplementationOnce(() => new Promise(resolve => {
            resolveSnapshot = () => {
                const canvas = document.createElement('canvas')
                canvas.width = 10
                canvas.height = 10
                resolve(canvas)
            }
        }))

        child.textContent = 'first update'
        await flushMicrotasks()
        expect(rafCallbacks).toHaveLength(1)

        rafCallbacks.shift()(performance.now())
        await flushMicrotasks()

        expect(mirror.requestRefresh({afterFrame: true})).toBe(true)
        expect(rafCallbacks).toHaveLength(0)

        resolveSnapshot()
        await flushMicrotasks()

        expect(rafCallbacks).toHaveLength(1)
        await rafCallbacks.shift()(performance.now())
        await flushMicrotasks()

        expect(snapdomToCanvasMock).toHaveBeenCalledTimes(3)
        expect(snapdomToCanvasMock.mock.calls[2][0]).toBe(target)
    })
})
