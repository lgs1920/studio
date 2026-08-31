/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: logo-png.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-13
 * Last modified: 2026-08-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import fs                           from 'node:fs'
import path                         from 'node:path'
import {fileURLToPath}               from 'node:url'
import {inflateSync}                 from 'node:zlib'
import {describe, expect, it}        from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const logoDirectory = path.join(repoRoot, 'public/assets/logo')

/**
 * Reads the alpha bounds of an 8-bit RGBA PNG.
 *
 * @param {string} filePath - PNG file to inspect.
 * @returns {{width: number, height: number, minX: number, minY: number, maxX: number, maxY: number}} Alpha bounds.
 */
const readPngAlphaBounds = filePath => {
    const data = fs.readFileSync(filePath)
    let offset = 8
    let width = 0
    let height = 0
    const imageData = []

    while (offset < data.length) {
        const length = data.readUInt32BE(offset)
        const type = data.toString('ascii', offset + 4, offset + 8)
        const chunk = data.subarray(offset + 8, offset + 8 + length)

        if (type === 'IHDR') {
            width = chunk.readUInt32BE(0)
            height = chunk.readUInt32BE(4)
            expect(chunk[8]).toBe(8)
            expect(chunk[9]).toBe(6)
        }

        if (type === 'IDAT') {
            imageData.push(chunk)
        }

        offset += length + 12
    }

    const stride = width * 4
    const decoded = inflateSync(Buffer.concat(imageData))
    const previousRow = Buffer.alloc(stride)
    let cursor = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < height; y++) {
        const filter = decoded[cursor++]
        const row = Buffer.from(decoded.subarray(cursor, cursor + stride))
        cursor += stride

        for (let x = 0; x < stride; x++) {
            const left = x >= 4 ? row[x - 4] : 0
            const above = previousRow[x]
            const upperLeft = x >= 4 ? previousRow[x - 4] : 0

            if (filter === 1) row[x] = (row[x] + left) & 255
            if (filter === 2) row[x] = (row[x] + above) & 255
            if (filter === 3) row[x] = (row[x] + Math.floor((left + above) / 2)) & 255
            if (filter === 4) {
                const estimate = left + above - upperLeft
                const distanceLeft = Math.abs(estimate - left)
                const distanceAbove = Math.abs(estimate - above)
                const distanceUpperLeft = Math.abs(estimate - upperLeft)
                const predictor = distanceLeft <= distanceAbove && distanceLeft <= distanceUpperLeft
                                     ? left
                                     : distanceAbove <= distanceUpperLeft ? above : upperLeft

                row[x] = (row[x] + predictor) & 255
            }
        }

        for (let x = 0; x < width; x++) {
            if (row[x * 4 + 3] > 0) {
                minX = Math.min(minX, x)
                minY = Math.min(minY, y)
                maxX = Math.max(maxX, x)
                maxY = Math.max(maxY, y)
            }
        }

        row.copy(previousRow)
    }

    return {width, height, minX, minY, maxX, maxY}
}

describe('Generated logo PNGs', () => {
    it('keeps exactly 40 pixels of transparent safety margin around visible content', () => {
        const expectedDimensions = {
            'logo.png': [484, 485],
            'logo-horizontal.png': [1220, 485],
            'logo-vertical.png': [697, 695],
        }

        for (const [fileName, [width, height]] of Object.entries(expectedDimensions)) {
            const bounds = readPngAlphaBounds(path.join(logoDirectory, fileName))

            expect(bounds).toMatchObject({
                width,
                height,
                minX: 40,
                minY: 40,
                maxX: width - 41,
                maxY: height - 41,
            })
        }
    })
})
