/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: theme-selector.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-24
 * Last modified on: 2026-07-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it, vi } from 'vitest'
import { attachMediaQueryChangeListener } from '@Utils/mediaQuery'

describe('attachMediaQueryChangeListener', () => {
    it('uses addEventListener when the media query list supports the modern API', () => {
        const callback = vi.fn()
        const mediaQuery = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }

        const cleanup = attachMediaQueryChangeListener(mediaQuery, callback)

        expect(mediaQuery.addEventListener).toHaveBeenCalledWith('change', callback)

        cleanup()

        expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', callback)
    })

    it('falls back to addListener and removeListener for legacy Safari support', () => {
        const callback = vi.fn()
        const mediaQuery = {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        }

        const cleanup = attachMediaQueryChangeListener(mediaQuery, callback)

        expect(mediaQuery.addListener).toHaveBeenCalledWith(callback)

        cleanup()

        expect(mediaQuery.removeListener).toHaveBeenCalledWith(callback)
    })
})
