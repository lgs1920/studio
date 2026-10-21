/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-selection.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-21
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {buildDisplayedCorrectionPointSelection} from '../../../components/MainUI/FixPathEditorSelection'

describe('Fix Path global point selection', () => {
    it('selects removed points when they are the only visible points', () => {
        const correction = {
            id: 'section-1',
            trackSlug: 'track-1',
            controlPoints: [
                {id: 'removed-1', removed: true},
                {id: 'erased-1', erased: true},
                {id: 'removed-2', removed: true},
            ],
        }

        const selectedPoints = buildDisplayedCorrectionPointSelection(correction, [])

        expect(selectedPoints).toEqual([
            {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'removed-1'},
            {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'removed-2'},
        ])
        expect(buildDisplayedCorrectionPointSelection(correction, selectedPoints)).toEqual([])
    })

    it('does nothing when the correction has no visible points', () => {
        expect(buildDisplayedCorrectionPointSelection({controlPoints: [{id: 'erased', erased: true}]}, [])).toBeNull()
    })
})
