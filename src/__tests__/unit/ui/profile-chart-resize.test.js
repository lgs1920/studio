/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profile-chart-resize.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-15
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {scheduleProfileChartResize} from '@Core/ui/ProfileChartResize'

describe('Profile chart resize scheduling', () => {
    let callbacks

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    /** Install controllable animation-frame callbacks for lifecycle assertions. */
    const stubAnimationFrames = () => {
        callbacks = new Map()
        vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
            callbacks.set(1, callback)
            return 1
        }))
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
    }

    it('does not resize after its effect cleanup even if a queued callback runs late', () => {
        stubAnimationFrames()
        const resize = vi.fn()
        const cancel = scheduleProfileChartResize({isDisposed: () => false}, resize)

        cancel()
        callbacks.get(1)()

        expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
        expect(resize).not.toHaveBeenCalled()
    })

    it('does not resize a chart that was disposed before the callback runs', () => {
        stubAnimationFrames()
        const resize = vi.fn()
        scheduleProfileChartResize({isDisposed: () => true}, resize)

        callbacks.get(1)()

        expect(resize).not.toHaveBeenCalled()
    })

    it('resizes a live chart on the scheduled animation frame', () => {
        stubAnimationFrames()
        const resize = vi.fn()
        scheduleProfileChartResize({isDisposed: () => false}, resize)

        callbacks.get(1)()

        expect(resize).toHaveBeenCalledOnce()
    })
})
