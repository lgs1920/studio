/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileChartResize.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-15
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Schedule a chart resize while preventing work after effect cleanup or disposal.
 * @param {Object} chart - The ECharts instance to check before resizing.
 * @param {Function} resize - The resize operation to run on the next animation frame.
 * @returns {Function} Cleanup callback that cancels and invalidates the scheduled resize.
 */
export const scheduleProfileChartResize = (chart, resize) => {
    let active = true
    const frame = requestAnimationFrame(() => {
        if (!active || chart.isDisposed()) {
            return
        }

        resize()
    })

    return () => {
        active = false
        cancelAnimationFrame(frame)
    }
}
