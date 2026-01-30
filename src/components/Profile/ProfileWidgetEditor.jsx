/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetEditor.jsx
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

import { LGSScrollbars }                                                             from '@Components/MainUI/LGSScrollbars'
import { DISTANCE, ELEVATION, POINT, TIME }                                          from '@Core/ui/Profiler'
import {
    SlColorPicker, SlDivider, SlInput, SlRange, SlSwitch,
}                                                                                    from '@shoelace-style/shoelace/dist/react'
import { colord }                                                                    from 'colord'
import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { useSnapshot }                                          from 'valtio'
import { ProfileChart }                                                              from './ProfileChart'
import './style.css'

/**
 * Editor for the Profile Widget configuration using a plain Object
 * Keys are widget IDs (e.g., 'profile-widget#1234')
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
    const targetRatio = useMemo(() => {
        if (profileState.width > 0 && profileState.height > 0) {
            return profileState.width / profileState.height
        }
        return null
    }, [profileState.width, profileState.height])

    const previewChartSize = useMemo(() => {
        const ratio = (profileState.width > 0 && profileState.height > 0)
                      ? (profileState.width / profileState.height)
                      : (previewSize.width > 0 && previewSize.height > 0
                         ? (previewSize.width / previewSize.height)
                         : (16 / 9))
        const maxWidth = previewSize.width * 0.8
        const maxHeight = previewSize.height * 0.8
        if (!Number.isFinite(ratio) || ratio <= 0 || maxWidth <= 0 || maxHeight <= 0) {
            return null
        }
        let width = maxWidth
        let height = width / ratio
        if (height > maxHeight) {
            height = maxHeight
            width = height * ratio
        }
        return {width, height}
    }, [profileState.width, profileState.height, previewSize.width, previewSize.height])

    const previewRatioReady = useMemo(() => {
        if (!previewChartSize) {
            return false
        }
        if (!targetRatio) {
            return true
        }
        const chartRatio = previewChartSize.width / previewChartSize.height
        return Math.abs(chartRatio - targetRatio) < 0.05
    }, [targetRatio, previewChartSize])

    useEffect(() => {
        if (previewChartSize && previewRatioReady && !previewRenderReady) {
            setPreviewRenderReady(true)
        }
    }, [previewChartSize, previewRatioReady, previewRenderReady])

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
    const previewColor = useMemo(() => {
        return realData?.options?.[0]?.color ?? '#3b82f6'
    }, [realData])

    const previewBounds = useMemo(() => {
        if (!realData?.dataset?.length) {
            return {x: {min: 0, max: 2}, y: {min: 100, max: 260}}
        }
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        realData.dataset.forEach((dataset) => {
            dataset.source.forEach((row) => {
                const x = row?.[0]
                const y = row?.[1]
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
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX === maxX) {
            minX = 0
            maxX = 2
        }
        if (!Number.isFinite(minY) || !Number.isFinite(maxY) || minY === maxY) {
            minY = 100
            maxY = 260
        }
        const round = (value) => Math.round(value * 100) / 100
        const roundedXMin = round(minX)
        const roundedXMax = round(maxX)
        const roundedYMin = round(minY)
        const roundedYMax = round(maxY)
        return {
            x: {min: Math.min(roundedXMin, minX), max: Math.max(roundedXMax, maxX)},
            y: {min: Math.min(roundedYMin, minY), max: Math.max(roundedYMax, maxY)},
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
        const minX = previewBounds.x.min
        const maxX = previewBounds.x.max
        const minY = previewBounds.y.min
        const maxY = previewBounds.y.max
        const rangeX = maxX - minX
        const rangeY = maxY - minY
        const maxAltitude = previewBounds.y.max
        const points = [
            {
                distance:  typeof previewEndpoints.start.x === 'number' ? previewEndpoints.start.x : minX,
                elevation: typeof previewEndpoints.start.y === 'number' ? previewEndpoints.start.y : minY,
                latitude:  48.8566,
                longitude: 2.3522,
            },
            {distance: minX + rangeX * 0.18, elevation: maxAltitude, latitude: 48.8575, longitude: 2.3572},
            {distance: minX + rangeX * 0.36, elevation: minY + rangeY * 0.35, latitude: 48.8584, longitude: 2.3621},
            {distance: minX + rangeX * 0.52, elevation: maxY - rangeY * 0.15, latitude: 48.8592, longitude: 2.3673},
            {distance: minX + rangeX * 0.72, elevation: minY + rangeY * 0.6, latitude: 48.8601, longitude: 2.3719},
            {
                distance:  typeof previewEndpoints.end.x === 'number' ? previewEndpoints.end.x : maxX,
                elevation: typeof previewEndpoints.end.y === 'number' ? previewEndpoints.end.y : maxY,
                latitude:  48.8612,
                longitude: 2.3761,
            },
        ]
        return {
            legend:     {data: ['Sample']},
            dataset:    [
                {
                    id:     'sample-track',
                    source: points.map(point => ([
                        point.distance,
                        point.elevation,
                        null,
                        {
                            latitude:  point.latitude,
                            longitude: point.longitude,
                            altitude:  point.elevation,
                            time:      null,
                        },
                        unitSystem,
                    ])),
                },
            ],
            options:    [
                {color: previewColor, name: 'Sample', dataset: 'sample-track'},
            ],
            axisNames:  {x: '', y: ''},
            dimensions: [DISTANCE, ELEVATION, TIME, POINT],
            unitSystem,
            previewBounds,
        }
    }, [unitStore.current, previewColor, previewBounds, previewEndpoints])

    /**
     * Initialization logic
     * Runs only when the entity ID changes or configuration is reset
     */
    useEffect(() => {
        // Ensure elements is at least an empty object
        if (!$configuration.elements || typeof $configuration.elements !== 'object') {
            $configuration.elements = {}
        }

        // Initialize defaults if the specific ID doesn't exist in the object
        if (!$configuration.elements[entity]) {
            const defaultValue = $configuration.user ?? $configuration.default
            // We use a spread to create a new reactive object entry
            $configuration.elements[entity] = {...defaultValue}
        }
    }, [entity, $configuration])


    /**
     * Internal utility to update nested properties in the Valtio proxy
     * @param {string} path - Dot notation path (e.g., 'background.color')
     * @param {any} value - The new value to assign
     */
    const updateElementValue = useCallback((path, value) => {
        if (!$element) {
            return
        }

        const keys = path.split('.')
        let current = $element

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            if (!current[key]) {
                current[key] = {}
            }
            current = current[key]
        }

        const lastKey = keys[keys.length - 1]
        current[lastKey] = value
    }, [$element])

    /**
     * Updates boolean properties and handles specific side effects
     */
    const handleBooleanChange = useCallback((event, path) => {
        const value = event.target.checked
        updateElementValue(path, value)

        // Handle side effects for specific configuration paths
        switch (path) {
            case 'background.show':
                if (!value) {
                    $element.background.blur = false
                }
                break
            case 'xAxis.labels':
                if (!value) {
                    $element.xAxis.units = value
                }
            case 'yAxis.labels':
                if (!value) {
                    $element.yAxis.units = value
                }
            default:
                break
        }

        event.preventDefault()
        event.stopPropagation()
    }, [$element, updateElementValue])

    /**
     * Updates color properties from SlColorPicker
     */
    const handleChangeColor = useCallback((event, path) => {
        // SlColorPicker value is accessed via event.target.value
        const value = event.target.value
        updateElementValue(path, value)

        event.preventDefault()
        event.stopPropagation()
    }, [updateElementValue])

    /**
     * Updates numeric properties (thickness, opacity, etc.)
     */
    const handleChangeNumber = useCallback((event, path) => {
        // Convert string input to float for numeric properties
        const value = parseFloat(event.target.value)
        updateElementValue(path, isNaN(value) ? 0 : value)

        event.preventDefault()
        event.stopPropagation()
    }, [updateElementValue])

    const opacityFormatter = value => {
        return `${Math.round(value * 100)}%`
    }

    /**
     * Helper to convert hex + opacity to rgba string
     */
    const setColor = useCallback((item, alpha = false) => {
        if (!item) {
            return 'transparent'
        }
        if (item.color.startsWith('--')) {
            const color = colord(__.ui.css.getCSSVariable(item.color))
            return (alpha ? color.alpha(item.opacity ?? 1) : color).toRgbString()
        }
        return colord((alpha ? colord(item.color).alpha(item.opacity ?? 1) : item.color)).toRgbString()
    }, [])

    if (!element) {
        return null
    }

    return (
        <div className="lgs-card profile-widget-editor">
            <div className="profile-widget-preview" style={previewStyle}>
                <div className="profile-widget-preview-surface" ref={previewRef}>
                    <div className="profile-widget-preview-chart" style={previewChartSize ? {
                        width:  `${previewChartSize.width}px`,
                        height: `${previewChartSize.height}px`,
                    } : undefined}>
                        {previewChartSize && previewRatioReady && previewRenderReady && (
                            <ProfileChart
                                preview
                                data={previewData}
                                id={entity}
                                height={previewChartSize.height}
                                width={previewChartSize.width}
                            />
                        )}
                    </div>
                </div>
            </div>
            <div className="profile-widget-editor-scroll">
                <LGSScrollbars>
                    <section className="widget-background-section">
                <SlSwitch
                    align-right="true"
                    size="x-small"
                    checked={element.background.show ?? false}
                    onSlInput={(e) => handleBooleanChange(e, 'background.show')}
                >
                    <label>{'Background'}</label>
                </SlSwitch>

                {element.background.show && (
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            {'Color'}&nbsp;
                            <SlColorPicker
                                size="small" swatches={swatches}
                                value={setColor(element.background)}
                                onSlInput={(e) => handleChangeColor(e, 'background.color')}
                            />
                        </div>
                        <div className="drawer-horizontal-element">
                            <SlSwitch
                                align-right="true"
                                size="x-small"
                                checked={element.background.blur ?? false}
                                onSlChange={(e) => handleBooleanChange(e, 'background.blur')}
                            >
                                {'Blur'}
                            </SlSwitch>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            {'Opacity'}
                            <SlRange
                                min="0.1" max="1" step="0.05"
                                tooltipFormatter={opacityFormatter}
                                value={element.background.opacity ?? 0.5}
                                onSlInput={(e) => handleChangeNumber(e, 'background.opacity')}
                            />
                        </div>
                    </div>
                )}
                <SlDivider/>

                <SlSwitch size="x-small" align-right="true"
                          checked={element.border.show}
                          onSlInput={(e) => handleBooleanChange(e, 'border.show')}
                >
                    <span>{'Border'}</span>
                </SlSwitch>
                {element.border.show && (
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            {'Color'}&nbsp;
                            <SlColorPicker
                                size="small" swatches={swatches}
                                value={setColor(element.border)}
                                onSlChange={(e) => handleChangeColor(e, 'border.color')}
                            />
                        </div>
                        <div className="drawer-horizontal-element">
                            {'Thickness'}
                            <SlInput type="number" min="1" max="10"
                                     value={element.border.thickness ?? 1}
                                     size="small"
                                     onSlInput={(e) => handleChangeNumber(e, 'border.thickness')}
                                     className={'widget-border-field-width'}>
                            </SlInput>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            {'Opacity'}
                            <SlRange min="0.1" max="1" step="0.05"
                                     tooltipFormatter={opacityFormatter}
                                     value={element.border.opacity ?? 0.5}
                                     onSlInput={(e) => handleChangeNumber(e, 'border.opacity')}
                            />
                        </div>
                    </div>
                )}
                <SlDivider/>

                {/* Axis Configuration Section */}
                <div className="drawer-horizontal-line">
                    <div className="drawer-horizontal-element xlarge-element">{'Distance:'}</div>
                    <div className="drawer-horizontal-line three-columns">
                        <SlSwitch size="x-small" align-right checked={element.xAxis.main}
                                  onSlInput={(e) => handleBooleanChange(e, 'xAxis.main')}
                        >{'Axis'}&nbsp;</SlSwitch>
                        <SlSwitch size="x-small" align-right checked={element.xAxis.second}
                                  onSlInput={(e) => handleBooleanChange(e, 'xAxis.second')}
                        >{'Grid'}&nbsp;</SlSwitch>
                        <SlSwitch size="x-small" align-right checked={element.xAxis.labels}
                                  onSlInput={(e) => handleBooleanChange(e, 'xAxis.labels')}
                        >{'Labels'}&nbsp;</SlSwitch>
                        <SlSwitch size="x-small" align-right checked={element.xAxis.units}
                                  disabled={!element.xAxis.labels}
                                  onSlInput={(e) => handleBooleanChange(e, 'xAxis.units')}
                        >{'Units'}&nbsp;</SlSwitch>
                    </div>
                </div>

                <div className="drawer-horizontal-line">
                    <div className="drawer-horizontal-element xlarge-element">{'Elevation:'}</div>
                    <div className="drawer-horizontal-line three-columns">
                        <SlSwitch size="x-small" align-right checked={element.yAxis.main}
                                  onSlInput={(e) => handleBooleanChange(e, 'yAxis.main')}
                        >{'Axis'}&nbsp;</SlSwitch>
                        <SlSwitch size="x-small" align-right checked={element.yAxis.second}
                                  onSlInput={(e) => handleBooleanChange(e, 'yAxis.second')}
                        >{'Grid'}&nbsp;</SlSwitch>
                        <SlSwitch size="x-small" align-right checked={element.yAxis.labels}
                                  onSlInput={(e) => handleBooleanChange(e, 'yAxis.labels')}
                        >{'Labels'}&nbsp;</SlSwitch>
                        <SlSwitch size="x-small" align-right checked={element.yAxis.units}
                                  disabled={!element.yAxis.labels}
                                  onSlInput={(e) => handleBooleanChange(e, 'yAxis.units')}
                        >{'Units'}&nbsp;</SlSwitch>
                    </div>
                </div>


                {/* Main Axis Details */}
                {(element.xAxis.main || element.yAxis.main
                        || element.xAxis.labels || element.yAxis.labels
                        || element.xAxis.units || element.yAxis.units) &&
                    <>
                        <SlDivider/>
                        {'Main Axis:'}
                        <div className="drawer-horizontal-line three-columns">
                            <div className="drawer-horizontal-element">
                                {'Color'}&nbsp;
                                <SlColorPicker size="small" swatches={swatches}
                                               value={setColor(element.mainAxis)}
                                               onSlChange={(e) => handleChangeColor(e, 'mainAxis.color')}/>
                            </div>
                            {(element.xAxis.main || element.yAxis.main) &&
                                <>
                                    <div className="drawer-horizontal-element">
                                        {'Thickness'}
                                        <SlInput type="number" min="0.5" max="10" step="0.5"
                                                 value={element.mainAxis.thickness ?? 1}
                                                 size="small"
                                                 onSlInput={(e) => handleChangeNumber(e, 'mainAxis.thickness')}
                                                 className={'widget-border-field-width'}>
                                        </SlInput>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        {'Opacity'}
                                        <SlRange min="0.1" max="1" step="0.05"
                                                 tooltipFormatter={opacityFormatter}
                                                 value={element.mainAxis.opacity ?? 0.8}
                                                 onSlInput={(e) => handleChangeNumber(e, 'mainAxis.opacity')}/>
                                    </div>
                                </>
                            }
                        </div>
                    </>
                }

                {/* Secondary Axis Details */}
                {(element.xAxis.second || element.yAxis.second) &&
                    <>
                        {'Secondary Axis:'}
                        <div className="drawer-horizontal-line three-columns">
                            <div className="drawer-horizontal-element">
                                {'Color'}&nbsp;
                                <SlColorPicker size="small" swatches={swatches}
                                               value={setColor(element.secondAxis)}
                                               onSlInput={(e) => handleChangeColor(e, 'secondAxis.color')}/>
                            </div>
                            <div className="drawer-horizontal-element">
                                {'Thickness'}
                                <SlInput type="number" min="0.5" max="10" step="0.5"
                                         value={element.secondAxis.thickness ?? 0.5}
                                         size="small"
                                         onSlInput={(e) => handleChangeNumber(e, 'secondAxis.thickness')}
                                         className={'widget-border-field-width'}>
                                </SlInput>
                            </div>
                            <div className="drawer-horizontal-element xlarge-element">
                                {'Opacity'}
                                <SlRange min="0.1" max="1" step="0.05"
                                         tooltipFormatter={opacityFormatter}
                                         value={element.secondAxis.opacity ?? 0.5}
                                         onSlInput={(e) => handleChangeNumber(e, 'secondAxis.opacity')}/>
                            </div>
                        </div>
                    </>
                }
                    </section>
                </LGSScrollbars>
            </div>
        </div>
    )
}
