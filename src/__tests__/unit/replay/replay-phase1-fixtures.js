/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-phase1-fixtures.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-07-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Shared builders for journey replay tests.
 */

export const makeTrack = ({
                              slug,
                              visible = true,
                              coordinates,
                              type = 'LineString',
                              times,
                              metrics,
                          }) => ({
    slug,
    visible,
    hasTime: Boolean(times),
    metrics: metrics ?? {},
    content: {
        type:       'Feature',
        properties: times ? {
            coordinateProperties: {times},
        } : {},
        geometry:   {
            type,
            coordinates,
        },
    },
})

export const makeJourney = tracks => ({
    slug:   'journey#gpx',
    tracks: new Map(tracks.map(track => [track.slug, track])),
})

