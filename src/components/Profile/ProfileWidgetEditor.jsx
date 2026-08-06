/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-15
 * Last modified: 2026-06-15
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
    LineElement,
}                                                         from '@Components/MainUI/widgets/editor/elements/LineElement'
import {
    PaddingElement,
} from '@Components/MainUI/widgets/editor/elements/PaddingElement'
import {
    ensureJourneyReplaySettings,
    normalizeJourneyReplayProfileInfo,
}                                                         from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    WaButton, WaCard, WaColorPicker, WaDivider, WaIcon, WaNumberInput, WaOption, WaSelect,
    WaSwitch,
}                                                         from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                      from 'colord'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                 from 'valtio'
import { useOptionalSnapshot }         from '@Utils/ValtioUtils'

const PROFILE_WIDGET_RATIO_CUSTOM_VALUE = 'custom'
const PROFILE_WIDGET_RATIO_PRESETS = [
    {value: '16x9', label: 'Large', aspectRatio: 16 / 9},
    {value: '4x1', label: 'X large', aspectRatio: 4 / 1},
    {value: 'golden', label: 'Golden', aspectRatio: 1.61803398875},
]
const PROFILE_WIDGET_MIN_RATIO = 5 / 4

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

const sanitizeRatioDimension = (value, fallback) => {
    const numericValue = Number(Array.isArray(value) ? value[0] : value)
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return fallback
    }

    return Math.round(numericValue)
}

const stringifyRatioDimension = (value, fallback) => {
    const numericValue = sanitizeRatioDimension(value, fallback)
    return String(numericValue)
}

const normalizeProfileBox = (box) => {
    const width = Math.max(1, sanitizeRatioDimension(box?.width, 1600))
    const height = Math.max(1, sanitizeRatioDimension(box?.height, 1280))

    return {
        width,
        height,
    }
}

const normalizeRatioPreset = (ratio) => {
    if (!ratio) {
        return null
    }

    const value = ratio.value ?? ratio
    const preset = PROFILE_WIDGET_RATIO_PRESETS.find(item => item.value === value)
    if (preset) {
        return {
            ...preset,
            locked: true,
            width:  preset.width ?? 1600,
            height: preset.height ?? Math.max(1, Math.floor(1600 / preset.aspectRatio)),
        }
    }

    if (typeof ratio === 'object') {
        const width = Number(ratio.width)
        const height = Number(ratio.height)
        const aspectRatio = Number(ratio.aspectRatio)
        const normalizedWidth = Number.isFinite(width) && width > 0 ? Math.round(width) : null
        const normalizedHeight = Number.isFinite(height) && height > 0 ? Math.round(height) : null

        if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
            const dimensions = normalizedWidth && normalizedHeight
                               ? normalizeProfileBox({width: normalizedWidth, height: normalizedHeight})
                               : (normalizedWidth
                                  ? normalizeProfileBox({width: normalizedWidth, height: normalizedWidth / aspectRatio})
                                  : (normalizedHeight
                                     ? normalizeProfileBox({
                                                               width:  normalizedHeight * aspectRatio,
                                                               height: normalizedHeight,
                                                           })
                                     : normalizeProfileBox({
                                                               width:  1600,
                                                               height: 1600 / Math.max(aspectRatio, PROFILE_WIDGET_MIN_RATIO),
                                                           })))
            return {
                value:       ratio.value ?? PROFILE_WIDGET_RATIO_CUSTOM_VALUE,
                aspectRatio: Math.max(dimensions.width / dimensions.height, PROFILE_WIDGET_MIN_RATIO),
                locked:      ratio.locked ?? true,
                width:       dimensions.width,
                height:      dimensions.height,
            }
        }
    }

    return null
}

const buildCustomRatio = (width, height, ratio = null, value = PROFILE_WIDGET_RATIO_CUSTOM_VALUE) => {
    const dimensions = normalizeProfileBox({width, height})
    return {
        value,
        aspectRatio: Math.max(dimensions.width / dimensions.height, PROFILE_WIDGET_MIN_RATIO),
        locked:      ratio?.locked ?? true,
        width:       dimensions.width,
        height:      dimensions.height,
    }
}

