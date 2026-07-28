/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: track-utils-color.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { afterEach, describe, expect, it } from 'vitest'
import { Color } from 'cesium'
import { TrackUtils } from '@Utils/cesium/TrackUtils'

describe('TrackUtils css color normalization', () => {
    const previousLgs = globalThis.lgs

    afterEach(() => {
        globalThis.lgs = previousLgs
    })

    it('accepts Cesium Color-like objects without calling fromCssColorString with an object', () => {
        const color = TrackUtils.cssColor({red: 1, green: 0.5, blue: 0, alpha: 0.25})

        expect(color).toBeInstanceOf(Color)
        expect(color.toCssColorString()).toBe('rgba(255,128,0,0.25)')
    })

    it('builds the track locator marker image when app colors are serialized objects', () => {
        globalThis.lgs = {
            colors: {
                poiDefault:           {red: 0, green: 0.25, blue: 1, alpha: 1},
                poiDefaultBackground: {red: 1, green: 1, blue: 1, alpha: 1},
            },
        }

        const image = TrackUtils.buildTrackLocatorMarkerImage({red: 255, green: 128, blue: 0, alpha: 1})

        expect(image.src).toContain('data:image/svg+xml')
        expect(decodeURIComponent(image.src)).toContain('rgb(255,128,0)')
    })

    it('skips unmatched data sources when restoring journey visibility', () => {
        const journey = {
            slug: 'journey#gpx',
            tracks: new Map([
                ['track#journey#gpx#main', {slug: 'track#journey#gpx#main', visible: true}],
            ]),
        }
        const journeySource = {name: journey.slug, show: false}
        const trackSource = {name: 'track#journey#gpx#main', show: false}
        const straySource = {name: 'replay#journey#gpx#ghost', show: true}

        globalThis.lgs = {
            viewer: {
                dataSources: {
                    length: 3,
                    get:      index => [journeySource, trackSource, straySource][index] ?? null,
                    getByName: () => [],
                },
            },
            settings: {
                widgets: {
                    'profile-widget': {
                        configuration: {
                            default: {show: false},
                        },
                    },
                },
            },
            stores: {
                main: {
                    canViewJourneyData: false,
                },
            },
        }

        expect(() => TrackUtils.updateJourneyVisibility(journey, true)).not.toThrow()
        expect(journeySource.show).toBe(true)
        expect(trackSource.show).toBe(true)
        expect(straySource.show).toBe(true)
    })
})
