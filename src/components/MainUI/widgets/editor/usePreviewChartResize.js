/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: usePreviewChartResize.js
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

import { useEffect } from 'react'

export const usePreviewChartResize = (chartRef, enabled, deps = []) => {
    useEffect(() => {
        if (!enabled || !chartRef?.current) {
            return
        }
        const chart = chartRef.current.getEchartsInstance?.()
        if (!chart) {
            return
        }

        let raf1 = 0
        let raf2 = 0
        raf1 = requestAnimationFrame(() => {
            chart.resize()
            raf2 = requestAnimationFrame(() => chart.resize())
        })

        return () => {
            if (raf1) {
                cancelAnimationFrame(raf1)
            }
            if (raf2) {
                cancelAnimationFrame(raf2)
            }
        }
        // oxlint-disable-next-line react/exhaustive-deps
    }, [enabled, chartRef, ...deps])
}
