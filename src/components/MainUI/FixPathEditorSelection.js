/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FixPathEditorSelection.js
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

/** Build the next global selection for the correction points shown in the editor. */
export const buildDisplayedCorrectionPointSelection = (correction, selectedControlPoints) => {
    if (!correction) return null

    const selectablePoints = (correction.controlPoints ?? []).filter(point => point.erased !== true)
    if (selectablePoints.length === 0) return null

    const selectedPoints = selectedControlPoints ?? []
    const allSelected = selectablePoints.every(point => selectedPoints.some(selected => (
        selected.trackSlug === correction.trackSlug
        && selected.correctionId === correction.id
        && selected.controlPointId === point.id
    )))

    return allSelected
        ? []
        : selectablePoints.map(point => ({
            trackSlug: correction.trackSlug,
            correctionId: correction.id,
            controlPointId: point.id,
        }))
}
