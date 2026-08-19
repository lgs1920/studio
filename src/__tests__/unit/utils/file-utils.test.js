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
