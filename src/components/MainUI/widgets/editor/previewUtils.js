/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: previewUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-30
 * Last modified: 2026-01-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const getPreviewChartSize = ({containerWidth, containerHeight, ratio, scale = 0.8}) => {
    if (!Number.isFinite(ratio) || ratio <= 0) {
        return null
    }
    if (!Number.isFinite(containerWidth) || !Number.isFinite(containerHeight) || containerWidth <= 0 || containerHeight <= 0) {
        return null
    }

    const maxWidth = containerWidth * scale
    const maxHeight = containerHeight * scale
    if (maxWidth <= 0 || maxHeight <= 0) {
        return null
    }

    let width = maxWidth
    let height = width / ratio
    if (height > maxHeight) {
        height = maxHeight
        width = height * ratio
    }

    return {width, height}
}
