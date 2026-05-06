/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }               from '@Components/MainUI/LGSScrollbars'
import {
    BackgroundElement,
}                                                         from '@Components/MainUI/widgets/editor/elements/BackgroundElement'
import {
    BorderElement,
}                                                         from '@Components/MainUI/widgets/editor/elements/BorderElement'
import {
    PaddingElement,
} from '@Components/MainUI/widgets/editor/elements/PaddingElement'
import {
    ScaleSwitchElement,
} from '@Components/MainUI/widgets/editor/elements/ScaleSwitchElement'
import { formatSliderPercent }    from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import {
    ensureFlythroughSettings,
    normalizeFlythroughProfileInfo,
}                                                         from '@Core/ui/flythrough/FlythroughProgressionStyle'
import {
    WaButton, WaCard, WaColorPicker, WaDivider, WaIcon, WaSlider, WaSwitch,
}                                                         from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                      from 'colord'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                 from 'valtio'

const PROFILE_WIDGET_SLIDERS = {
    'mainAxis.thickness':   {
        fallback: 1,
        getValue: element => element.mainAxis?.thickness,
        max:      10,
        min:      0.5,
        step:     0.5,
    },
    'mainAxis.opacity':     {
        fallback: 0.8,
        getValue: element => element.mainAxis?.opacity,
        max:      1,
        min:      0.1,
        step:     0.05,
    },
    'secondAxis.thickness': {
        fallback: 0.5,
        getValue: element => element.secondAxis?.thickness,
        max:      10,
        min:      0,
        step:     0.5,
    },
    'secondAxis.opacity':   {
        fallback: 0.5,
        getValue: element => element.secondAxis?.opacity,
        max:      1,
        min:      0.1,
        step:     0.05,
    },
}

/**
 * Editor component for profile widget configuration.
 * Manages axis visibility, grid styling, and visual elements.
 * * @param {Object} props
 * @param {string} props.entity - The entity key to edit in configuration.
 */
