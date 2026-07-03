/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-09
 * Last modified: 2026-06-09
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
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                from 'valtio'

/**
 * Renders a visual preview for the Profile Widget.
 * Ensures scale and tick consistency by mirroring the Editor logic.
 */
export const ProfileWidgetPreview = ({entity}) => {
    const $unitSystem = lgs.settings.unitSystem
    const currentUnit = useSnapshot($unitSystem).current
    const profile = useSnapshot(lgs.stores.main.components.profile)
    const replaySettings = useSnapshot(lgs.settings.ui.replay)
    const widgetListSnapshot = useSnapshot(lgs.stores.ui.widget.list)
    const widgetConfig = __.ui.widgetManager.getWidgetConfig?.(entity)
    const widgetDimensions = widgetListSnapshot.get(entity)?.dimensions ?? widgetConfig?.dimensions ?? null

    const _preview = useRef(null)
    const [previewSize, setPreviewSize] = useState({width: 0, height: 0})

    // Reuse the exact same dataset as the live profile widget.
    const realData = __.ui.profiler?.prepareData()
    const previewChartKey = [
        entity,
        currentUnit,
        profile.key,
        replaySettings.profileInfo?.useTrackStyle === true ? 'track-style' : 'track-color',
        replaySettings.profileInfo?.color ?? '',
    ].join(':')

    const previewRatio = useMemo(() => {
        const width = Number(widgetDimensions?.width)
        const height = Number(widgetDimensions?.height)
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            return width / height
        }

        const ratio = widgetListSnapshot.get(entity)?.ratio
                     ?? widgetConfig?.ratio
                     ?? lgs.configuration?.widgetRatio
        if (!ratio) {
            return 16 / 9
        }

        if (typeof ratio === 'object') {
            const aspectRatio = Number(ratio.aspectRatio)
            if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
                return aspectRatio
            }

            const width = Number(ratio.width)
            const height = Number(ratio.height)
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                return width / height
            }
        }

        const preset = lgs.configuration?.videoFormats?.find?.(item => item.value === ratio || item.value === ratio?.value)
        return Number.isFinite(Number(preset?.aspectRatio)) && Number(preset.aspectRatio) > 0
               ? Number(preset.aspectRatio)
               : 16 / 9
    }, [entity, widgetConfig?.ratio, widgetDimensions?.width, widgetDimensions?.height, widgetListSnapshot])

    const previewChartSize = useMemo(() => {
        const chartSize = getPreviewChartSize({
            containerWidth: previewSize.width,
            containerHeight: previewSize.height,
            ratio: previewRatio,
            scale: 0.8,
        })
        if (!chartSize) {
            return {width: 0, height: 0}
        }
        return {
            width:  Math.max(1, Math.round(chartSize.width)),
            height: Math.max(1, Math.round(chartSize.height)),
        }
    }, [previewRatio, previewSize.height, previewSize.width])

    useLayoutEffect(() => {
        if (!_preview.current) {
            return
        }

        let raf1 = 0
        let raf2 = 0
        const updateSize = () => {
            const element = _preview.current
            if (!element) {
                return
            }
            const rect = element.getBoundingClientRect()
            const styles = window.getComputedStyle(element)
            const horizontalPadding = (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0)
            const verticalPadding = (Number.parseFloat(styles.paddingTop) || 0) + (Number.parseFloat(styles.paddingBottom) || 0)
            const width = rect.width - horizontalPadding
            const height = rect.height - verticalPadding

            if (width > 0 && height > 0) {
                setPreviewSize({width, height})
            }
        }

        updateSize()
        const _observer = new ResizeObserver(updateSize)
        _observer.observe(_preview.current)
        raf1 = requestAnimationFrame(() => {
            updateSize()
            raf2 = requestAnimationFrame(updateSize)
        })
        return () => {
            if (raf1) {
                cancelAnimationFrame(raf1)
            }
            if (raf2) {
                cancelAnimationFrame(raf2)
            }
            _observer.disconnect()
        }
    }, [])

    const previewStyle = {
        width:                      '100%',
        height: '100%',
        display:                    'flex',
        alignItems:                 'center',
        justifyContent:             'center',
        position:                   'relative',
        background: 'transparent',
    }

    return (
        <div className="profile-widget-preview-surface" ref={_preview} style={previewStyle}
             data-unit-system={currentUnit}>
            {previewChartSize.width > 0 && previewChartSize.height > 0 && realData && (
                <div style={{
                    width:            `${previewChartSize.width}px`,
                    height:           `${previewChartSize.height}px`,
                    position:         'relative',
                    display:          'flex',
                    alignItems:       'center',
                    justifyContent:   'center',
                }}>
                    <ProfileChart
                        key={previewChartKey}
                        preview
                        data={realData}
                        id={entity}
                        height={previewChartSize.height}
                        width={previewChartSize.width}
                    />
                </div>
            )}
        </div>
    )
}