const readWidgetBox = (element, config) => {
    const rect = element?.getBoundingClientRect?.()
    const width = Number.isFinite(config?.dimensions?.width) && config.dimensions.width > 0
                  ? config.dimensions.width
                  : (Number.isFinite(rect?.width) && rect.width > 0 ? rect.width : 0)
    const height = Number.isFinite(config?.dimensions?.height) && config.dimensions.height > 0
                   ? config.dimensions.height
                   : (Number.isFinite(rect?.height) && rect.height > 0 ? rect.height : 0)
    const left = Number.isFinite(config?.position?.left)
                 ? config.position.left
                 : Number.parseFloat(element?.style?.left || `${rect?.left ?? 0}`)
    const top = Number.isFinite(config?.position?.top)
                ? config.position.top
                : Number.parseFloat(element?.style?.top || `${rect?.top ?? 0}`)

    return {
        left:   Number.isFinite(left) ? left : 0,
        top:    Number.isFinite(top) ? top : 0,
        width:  Number.isFinite(width) ? width : 0,
        height: Number.isFinite(height) ? height : 0,
    }
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
    ensureJourneyReplaySettings()
    const replaySettings = useSnapshot(lgs.settings.ui.replay)
    const profileSettings = useSnapshot(lgs.settings.ui.profile)
    const sliderRefs = useRef({})
    const ratioPresets = useMemo(() => {
        return PROFILE_WIDGET_RATIO_PRESETS.map(ratio => ({
            value:       String(ratio.value),
            label:       ratio.label ?? String(ratio.value).replace(/x/g, ':'),
            aspectRatio: Number(ratio.aspectRatio),
            locked:      true,
            width:       ratio.width,
            height:      ratio.height,
        }))
    }, [])

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

    const swatches = useOptionalSnapshot(lgs.settings.swatches, {list: []}).list.join(';')
    const replayProfileInfo = useMemo(
        () => normalizeJourneyReplayProfileInfo(replaySettings.profileInfo),
        [replaySettings.profileInfo],
    )
    const gradientFallbackColor = useMemo(() => {
        const fallbackColor = __.ui.profiler?.prepareData()?.options?.[0]?.color ?? '#3b82f6'
        return colord(fallbackColor).alpha(1).toRgbString()
    }, [])
    const widgetConfig = __.ui.widgetManager.getWidgetConfig(entity)
    const [ratioState, setRatioState] = useState(() => {
        return normalizeRatioPreset(widgetConfig?.ratio ?? lgs.configuration?.widgetRatio)
            ?? buildCustomRatio(16, 9)
    })
    const [customRatioDraft, setCustomRatioDraft] = useState(() => {
        const currentRatio = normalizeRatioPreset(widgetConfig?.ratio)
        return currentRatio?.value === PROFILE_WIDGET_RATIO_CUSTOM_VALUE
               ? {
                width:  currentRatio.width,
                height: currentRatio.height,
            }
               : normalizeProfileBox(widgetConfig?.dimensions ?? {width: 1600, height: 1280})
    })
    const [customRatioDraftInput, setCustomRatioDraftInput] = useState(() => ({
        width:  stringifyRatioDimension(customRatioDraft?.width, 1600),
        height: stringifyRatioDimension(customRatioDraft?.height, 1280),
    }))
    useEffect(() => {
        const currentRatio = __.ui.widgetManager.getWidgetConfig(entity)?.ratio ?? lgs.configuration?.widgetRatio
        const normalizedRatio = normalizeRatioPreset(currentRatio) ?? buildCustomRatio(1600, 1280)
        setRatioState(normalizedRatio)
        const currentConfig = __.ui.widgetManager.getWidgetConfig(entity)
        const currentElement = __.ui.widgetManager.getElementById?.(entity)
        const currentBox = normalizeProfileBox(readWidgetBox(currentElement, currentConfig))
        setCustomRatioDraft(currentBox)
        setCustomRatioDraftInput({
            width:  stringifyRatioDimension(currentBox.width, 1600),
            height: stringifyRatioDimension(currentBox.height, 1280),
        })
    }, [entity])
    const selectedRatioValue = ratioState?.value ?? PROFILE_WIDGET_RATIO_CUSTOM_VALUE
    const isCustomRatio = selectedRatioValue === PROFILE_WIDGET_RATIO_CUSTOM_VALUE
        || !ratioPresets.some(preset => preset.value === selectedRatioValue)

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

    const updateJourneyReplayProfileInfo = useCallback((updates) => {
        const nextProfileInfo = normalizeJourneyReplayProfileInfo({
                                                                   ...lgs.settings.ui.replay.profileInfo,
                                                                   ...updates,
                                                               })
        lgs.settings.ui.replay.profileInfo = nextProfileInfo
        if (lgs.stores.replay) {
            lgs.stores.replay.profileInfo = nextProfileInfo
        }
        __.ui.profiler?.draw?.()
    }, [])

    const updateProfileLiveData = useCallback((checked) => {
        lgs.settings.ui.profile.liveData = checked
        __.ui.profiler?.draw?.()
    }, [])

    const syncRatioDraftFromBox = useCallback((box) => {
        const normalizedBox = normalizeProfileBox(box)
        setCustomRatioDraft(normalizedBox)
        setCustomRatioDraftInput({
            width:  stringifyRatioDimension(normalizedBox.width, 1600),
            height: stringifyRatioDimension(normalizedBox.height, 1280),
        })
        setRatioState(current => {
            if (current?.value === PROFILE_WIDGET_RATIO_CUSTOM_VALUE) {
                return {
                    ...current,
                    ...normalizedBox,
                    aspectRatio: Math.max(normalizedBox.width / normalizedBox.height, PROFILE_WIDGET_MIN_RATIO),
                }
            }

            return current
        })
    }, [])

    const persistWidgetRatio = useCallback((nextRatio, options = {}) => {
        const normalizedRatio = normalizeRatioPreset(nextRatio) ?? buildCustomRatio(nextRatio?.width, nextRatio?.height, nextRatio)
        setRatioState(normalizedRatio)

        const config = __.ui.widgetManager.getWidgetConfig(entity)
        if (!config) {
            return
        }

        config.ratio = normalizedRatio
        __.ui.widgetManager.setConfig(entity, config)

        const element = __.ui.widgetManager.getElementById?.(entity)
        if (element) {
            const currentBox = readWidgetBox(element, config)
            const resizeMode = options.resizeMode ?? 'height'
            if (resizeMode === 'none') {
                syncRatioDraftFromBox(currentBox)
            }
            else {
                const requestedWidth = Number.isFinite(options.width) ? options.width : normalizedRatio.width
                const requestedHeight = Number.isFinite(options.height) ? options.height : normalizedRatio.height
                let nextWidth = currentBox.width
                let nextHeight = currentBox.height

                if (resizeMode === 'preset') {
                    nextHeight = currentBox.height
                    nextWidth = Math.max(1, Math.round(nextHeight * (normalizedRatio.aspectRatio ?? 1)))
                }
                else if (resizeMode === 'width') {
                    nextHeight = currentBox.height
                    nextWidth = Math.max(1, sanitizeRatioDimension(requestedWidth, currentBox.width))
                    nextWidth = Math.max(nextWidth, Math.ceil(nextHeight * PROFILE_WIDGET_MIN_RATIO))
                }
                else if (resizeMode === 'height') {
                    nextWidth = currentBox.width
                    nextHeight = Math.max(1, sanitizeRatioDimension(requestedHeight, currentBox.height))
                    nextHeight = Math.min(nextHeight, Math.floor(nextWidth / PROFILE_WIDGET_MIN_RATIO))
                }

                const centerX = currentBox.left + (currentBox.width / 2)
                const centerY = currentBox.top + (currentBox.height / 2)
                const nextLeft = centerX - (nextWidth / 2)
                const nextTop = centerY - (nextHeight / 2)
                config.ratio = {
                    ...normalizedRatio,
                    width:       nextWidth,
                    height:      nextHeight,
                    aspectRatio: Math.max(nextWidth / nextHeight, PROFILE_WIDGET_MIN_RATIO),
                }

                element.style.width = `${nextWidth}px`
                element.style.height = `${nextHeight}px`
                element.style.left = `${nextLeft}px`
                element.style.top = `${nextTop}px`
                config.dimensions = {width: nextWidth, height: nextHeight}
                config.position = {left: nextLeft, top: nextTop}
                syncRatioDraftFromBox(config.dimensions)
            }
        }

        if (lgs.stores?.ui?.widget?.list?.set) {
            const widgetEntry = lgs.stores.ui.widget.list.get(entity) ?? {}
            lgs.stores.ui.widget.list.set(entity, {
                ...widgetEntry,
                ratio:      config.ratio,
                dimensions: config.dimensions,
                position:   config.position,
            })
        }

        if (config.persist) {
            void __.ui.widgetManager.saveWidgetPosition(entity, config)
        }

        const moveable = __.ui.widgetManager.getMoveable(entity)?.current
        moveable?.updateRect?.()
        requestAnimationFrame(() => moveable?.updateRect?.())
        __.ui.profiler?.draw?.()
        __.ui.widgetManager.refreshEditorPreviewSnapshot?.(entity)
    }, [entity, syncRatioDraftFromBox])

    const commitCustomRatioDraft = useCallback((key, rawValue, fallbackValue) => {
        const normalizedValue = sanitizeRatioDimension(rawValue, fallbackValue)
        if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
            return false
        }

        const currentConfig = __.ui.widgetManager.getWidgetConfig(entity)
        const currentElement = __.ui.widgetManager.getElementById?.(entity)
        const currentBox = normalizeProfileBox(readWidgetBox(currentElement, currentConfig))
        const nextDraft = {
            width:  key === 'width' ? normalizedValue : currentBox.width,
            height: key === 'height' ? normalizedValue : currentBox.height,
        }

        if (key === 'width') {
            nextDraft.height = currentBox.height
        }
        else if (key === 'height') {
            nextDraft.width = currentBox.width
        }

        persistWidgetRatio(buildCustomRatio(nextDraft.width, nextDraft.height, widgetConfig?.ratio), {
            resizeMode: key,
            width:      nextDraft.width,
            height:     nextDraft.height,
        })
        return true
    }, [entity, persistWidgetRatio, widgetConfig?.ratio])

    const handleRatioPresetChange = useCallback((event) => {
        const value = event.target.value
        if (value === PROFILE_WIDGET_RATIO_CUSTOM_VALUE) {
            const currentConfig = __.ui.widgetManager.getWidgetConfig(entity)
            const currentElement = __.ui.widgetManager.getElementById?.(entity)
            const fallback = normalizeProfileBox(readWidgetBox(currentElement, currentConfig))
            setCustomRatioDraft(fallback)
            persistWidgetRatio(buildCustomRatio(fallback.width, fallback.height, fallback), {resizeMode: 'none'})
            return
        }

        const preset = ratioPresets.find(item => item.value === value)
        if (!preset) {
            return
        }

        const currentConfig = __.ui.widgetManager.getWidgetConfig(entity)
        const currentElement = __.ui.widgetManager.getElementById?.(entity)
        const currentBox = normalizeProfileBox(readWidgetBox(currentElement, currentConfig))
        const nextWidth = Math.max(1, Math.round(currentBox.height * preset.aspectRatio))
        const nextDimensions = {
            width:  nextWidth,
            height: currentBox.height,
        }
        setCustomRatioDraft(nextDimensions)
        persistWidgetRatio({
                               ...preset,
                               width:  nextDimensions.width,
                               height: nextDimensions.height,
                               locked: true,
                           }, {resizeMode: 'preset'})
    }, [entity, persistWidgetRatio, ratioPresets])

    const handleCustomRatioChange = useCallback((key) => (event) => {
        const rawValue = String(event.target.value ?? '')
        setCustomRatioDraftInput(current => ({
            ...current,
            [key]: rawValue,
        }))

        if (/^\d+$/.test(rawValue)) {
            commitCustomRatioDraft(key, rawValue, key === 'width' ? 1600 : 1280)
        }
    }, [commitCustomRatioDraft])

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

    const renderAxisLineElement = (label, path) => {
        const thicknessPath = `${path}.thickness`
        const opacityPath = `${path}.opacity`
        const thicknessConfig = PROFILE_WIDGET_SLIDERS[thicknessPath]
        const opacityConfig = PROFILE_WIDGET_SLIDERS[opacityPath]

        return (
            <>
                <WaDivider/>
                <div className="drawer-horizontal-line">
                    <div className="drawer-horizontal-element">{label}</div>
                </div>
                <LineElement
                    swatches={swatches}
                    colorValue={getColor(element[path])}
                    onColorInput={(value) => updateValue(`${path}.color`, value)}
                    widthRef={setSliderRef(thicknessPath)}
                    widthMin={thicknessConfig.min}
                    widthMax={thicknessConfig.max}
                    widthStep={thicknessConfig.step}
                    widthDefaultValue={getProfileSliderValue(thicknessPath)}
                    onWidthInput={(value) => handleProfileSliderInput(thicknessPath, value)}
                    opacityRef={setSliderRef(opacityPath)}
                    opacityMin={opacityConfig.min}
                    opacityMax={opacityConfig.max}
                    opacityStep={opacityConfig.step}
                    opacityDefaultValue={getProfileSliderValue(opacityPath)}
                    onOpacityInput={(value) => handleProfileSliderInput(opacityPath, value)}
                    showScale
                    scaled={element[path]?.scaled ?? false}
                    onScaleChange={(checked) => updateValue(`${path}.scaled`, checked)}
                />
            </>
        )
    }

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

                <div className="drawer-horizontal-element">{'Ratio'}</div>
                <div className="profile-widget-ratio-section">
                    <WaSelect appearance="filled"
                        size="s"
                        label="Ratio"
                        label-at-start
                        className="half-width"
                        value={isCustomRatio ? PROFILE_WIDGET_RATIO_CUSTOM_VALUE : selectedRatioValue}
                        onChange={handleRatioPresetChange}
                    >
                        {ratioPresets.map(preset => (
                            <WaOption key={preset.value} value={preset.value} label={preset.label}>
                                {preset.label}
                            </WaOption>
                        ))}
                        <WaOption value={PROFILE_WIDGET_RATIO_CUSTOM_VALUE} label="Custom">
                            {'Custom'}
                        </WaOption>
                    </WaSelect>

                    {isCustomRatio && (
                        <div className="profile-widget-ratio-custom-fields">
                            <div className="profile-widget-ratio-row">
                                <WaNumberInput appearance="filled"
                                    size="s"
                                    label="Width (px)"
                                    label-at-start
                                    className="half-width"
                                    min="1"
                                    step="1"
                                    value={customRatioDraftInput.width}
                                    onInput={handleCustomRatioChange('width')}
                                    onBlur={() => {
                                        const committed = commitCustomRatioDraft('width', customRatioDraftInput.width, 1600)
                                        if (!committed) {
                                            const currentConfig = __.ui.widgetManager.getWidgetConfig(entity)
                                            const currentElement = __.ui.widgetManager.getElementById?.(entity)
                                            syncRatioDraftFromBox(readWidgetBox(currentElement, currentConfig))
                                        }
                                    }}
                                >
                                    <span slot="suffix">{'px'}</span>
                                </WaNumberInput>
                            </div>
                            <div className="profile-widget-ratio-row">
                                <WaNumberInput appearance="filled"
                                    size="s"
                                    label="Height (px)"
                                    label-at-start
                                    className="half-width"
                                    min="1"
                                    step="1"
                                    value={customRatioDraftInput.height}
                                    onInput={handleCustomRatioChange('height')}
                                    onBlur={() => {
                                        const committed = commitCustomRatioDraft('height', customRatioDraftInput.height, 1280)
                                        if (!committed) {
                                            const currentConfig = __.ui.widgetManager.getWidgetConfig(entity)
                                            const currentElement = __.ui.widgetManager.getElementById?.(entity)
                                            syncRatioDraftFromBox(readWidgetBox(currentElement, currentConfig))
                                        }
                                    }}
                                >
                                    <span slot="suffix">{'px'}</span>
                                </WaNumberInput>
                            </div>
                        </div>
                    )}
                </div>

                <WaDivider/>

                {/* X-Axis (Distance) Settings */}
                <div className="drawer-horizontal-element">{'Distance Axis'}</div>
                <div className="profile-chart-switches">
                    <WaSwitch size="xs"
                              checked={element.xAxis?.main ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('xAxis.main', e.target.checked)}>
                        {'Axis'}
                    </WaSwitch>

                    <WaSwitch size="xs"
                              checked={element.xAxis?.second ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('xAxis.second', e.target.checked)}>
                        {'Grid'}
                    </WaSwitch>

                    <WaSwitch
                        size="xs"
                        checked={element.xAxis?.labels ?? false}
                        label-at-start width-auto
                        onInput={(e) => updateValue('xAxis.labels', e.target.checked)}>
                        {'Labels'}
                    </WaSwitch>

                    <WaSwitch size="xs"
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
                    <WaSwitch size="xs" checked={element.yAxis?.main ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('yAxis.main', e.target.checked)}>
                        {'Axis'}
                    </WaSwitch>

                    <WaSwitch size="xs" checked={element.yAxis?.second ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('yAxis.second', e.target.checked)}>
                        {'Grid'}
                    </WaSwitch>

                    <WaSwitch size="xs" checked={element.yAxis?.labels ?? false}
                              label-at-start width-auto
                              onInput={(e) => updateValue('yAxis.labels', e.target.checked)}>
                        {'Labels'}
                    </WaSwitch>

                    <WaSwitch size="xs" checked={element.yAxis?.units ?? false}
                              disabled={!element.yAxis?.labels}
                              label-at-start width-auto
                              onInput={(e) => updateValue('yAxis.units', e.target.checked)}>
                        {'Units'}
                    </WaSwitch>
                </div>

                <WaDivider/>

                {/* Chart Area Gradient */}
                <WaSwitch size="xs" label-at-start checked={element.gradient?.show ?? false}
                          onInput={(e) => updateValue('gradient.show', e.target.checked)}>
                    <span>{'Gradient'}</span>
                </WaSwitch>

                {element.gradient?.show && (
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sl-spacing-x-small)'}}>
                                <WaColorPicker size="s" swatches={swatches}
                                               value={element.gradient?.color ? getColor(element.gradient) : gradientFallbackColor}
                                               onInput={(e) => updateValue('gradient.color', e.target.value)}/>
                                {element.gradient?.color && (
                                    <WaButton onClick={() => updateValue('gradient.color', null)}
                                              className="reset-profile-widget-color"
                                              variant="brand" appearance="plain">
                                        <WaIcon name="arrow-rotate-left" variant="regular" size="s"/>
                                    </WaButton>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <WaDivider/>
                <div className="drawer-horizontal-line">
                    <div className="drawer-horizontal-element">{'Replay'}</div>
                </div>
                <WaSwitch
                    className="profile-widget-replay-track-style-switch"
                    size="xs"
                    label-at-start
                    checked={replayProfileInfo.useTrackStyle}
                    onChange={(e) => updateJourneyReplayProfileInfo({useTrackStyle: e.target.checked})}
                >
                    {'Use track style'}
                </WaSwitch>
                <WaSwitch
                    className="profile-widget-no-live-data-switch"
                    size="xs"
                    label-at-start
                    checked={profileSettings.liveData === true}
                    onChange={(e) => updateProfileLiveData(e.target.checked)}
                >
                    {'Show live data'}
                </WaSwitch>

                {/* Stylization for Main Axes and Labels */}
                {(element.xAxis?.main || element.yAxis?.main || element.xAxis?.labels || element.yAxis?.labels) && (
                    renderAxisLineElement('Main', 'mainAxis')
                )}

                {/* Stylization for Grid Lines */}
                {(element.xAxis?.second || element.yAxis?.second) && (
                    renderAxisLineElement('Grid', 'secondAxis')
                )}
            </WaCard>
        </LGSScrollbars>
    )
}
