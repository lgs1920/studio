/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: file-utils.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-17
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileUtils } from '@Utils/FileUtils'

describe('FileUtils.readFileAsTextAsync', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reads through an object URL after local readers fail on desktop', async () => {
        const file = {name: 'track.gpx'}
        const objectUrl = 'blob:track'
        const fetchResponse = {
            ok:   true,
            text: vi.fn().mockResolvedValue('<gpx/>'),
        }

        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => objectUrl),
            revokeObjectURL: vi.fn(),
        })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchResponse))
        vi.stubGlobal('FileReader', class {
            readAsText() {
                this.onerror()
            }

            readAsArrayBuffer() {
                this.onerror()
            }

            error = new Error('FileReader failed')
        })

        await expect(FileUtils.readFileAsTextAsync(file)).resolves.toBe('<gpx/>')
        expect(fetch).toHaveBeenCalledWith(objectUrl)
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl)
    })

    it('uses the Blob text API when it is available', async () => {
        const file = {
            text: vi.fn().mockResolvedValue('<gpx/>'),
        }

        vi.stubGlobal('URL', {})

        await expect(FileUtils.readFileAsTextAsync(file)).resolves.toBe('<gpx/>')
        expect(file.text).toHaveBeenCalledTimes(1)
    })

    it('decodes the ArrayBuffer API when text readers fail', async () => {
        const file = {
            text:        vi.fn().mockRejectedValue(new Error('Blob text failed')),
            arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('<gpx/>').buffer),
        }

        vi.stubGlobal('URL', {})
        vi.stubGlobal('FileReader', class {
            readAsText() {
                this.onerror()
            }

            error = new Error('FileReader text failed')
        })

        await expect(FileUtils.readFileAsTextAsync(file)).resolves.toBe('<gpx/>')
        expect(file.arrayBuffer).toHaveBeenCalledTimes(1)
    })

    it('falls back to FileReader when the Blob text API fails', async () => {
        const file = {
            text: vi.fn().mockRejectedValue(new Error('Blob text failed')),
        }
        const reader = {
            onload: null,
            onerror: null,
            result: '<gpx/>',
            readAsText: vi.fn(() => reader.onload()),
        }

        vi.stubGlobal('URL', {})
        vi.stubGlobal('FileReader', class {
            constructor() {
                return reader
            }
        })

        await expect(FileUtils.readFileAsTextAsync(file)).resolves.toBe('<gpx/>')
        expect(reader.readAsText).toHaveBeenCalledWith(file)
    })

    it('keeps every read error when the Android file provider is unavailable', async () => {
        const textError = new Error('Blob text failed')
        const readerError = new DOMException(
            'A requested file or directory could not be found at the time an operation was processed.',
            'NotFoundError',
        )
        const file = {
            text:        vi.fn().mockRejectedValue(textError),
            arrayBuffer: vi.fn().mockRejectedValue(readerError),
        }
        const reader = {
            onload: null,
            onerror: null,
            result: null,
            readAsText: vi.fn(() => reader.onerror()),
            readAsArrayBuffer: vi.fn(() => reader.onerror()),
            error: readerError,
        }

        vi.stubGlobal('navigator', {userAgent: 'Mozilla/5.0 (Linux; Android 10) Chrome/151.0.0.0'})
        vi.stubGlobal('URL', {})
        vi.stubGlobal('FileReader', class {
            constructor() {
                return reader
            }
        })

        const error = await FileUtils.readFileAsTextAsync(file).catch(caughtError => caughtError)

        expect(error.name).toBe('NotFoundError')
        expect(error.cause).toBe(readerError)
        expect(error.readAttempts).toEqual([
            expect.objectContaining({strategy: 'file.text', name: 'Error'}),
            expect.objectContaining({strategy: 'FileReader.readAsText', name: 'NotFoundError'}),
            expect.objectContaining({strategy: 'file.arrayBuffer', name: 'NotFoundError'}),
            expect.objectContaining({strategy: 'FileReader.readAsArrayBuffer', name: 'NotFoundError'}),
        ])
    })
})

describe('FileUtils.readFileAsArrayBufferAsync', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('returns the original bytes without text decoding', async () => {
        const sourceBytes = new Uint8Array([0, 46, 70, 73, 84, 255])
        const file = {arrayBuffer: vi.fn().mockResolvedValue(sourceBytes.buffer)}

        await expect(FileUtils.readFileAsArrayBufferAsync(file)).resolves.toBe(sourceBytes.buffer)
        expect(file.arrayBuffer).toHaveBeenCalledTimes(1)
    })

    it('falls back to FileReader when the Blob API fails', async () => {
        const sourceBytes = new Uint8Array([0, 46, 70, 73, 84, 255])
        const file = {arrayBuffer: vi.fn().mockRejectedValue(new Error('Blob read failed'))}
        const reader = {
            onload: null,
            onerror: null,
            result: sourceBytes.buffer,
            readAsArrayBuffer: vi.fn(() => reader.onload()),
        }

        vi.stubGlobal('URL', {})
        vi.stubGlobal('FileReader', class {
            constructor() {
                return reader
            }
        })

        const content = await FileUtils.readFileAsArrayBufferAsync(file)
        expect(Array.from(new Uint8Array(content))).toEqual(Array.from(sourceBytes))
        expect(reader.readAsArrayBuffer).toHaveBeenCalledWith(file)
    })
})
