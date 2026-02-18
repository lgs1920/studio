/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-18
 * Last modified: 2026-02-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetPreview.jsx
 *
 ******************************************************************************/

import { ProfileChart }                               from './ProfileChart'
import { getPreviewChartSize }                        from '@Components/MainUI/widgets/editor/previewUtils'
import { DISTANCE, ELEVATION, POINT, TIME }           from '@Core/ui/Profiler'
import { useLayoutEffect, useRef, useState, useMemo } from 'react'
import { useSnapshot }                                from 'valtio'

/**
 * Renders a visual preview for the Profile Widget.
 * Ensures scale and tick consistency by mirroring the Editor logic.
 */
export const ProfileWidgetPreview = ({entity}) => {
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    const $profile = lgs.stores.main.components.profile
    const profile = useSnapshot($profile)

    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem)

    const _preview = useRef(null)
    const [previewSize, setPreviewSize] = useState({width: 0, height: 0})

    // Fetch real data to compute identical bounds as the main chart
    const realData = useMemo(() => __.ui.profiler?.prepareData(), [profile.key, unitSystem.current])
    const previewColor = useMemo(() => realData?.options?.[0]?.color ?? '#3b82f6', [realData])

    /**
     * Compute axis boundaries by scanning the dataset.
     * This is essential for ECharts to apply the same 'yFloor' logic.
     */
    const previewBounds = useMemo(() => {
        if (!realData?.dataset?.length) {
            return {x: {min: 0, max: 2}, y: {min: 100, max: 260}}
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

        realData.dataset.forEach((dataset) => {
            dataset.source.forEach((row) => {
                const x = row?.[0], y = row?.[1]
                if (typeof x === 'number') {
                    minX = Math.min(minX, x)
                    maxX = Math.max(maxX, x)
                }
                if (typeof y === 'number') {
                    minY = Math.min(minY, y)
                    maxY = Math.max(maxY, y)
                }
            })
        })

        const round = (v) => Math.round(v * 100) / 100
        return {
            x: {min: round(minX === Infinity ? 0 : minX), max: round(maxX === -Infinity ? 2 : maxX)},
            y: {min: round(minY === Infinity ? 100 : minY), max: round(maxY === -Infinity ? 260 : maxY)},
        }
    }, [realData])

    /**
     * Restoration of the original 6-point distribution.
     * Using the exact same range calculations as ProfileWidgetEditor.
     */
    const previewData = useMemo(() => {
        const currentUnit = unitSystem.current
        const {x: bX, y: bY} = previewBounds
        const rangeX = bX.max - bX.min
        const rangeY = bY.max - bY.min

        const points = [
            {dist: bX.min, elev: bY.min},                             // 1. Starts at the floor
            {dist: bX.min + (bX.max - bX.min) * 0.2, elev: bY.max},    // 2. Hits the ceiling (Max Y)
            {dist: bX.min + (bX.max - bX.min) * 0.4, elev: bY.min + (bY.max - bY.min) * 0.4},
            {dist: bX.min + (bX.max - bX.min) * 0.6, elev: bY.max * 0.9},
            {dist: bX.min + (bX.max - bX.min) * 0.8, elev: bY.min + (bY.max - bY.min) * 0.4},
            {dist: bX.max, elev: bY.min},     // 6. Ends at Max X
        ]
        return {
            legend:     {data: ['Preview']},
            dataset:    [
                {
                    id:     'preview-track',
                    source: points.map(p => ([
                        p.dist,
                        p.elev,
                        null,
                        {altitude: p.elev},
                        currentUnit,
                    ])),
                },
            ],
            options:    [
                {
                    color:   previewColor,
                    name:    'Preview',
                    dataset: 'preview-track',
                },
            ],
            axisNames:  {x: '', y: ''},
            dimensions: [DISTANCE, ELEVATION, TIME, POINT],
            unitSystem: currentUnit,
            previewBounds,
        }
    }, [unitSystem.current, previewColor, previewBounds])

    useLayoutEffect(() => {
        if (!_preview.current) {
            return
        }

        const updateSize = () => {
            const rect = _preview.current.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
                setPreviewSize({width: rect.width, height: rect.height})
            }
        }

        updateSize()
        const _observer = new ResizeObserver(updateSize)
        _observer.observe(_preview.current)
        return () => _observer.disconnect()
    }, [])

    const chartSize = useMemo(() => getPreviewChartSize({
                                                            containerWidth:  previewSize.width,
                                                            containerHeight: previewSize.height,
                                                            ratio:           profile.width / profile.height || 16 / 9,
                                                            scale:           0.8,
                                                        }), [previewSize, profile.width, profile.height])

    const previewBg = widget.currentSnapshot?.image || null

    // Height 100% removed as requested
    const previewStyle = {
        '--lgs-profile-preview-bg': previewBg ? `url(${previewBg})` : 'none',
        width:                      '100%',
        display:                    'flex',
        alignItems:                 'center',
        justifyContent:             'center',
        position:                   'relative',
        backgroundImage:            'var(--lgs-profile-preview-bg)',
        backgroundSize:             'cover',
        backgroundPosition:         'center',
    }

    return (
        <div className="profile-widget-preview-surface" ref={_preview} style={previewStyle}>
            {chartSize && (
                <div style={{width: `${chartSize.width}px`, height: `${chartSize.height}px`, position: 'absolute'}}>
                    <ProfileChart
                        preview
                        data={previewData}
                        id={entity}
                        height={chartSize.height}
                        width={chartSize.width}
                    />
                </div>
            )}
        </div>
    )
}