export const ProfileWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['profile-widget'].configuration
    const configuration = useSnapshot($configuration)
    ensureFlythroughSettings()
    const flythroughSettings = useSnapshot(lgs.settings.ui.flythrough)
    const sliderRefs = useRef({})

    const sanitizeSliderValue = useCallback((rawValue, fallback, options = {}) => {
        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
        const numericValue = Number(value)

        if (!Number.isFinite(numericValue)) {
            return fallback
        }

        const min = Number(options.min)
        const max = Number(options.max)
        let finalValue = numericValue

        if (Number.isFinite(min)) {
            finalValue = Math.max(min, finalValue)
        }

        if (Number.isFinite(max)) {
            finalValue = Math.min(max, finalValue)
        }

        return finalValue
    }, [])

    /**
     * Retrieves the current element configuration based on priority:
     * Specific entity > User override > Default settings.
     */
    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const flythroughProfileInfo = useMemo(
        () => normalizeFlythroughProfileInfo(flythroughSettings.profileInfo),
        [flythroughSettings.profileInfo],
    )
    const gradientFallbackColor = useMemo(() => {
        const fallbackColor = __.ui.profiler?.prepareData()?.options?.[0]?.color ?? '#3b82f6'
        return colord(fallbackColor).alpha(1).toRgbString()
    }, [])

    /**
     * Resolves color values, supporting CSS variables and opacity.
     * @param {Object} item - Object containing color and opacity properties.
     * @param {boolean} [alpha=false] - If true, returns RGBA with opacity.
     * @returns {string}
     */
    const getColor = (item, alpha = false) => {
        if (!item) {
            return 'transparent'
        }
        let colorStr = item?.color ?? '#ffffff'

        // Resolve custom CSS variables via global UI helper
        if (colorStr.startsWith('--')) {
            colorStr = __.ui.css.getCSSVariable(colorStr)
        }

        const c = colord(colorStr)
        return (alpha ? c.alpha(item.opacity ?? 1) : c).toRgbString()
    }

    /**
     * Updates a nested property in the Valtio proxy.
     * Ensures path exists and sanitizes numeric inputs.
     * * @param {string} path - Dot-separated path to the property.
     * @param {*} value - New value to assign.
     */
    const updateValue = useCallback((path, value) => {
        if (typeof value === 'number' && Number.isNaN(value)) {
            return
        }

        if (!$configuration.elements) {
            $configuration.elements = {}
        }

        // Initialize entity configuration if missing by cloning the current element
        if (!$configuration.elements[entity]) {
            $configuration.elements[entity] = JSON.parse(JSON.stringify(element))
        }

        const keys = path.split('.')
        let curr = $configuration.elements[entity]

        // Traverse the object tree to find the target property
        for (let i = 0; i < keys.length - 1; i++) {
            if (!curr[keys[i]]) {
                curr[keys[i]] = {}
            }
            curr = curr[keys[i]]
        }

        curr[keys[keys.length - 1]] = value
    }, [$configuration, element, entity])

    const updateFlythroughProfileInfo = useCallback((updates) => {
        const nextProfileInfo = normalizeFlythroughProfileInfo({
                                                                   ...lgs.settings.ui.flythrough.profileInfo,
                                                                   ...updates,
                                                               })
        lgs.settings.ui.flythrough.profileInfo = nextProfileInfo
        if (lgs.stores.flythrough) {
            lgs.stores.flythrough.profileInfo = nextProfileInfo
        }
        __.ui.profiler?.draw?.()
    }, [])

    const setSliderRef = useCallback((path) => {
        return (node) => {
            sliderRefs.current[path] = node
        }
    }, [])

    const getProfileSliderValue = useCallback((path) => {
        const config = PROFILE_WIDGET_SLIDERS[path]

        if (!config) {
            return 0
        }

        return sanitizeSliderValue(config.getValue(element), config.fallback, config)
    }, [element, sanitizeSliderValue])

    const handleProfileSliderInput = useCallback((path, rawValue) => {
        const config = PROFILE_WIDGET_SLIDERS[path]

        if (!config) {
            return
        }

        updateValue(path, sanitizeSliderValue(rawValue, config.fallback, config))
    }, [sanitizeSliderValue, updateValue])

    useEffect(() => {
        Object.entries(PROFILE_WIDGET_SLIDERS).forEach(([path, config]) => {
            const rawValue = config.getValue(element)
            const sanitizedValue = sanitizeSliderValue(rawValue, config.fallback, config)
            const slider = sliderRefs.current[path]

            if (slider) {
                slider.value = sanitizedValue
            }

        })
    }, [element, sanitizeSliderValue])

    if (!element) {
        return null
    }

    return (
        <LGSScrollbars>
            <WaCard className="lgs-widget-editor-controls-wrapper lgs-widget-editor-card" appearance="plain"
                    orientation="vertical">
                {/* Visual Base Elements */}
                <BackgroundElement element={element} swatches={swatches} getColor={getColor}
                                   updateValue={updateValue} sanitizeSliderValue={sanitizeSliderValue}/>
                <WaDivider/>
                <BorderElement element={element} swatches={swatches} getColor={getColor} updateValue={updateValue}
                               showRadius={false} sanitizeSliderValue={sanitizeSliderValue}/>
                <WaDivider/>
                <PaddingElement element={element} updateValue={updateValue} fallback={8} moveableId={entity}/>
                <WaDivider/>

                {/* X-Axis (Distance) Settings */}
                <div className="drawer-horizontal-element">{'Distance Axis'}</div>
                <div className="profile-chart-switches">
                    <WaSwitch size="xsmall"
                              checked={element.xAxis?.main ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('xAxis.main', e.target.checked)}>
                        {'Axis'}
                    </WaSwitch>

                    <WaSwitch size="xsmall"
                              checked={element.xAxis?.second ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('xAxis.second', e.target.checked)}>
                        {'Grid'}
                    </WaSwitch>

                    <WaSwitch
                        size="xsmall"
                        checked={element.xAxis?.labels ?? false}
                        label-at-start width-auto
                        onInput={(e) => updateValue('xAxis.labels', e.target.checked)}>
                        {'Labels'}
                    </WaSwitch>

                    <WaSwitch size="xsmall"
                              checked={element.xAxis?.units ?? false}
                              disabled={!element.xAxis?.labels}
                              label-at-start width-auto
                              onInput={(e) => updateValue('xAxis.units', e.target.checked)}>
                        {'Units'}
                    </WaSwitch>
                </div>

                <WaDivider/>

                {/* Y-Axis (Elevation) Settings */}
                <div className="drawer-horizontal-element">{'Elevation Axis'}</div>
                <div className="profile-chart-switches">
                    <WaSwitch size="xsmall" checked={element.yAxis?.main ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('yAxis.main', e.target.checked)}>
                        {'Axis'}
                    </WaSwitch>

                    <WaSwitch size="xsmall" checked={element.yAxis?.second ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('yAxis.second', e.target.checked)}>
                        {'Grid'}
                    </WaSwitch>

                    <WaSwitch size="xsmall" checked={element.yAxis?.labels ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('yAxis.labels', e.target.checked)}>
                        {'Labels'}
                    </WaSwitch>

                    <WaSwitch size="xsmall" checked={element.yAxis?.units ?? false}
                              disabled={!element.yAxis?.labels}
                              label-at-start width-auto
                              onInput={(e) => updateValue('yAxis.units', e.target.checked)}>
                        {'Units'}
                    </WaSwitch>
                </div>

                <WaDivider/>

                {/* Chart Area Gradient */}
                <WaSwitch size="xsmall" label-at-start checked={element.gradient?.show ?? false}
                          onInput={(e) => updateValue('gradient.show', e.target.checked)}>
                    <span>{'Gradient'}</span>
                </WaSwitch>

                {element.gradient?.show && (
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sl-spacing-x-small)'}}>
                                <WaColorPicker size="small" swatches={swatches}
                                               value={element.gradient?.color ? getColor(element.gradient) : gradientFallbackColor}
                                               onInput={(e) => updateValue('gradient.color', e.target.value)}/>
                                {element.gradient?.color && (
                                    <WaButton onClick={() => updateValue('gradient.color', null)}
                                              className="reset-profile-widget-color"
                                              variant="brand" appearance="plain">
                                        <WaIcon name="arrow-rotate-left" variant="regular" size="small"/>
                                    </WaButton>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <WaDivider/>
                <div className="drawer-horizontal-line">
                    <div className="drawer-horizontal-element">{'Flythrough'}</div>
                </div>
                <WaSwitch
                    className="profile-widget-flythrough-track-style-switch"
                    size="xsmall"
                    label-at-start
                    checked={flythroughProfileInfo.useTrackStyle}
                    onChange={(e) => updateFlythroughProfileInfo({useTrackStyle: e.target.checked})}
                >
                    {'Use track style'}
                </WaSwitch>

                {/* Stylization for Main Axes and Labels */}
                {(element.xAxis?.main || element.yAxis?.main || element.xAxis?.labels || element.yAxis?.labels) && (
                    <>
                        <WaDivider/>
                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-element">{'Main'}</div>
                        </div>
                        <div className="lgs-widget-color-control-grid">
                            <div className="lgs-widget-color-control-color">
                                <WaColorPicker size="small" swatches={swatches} value={getColor(element.mainAxis)}
                                               onInput={(e) => updateValue('mainAxis.color', e.target.value)}/>
                            </div>
                            <div className="lgs-widget-border-control-row">
                                <div className="drawer-horizontal-element lgs-widget-border-control">
                                    <WaSlider ref={setSliderRef('mainAxis.thickness')}
                                              size="small"
                                              label="Width"
                                              min={PROFILE_WIDGET_SLIDERS['mainAxis.thickness'].min}
                                              max={PROFILE_WIDGET_SLIDERS['mainAxis.thickness'].max}
                                              step={PROFILE_WIDGET_SLIDERS['mainAxis.thickness'].step}
                                              label-at-start
                                              withTooltip
                                              defaultValue={getProfileSliderValue('mainAxis.thickness')}
                                              onInput={(e) => handleProfileSliderInput('mainAxis.thickness', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element lgs-widget-border-control">
                                    <WaSlider ref={setSliderRef('mainAxis.opacity')}
                                              size="small"
                                              label="Opacity"
                                              min={PROFILE_WIDGET_SLIDERS['mainAxis.opacity'].min}
                                              max={PROFILE_WIDGET_SLIDERS['mainAxis.opacity'].max}
                                              step={PROFILE_WIDGET_SLIDERS['mainAxis.opacity'].step}
                                              label-at-start
                                              withTooltip
                                              valueFormatter={formatSliderPercent}
                                              defaultValue={getProfileSliderValue('mainAxis.opacity')}
                                              onInput={(e) => handleProfileSliderInput('mainAxis.opacity', e.target.value)}/>
                                </div>
                            </div>
                            <div className="lgs-widget-color-control-spacer" aria-hidden="true"/>
                            <ScaleSwitchElement
                                checked={element.mainAxis?.scaled ?? false}
                                onChange={(checked) => updateValue('mainAxis.scaled', checked)}
                                className="lgs-widget-profile-axis-scaled-line"
                            />
                        </div>
                    </>
                )}

                {/* Stylization for Grid Lines */}
                {(element.xAxis?.second || element.yAxis?.second) && (
                    <>
                        <WaDivider/>
                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-element">{'Grid'}</div>
                        </div>
                        <div className="lgs-widget-color-control-grid">
                            <div className="lgs-widget-color-control-color">
                                <WaColorPicker size="small" swatches={swatches} value={getColor(element.secondAxis)}
                                               onInput={(e) => updateValue('secondAxis.color', e.target.value)}/>
                            </div>
                            <div className="lgs-widget-border-control-row">
                                <div className="drawer-horizontal-element lgs-widget-border-control">
                                    <WaSlider ref={setSliderRef('secondAxis.thickness')}
                                              size="small"
                                              label="Width"
                                              min={PROFILE_WIDGET_SLIDERS['secondAxis.thickness'].min}
                                              max={PROFILE_WIDGET_SLIDERS['secondAxis.thickness'].max}
                                              step={PROFILE_WIDGET_SLIDERS['secondAxis.thickness'].step}
                                              label-at-start withTooltip withLabel
                                              defaultValue={getProfileSliderValue('secondAxis.thickness')}
                                              onInput={(e) => handleProfileSliderInput('secondAxis.thickness', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element lgs-widget-border-control">
                                    <WaSlider ref={setSliderRef('secondAxis.opacity')}
                                              size="small"
                                              label="Opacity"
                                              min={PROFILE_WIDGET_SLIDERS['secondAxis.opacity'].min}
                                              max={PROFILE_WIDGET_SLIDERS['secondAxis.opacity'].max}
                                              step={PROFILE_WIDGET_SLIDERS['secondAxis.opacity'].step}
                                              label-at-start withTooltip
                                              valueFormatter={formatSliderPercent}
                                              defaultValue={getProfileSliderValue('secondAxis.opacity')}
                                              onInput={(e) => handleProfileSliderInput('secondAxis.opacity', e.target.value)}/>
                                </div>
                            </div>
                            <div className="lgs-widget-color-control-spacer" aria-hidden="true"/>
                            <ScaleSwitchElement
                                checked={element.secondAxis?.scaled ?? false}
                                onChange={(checked) => updateValue('secondAxis.scaled', checked)}
                                className="lgs-widget-profile-axis-scaled-line"
                            />
                        </div>
                    </>
                )}
            </WaCard>
        </LGSScrollbars>
    )
}
