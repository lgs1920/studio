/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: report-profile-rendering.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-30
 * Last modified: 2026-07-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it, vi } from 'vitest'
import { drawProfileDataset } from '@Utils/ExportAsReport/profile'

describe('report profile rendering', () => {
    it('renders the profile fill with a neutral gray color', () => {
        const context = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            set fillStyle(value) {
                this._fillStyle = value
            },
            get fillStyle() {
                return this._fillStyle
            },
            set strokeStyle(value) {
                this._strokeStyle = value
            },
            get strokeStyle() {
                return this._strokeStyle
            },
            set lineWidth(value) {
                this._lineWidth = value
            },
            get lineWidth() {
                return this._lineWidth
            },
            set lineJoin(value) {
                this._lineJoin = value
            },
            get lineJoin() {
                return this._lineJoin
            },
            set lineCap(value) {
                this._lineCap = value
            },
            get lineCap() {
                return this._lineCap
            },
        }

        drawProfileDataset(context, {
            points: [
                {distance: 0, elevation: 100},
                {distance: 10, elevation: 120},
                {distance: 20, elevation: 110},
            ],
            color: '#ff0000',
        }, {
            minDistance: 0,
            maxDistance: 20,
            minElevation: 90,
            maxElevation: 130,
        }, {
            x: 10,
            y: 10,
            width: 100,
            height: 50,
        })

        expect(context.fillStyle).toBe('rgba(172, 177, 185, 0.28)')
        expect(context.strokeStyle).toBe('#ff0000')
        expect(context.lineWidth).toBe(4)
    })
})
