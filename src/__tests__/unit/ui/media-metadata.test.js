/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: media-metadata.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import { normalizeMediabunnyMetadataTags } from '@Core/ui/screen-media-recorder/recorder/MediaMetadata'

describe('normalizeMediabunnyMetadataTags', () => {
    it('removes application-only metadata before MP4 muxing', () => {
        const date = new Date('2026-08-19T00:00:00.000Z')

        expect(normalizeMediabunnyMetadataTags({
            status: 'draft',
            artist: 'LGS1920',
            date,
            album: 'Your Adventures',
            publisher: 'LGS1920 Studio',
            encodedBy: 'Mediabunny',
            raw: {
                '©pub': 'LGS1920 Studio',
                '©too': 'Mediabunny',
            },
        })).toEqual({
            artist: 'LGS1920',
            date,
            album: 'Your Adventures',
            raw: {
                '©pub': 'LGS1920 Studio',
                '©too': 'Mediabunny',
            },
        })
    })

    it('returns empty tags for missing or invalid metadata values', () => {
        expect(normalizeMediabunnyMetadataTags()).toEqual({})
        expect(normalizeMediabunnyMetadataTags(null)).toEqual({})
        expect(normalizeMediabunnyMetadataTags([])).toEqual({})
    })
})
