/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: canvas-context.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-28
 * Last modified: 2026-08-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'

describe('jsdom canvas setup', () => {
    it('provides a native 2D context through the canvas package', () => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        expect(context).not.toBeNull()
        expect(context.constructor.name).toBe('CanvasRenderingContext2D')
    })
})
