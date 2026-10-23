/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: time-zone-utils.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {Settings} from 'luxon'
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest'
import {
    formatTimestampAtCoordinates,
    formatTimestampInTimeZone,
    normalizeCoordinates,
    parseTimestampAsInstant,
    resolveTimeZone,
} from '@Utils/TimeZoneUtils'
import {formatDateTimeParts, journeyDateLabels} from '@Utils/ExportAsReport/format'

const defaultZone = Settings.defaultZone
const require = createRequire(import.meta.url)
const wasmBytes = readFileSync(require.resolve('tzf-wasm/tzf_wasm_bg.wasm'))

beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(wasmBytes, {
        headers: {'Content-Type': 'application/wasm'},
    })))
})

afterEach(() => {
    Settings.defaultZone = defaultZone
    vi.unstubAllGlobals()
})

describe('TimeZoneUtils', () => {
    it('resolves each coordinate to its IANA zone instead of using the browser zone', async () => {
        Settings.defaultZone = 'America/Los_Angeles'

        const paris = await formatTimestampAtCoordinates(
            '2026-01-15T12:00:00Z',
            {longitude: 2.3522, latitude: 48.8566},
        )
        const newYork = await formatTimestampAtCoordinates(
            '2026-01-15T12:00:00Z',
            {longitude: -74.006, latitude: 40.7128},
        )

        expect(paris.timeZone).toBe('Europe/Paris')
        expect(paris.time).toMatch(/^1:00/)
        expect(newYork.timeZone).toBe('America/New_York')
        expect(newYork.time).toMatch(/^7:00/)
        expect(paris.timezoneFallback).toBe(false)
    })

    it('uses and labels UTC if coordinates are missing or the zone cannot be resolved', async () => {
        const missingCoordinates = await formatTimestampAtCoordinates('2026-01-15T12:00:00Z', null)
        const invalidZone = formatTimestampInTimeZone('2026-01-15T12:00:00Z', 'Invalid/Zone')

        expect(missingCoordinates.time).toMatch(/^12:00.*UTC$/)
        expect(missingCoordinates.timezoneFallback).toBe(true)
        expect(invalidZone.timezoneFallback).toBe(true)
        expect(invalidZone.time).toMatch(/UTC$/)
    })

    it('validates coordinates and interprets offsetless timestamps as UTC instants', async () => {
        expect(normalizeCoordinates({longitude: null, latitude: 45})).toBeNull()
        expect(normalizeCoordinates({longitude: 181, latitude: 45})).toBeNull()
        expect(await resolveTimeZone([2.3522, 48.8566])).toBe('Europe/Paris')
        expect(parseTimestampAsInstant('2026-01-15T12:00:00').toISO()).toBe('2026-01-15T12:00:00.000Z')
        expect(parseTimestampAsInstant('2026-01-15T12:00:00+02:00').toISO()).toBe('2026-01-15T10:00:00.000Z')
    })

    it('keeps exported journey dates in UTC regardless of the browser zone and track coordinates', () => {
        Settings.defaultZone = 'America/Los_Angeles'
        const date = {
            start: '2026-01-15T23:30:00Z',
            stop: '2026-01-16T00:30:00Z',
            startCoordinates: {longitude: 2.3522, latitude: 48.8566},
            stopCoordinates: {longitude: -74.006, latitude: 40.7128},
        }

        const parts = formatDateTimeParts(date)
        const labels = journeyDateLabels({getDate: () => date})

        expect(parts.date).toBe('January 15, 2026 - January 16, 2026')
        expect(parts.time.replaceAll('\u202f', ' ')).toBe('11:30 PM UTC - 12:30 AM UTC')
        expect(labels).toEqual(['January 15, 2026', 'January 16, 2026'])
    })
})
