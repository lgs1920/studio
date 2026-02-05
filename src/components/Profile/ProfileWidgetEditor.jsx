/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-05
 * Last modified: 2026-02-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                                                             from '@Components/MainUI/LGSScrollbars'
import { getPreviewChartSize }                                                       from '@Components/MainUI/widgets/editor/previewUtils'
import { WIDGET_RADIUS }                                                             from '@Core/constants'
import { DISTANCE, ELEVATION, POINT, TIME }                                          from '@Core/ui/Profiler'
import {
    SlColorPicker, SlDivider, SlInput, SlOption, SlRange, SlSelect, SlSwitch,
}                                                                                    from '@shoelace-style/shoelace/dist/react'
import { colord }                                                                    from 'colord'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                               from 'valtio'
import { ProfileChart }                                                              from './ProfileChart'
import './style.css'

/**
 * Editor for the Profile Widget configuration using a plain Object
 * @param {Object} props
 * @param {string} props.entity - The unique ID of the widget
 * @returns {JSX.Element}
 */
export const ProfileWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['profile-widget'].configuration
    const configuration = useSnapshot($configuration)
    const $element = $configuration.elements?.[entity]
    const element = configuration.elements?.[entity]
    const widgetStore = useSnapshot(lgs.stores.ui.widget)
    const profileState = useSnapshot(lgs.stores.main.components.profile)
    const unitStore = useSnapshot(lgs.settings.unitSystem)
    const previewRef = useRef(null)
    const [previewSize, setPreviewSize] = useState({width: 0, height: 0})
    const [previewRenderReady, setPreviewRenderReady] = useState(false)

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const previewBg = widgetStore.currentSnapshot?.image || null
    const previewStyle = useMemo(() => ({
        '--lgs-profile-preview-bg': previewBg ? `url(${previewBg})` : 'none',
    }), [previewBg])

    const previewRatio = useMemo(() => {
        if (profileState.width > 0 && profileState.height > 0) {
            return profileState.width / profileState.height
        }
        if (previewSize.width > 0 && previewSize.height > 0) {
            return previewSize.width / previewSize.height
        }
        return 16 / 9
    }, [profileState.width, profileState.height, previewSize.width, previewSize.height])

    const previewChartSize = useMemo(() => {
        return getPreviewChartSize({
                                       containerWidth:  previewSize.width,
                                       containerHeight: previewSize.height,
                                       ratio:           previewRatio,
                                       scale:           0.8,
                                   })
    }, [previewSize.width, previewSize.height, previewRatio])

    useEffect(() => {
        if (previewChartSize && !previewRenderReady) {
            setPreviewRenderReady(true)
        }
    }, [previewChartSize, previewRenderReady])

    useLayoutEffect(() => {
        if (!previewRef.current) {
            return
        }
        const updateSize = () => {
            const rect = previewRef.current.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
                setPreviewSize(prev =>
                                   (prev.width === rect.width && prev.height === rect.height)
                                   ? prev
                                   : {width: rect.width, height: rect.height},
                )
            }
        }
        updateSize()
        const observer = new ResizeObserver(updateSize)
        observer.observe(previewRef.current)
        return () => observer.disconnect()
    }, [])

    const realData = useMemo(() => __.ui.profiler?.prepareData(), [profileState.key, unitStore.current])
    const previewColor = useMemo(() => realData?.options?.[0]?.color ?? '#3b82f6', [realData])

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

    const previewEndpoints = useMemo(() => {
        const firstDataset = realData?.dataset?.[0]
        const firstRow = firstDataset?.source?.[0]
        const lastRow = firstDataset?.source?.[firstDataset?.source?.length - 1]
        return {
            start: {x: firstRow?.[0], y: firstRow?.[1]},
            end:   {x: lastRow?.[0], y: lastRow?.[1]},
        }
    }, [realData])

    const previewData = useMemo(() => {
        const unitSystem = unitStore.current
        const {x: bX, y: bY} = previewBounds
        const rangeX = bX.max - bX.min
        const rangeY = bY.max - bY.min
        const points = [
            {distance: previewEndpoints.start.x ?? bX.min, elevation: previewEndpoints.start.y ?? bY.min},
            {distance: bX.min + rangeX * 0.18, elevation: bY.max},
            {distance: bX.min + rangeX * 0.36, elevation: bY.min + rangeY * 0.35},
            {distance: bX.min + rangeX * 0.52, elevation: bY.max - rangeY * 0.15},
            {distance: bX.min + rangeX * 0.72, elevation: bY.min + rangeY * 0.6},
            {distance: previewEndpoints.end.x ?? bX.max, elevation: previewEndpoints.end.y ?? bY.max},
        ]
        return {
            legend:    {data: ['Sample']},
            dataset:   [
                {
                    id:     'sample-track',
                    source: points.map(p => ([p.distance, p.elevation, null, {altitude: p.elevation}, unitSystem])),
                },
            ],
            options:   [{color: previewColor, name: 'Sample', dataset: 'sample-track'}],
            axisNames: {x: '', y: ''},
            dimensions: [DISTANCE, ELEVATION, TIME, POINT],
            unitSystem,
            previewBounds,
        }
    }, [unitStore.current, previewColor, previewBounds, previewEndpoints])

    useEffect(() => {
        if (!$configuration.elements) {
            $configuration.elements = {}
        }
        if (!$configuration.elements[entity]) {
            $configuration.elements[entity] = {...($configuration.user ?? $configuration.default)}
        }
    }, [entity, $configuration])

    const updateValue = useCallback((path, value) => {
        if (!$element) {
            return
        }
        const keys = path.split('.')
        let curr = $element
        for (let i = 0; i < keys.length - 1; i++) {
            if (!curr[keys[i]]) {
                curr[keys[i]] = {}
            }
            curr = curr[keys[i]]
        }
        curr[keys[keys.length - 1]] = value
    }, [$element])

    const getColor = useCallback((item, alpha = false) => {
        if (!item) {
            return 'transparent'
        }
        let colorStr = item.color
        if (colorStr.startsWith('--')) {
            colorStr = __.ui.css.getCSSVariable(colorStr)
        }
        const c = colord(colorStr)
        return (alpha ? c.alpha(item.opacity ?? 1) : c).toRgbString()
    }, [])

    if (!element) {
        return null
    }

    return (
        <div className="lgs-card profile-widget-editor" key={entity}>
            <div className="profile-widget-preview">
                <div className="profile-widget-preview-surface" ref={previewRef} style={previewStyle}>
                    <div className="profile-widget-preview-chart" style={previewChartSize ? {
                        width:  `${previewChartSize.width}px`,
                        height: `${previewChartSize.height}px`,
                    } : undefined}>
                        {previewChartSize && previewRenderReady && (
                            <ProfileChart preview data={previewData} id={entity}
                                          height={previewChartSize.height} width={previewChartSize.width}/>
                        )}
                    </div>
                </div>
            </div>

            <div className="profile-widget-editor-scroll">
                <LGSScrollbars>
                    <div className="lgs-widget-editor-controls-wrapper">

                        {/* Background */}
                        <SlSwitch align-right size="x-small" checked={element.background.show ?? false}
                                  onSlInput={(e) => updateValue('background.show', e.target.checked)}>
                            <label>{'Background'}</label>
                        </SlSwitch>

                        {element.background.show && (
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlColorPicker size="small" swatches={swatches}
                                                   value={getColor(element.background)}
                                                   onSlInput={(e) => updateValue('background.color', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    {'Blur'}&nbsp;
                                    <SlSwitch align-right size="x-small" checked={element.background.blur ?? false}
                                              onSlChange={(e) => updateValue('background.blur', e.target.checked)}/>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right tooltip="bottom"
                                             value={element.background.opacity ?? 0.5}
                                             onSlInput={(e) => updateValue('background.opacity', parseFloat(e.target.value))}/>
                                </div>
                            </div>
                        )}

                        <SlDivider/>

                        {/* Border */}
                        <SlSwitch align-right size="x-small" checked={element.border.show}
                                  onSlInput={(e) => updateValue('border.show', e.target.checked)}>
                            <span>{'Border'}</span>
                        </SlSwitch>

                        {element.border.show && (
                            <>
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">
                                        <SlColorPicker size="small" swatches={swatches}
                                                       value={getColor(element.border)}
                                                       onSlInput={(e) => updateValue('border.color', e.target.value)}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Width" min="1" max="10" step="0.5" align-right tooltip="bottom"
                                                 value={element.border.thickness ?? 1}
                                                 onSlInput={(e) => updateValue('border.thickness', parseFloat(e.target.value))}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right
                                                 tooltip="bottom"
                                                 value={element.border.opacity ?? 0.5}
                                                 onSlInput={(e) => updateValue('border.opacity', parseFloat(e.target.value))}/>
                                    </div>
                                </div>
                                <div className="drawer-horizontal-line">
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlSelect hoist size="small" label="Radius" align-right
                                                  style={{marginLeft: 'auto', width: '10rem'}}
                                                  value={element.border.radius ?? 'none'}
                                                  onSlChange={(e) => updateValue('border.radius', e.target.value)}>
                                            {[...WIDGET_RADIUS.entries()].map(([_key, _data]) => (
                                                <SlOption key={_key} value={_key}>{_data.name}</SlOption>
                                            ))}
                                        </SlSelect>
                                    </div>
                                </div>
                            </>
                        )}

                        <SlDivider/>

                        {/* Axis Configuration */}
                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-element xlarge-element">{'Distance:'}</div>
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    {'Axis'}&nbsp;
                                    <SlSwitch size="x-small" align-right checked={element.xAxis.main}
                                              onSlInput={(e) => updateValue('xAxis.main', e.target.checked)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    {'Grid'}&nbsp;
                                    <SlSwitch size="x-small" align-right checked={element.xAxis.second}
                                              onSlInput={(e) => updateValue('xAxis.second', e.target.checked)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    {'Labels'}&nbsp;
                                    <SlSwitch size="x-small" align-right checked={element.xAxis.labels}
                                              onSlInput={(e) => updateValue('xAxis.labels', e.target.checked)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    {'Units'}&nbsp;
                                    <SlSwitch size="x-small" align-right checked={element.xAxis.units}
                                              disabled={!element.xAxis.labels}
                                              onSlInput={(e) => updateValue('xAxis.units', e.target.checked)}/>
                                </div>
                            </div>
                        </div>

                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-element xlarge-element">{'Elevation:'}</div>
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    {'Axis'}&nbsp;
                                    <SlSwitch size="x-small" align-right checked={element.yAxis.main}
                                              onSlInput={(e) => updateValue('yAxis.main', e.target.checked)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    {'Grid'}&nbsp;
                                    <SlSwitch size="x-small" align-right checked={element.yAxis.second}
                                              onSlInput={(e) => updateValue('yAxis.second', e.target.checked)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    {'Labels'}&nbsp;
                                    <SlSwitch size="x-small" align-right checked={element.yAxis.labels}
                                              onSlInput={(e) => updateValue('yAxis.labels', e.target.checked)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    {'Units'}&nbsp;
                                    <SlSwitch size="x-small" align-right checked={element.yAxis.units}
                                              disabled={!element.yAxis.labels}
                                              onSlInput={(e) => updateValue('yAxis.units', e.target.checked)}/>
                                </div>
                            </div>
                        </div>

                        {/* Main Axis Details */}
                        {(element.xAxis.main || element.yAxis.main || element.xAxis.labels || element.yAxis.labels) && (
                            <>
                                <SlDivider/>
                                <div>{'Main'}</div>
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">
                                        <SlColorPicker size="small" swatches={swatches}
                                                       value={getColor(element.mainAxis)}
                                                       onSlInput={(e) => updateValue('mainAxis.color', e.target.value)}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Width" min="0.5" max="10" step="0.5" align-right
                                                 tooltip="bottom"
                                                 value={element.mainAxis.thickness ?? 1}
                                                 onSlInput={(e) => updateValue('mainAxis.thickness', parseFloat(e.target.value))}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right
                                                 tooltip="bottom"
                                                 value={element.mainAxis.opacity ?? 0.8}
                                                 onSlInput={(e) => updateValue('mainAxis.opacity', parseFloat(e.target.value))}/>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Secondary Axis Details */}
                        {(element.xAxis.second || element.yAxis.second) && (
                            <>
                                <SlDivider/>
                                <div>{'Grid'}</div>
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">
                                        <SlColorPicker size="small" swatches={swatches}
                                                       value={getColor(element.secondAxis)}
                                                       onSlInput={(e) => updateValue('secondAxis.color', e.target.value)}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Width" min="0.5" max="10" step="0.5" align-right
                                                 tooltip="bottom"
                                                 value={element.secondAxis.thickness ?? 0.5}
                                                 onSlInput={(e) => updateValue('secondAxis.thickness', parseFloat(e.target.value))}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right
                                                 tooltip="bottom"
                                                 value={element.secondAxis.opacity ?? 0.5}
                                                 onSlInput={(e) => updateValue('secondAxis.opacity', parseFloat(e.target.value))}/>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </LGSScrollbars>
            </div>
        </div>
    )
}
