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

