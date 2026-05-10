/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                                            from '@Components/MainUI/LGSScrollbars'
import { CompassFull }                                             from '@Components/MainUI/compass/CompassFull'
import { CompassLight }                                            from '@Components/MainUI/compass/CompassLight'
import { CompassWindRose }                                         from '@Components/MainUI/compass/CompassWindRose'
import {
    ColorElement,
}                                                                   from '@Components/MainUI/widgets/editor/elements/ColorElement'
import { COMPASS_FULL, COMPASS_LIGHT, COMPASS_WIND_ROSE }          from '@Core/constants'
import { WaButton, WaCard, WaDivider, WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'
import { colord, extend }                                             from 'colord'
import namesPlugin                                                    from 'colord/plugins/names'
import { useCallback, useEffect, useMemo }                            from 'react'
import { useSnapshot }                                                from 'valtio'

extend([namesPlugin])

/**
 * Format path to kebab-case for CSS variables.
 */
const toCompassKebab = (str) => {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/\./g, '-').toLowerCase()
}

/**
 * Resolve CSS variables to actual hex/rgb strings.
 */
const resolveCompassColor = (color) => {
    if (!color || typeof color !== 'string') {
        return color
    }
    if (color.startsWith('--') || color.startsWith('var(')) {
        const cleanVar = color.startsWith('var(') ? color.replace(/^var\((--.*?)\)$/, '$1') : color
        const resolved = __.ui.css.getCSSVariable(cleanVar)
        if (!resolved || resolved === '' || resolved === cleanVar) {
            return '#ffffff'
        }
        return resolveCompassColor(resolved)
    }
    return color
}

const cloneConfig = value => JSON.parse(JSON.stringify(value ?? {}))

const mergeCompassConfig = (defaults = {}, overrides = {}) => {
    const merged = cloneConfig(defaults)
    const merge = (target, source) => {
        if (!source || typeof source !== 'object') {
            return target
        }

        Object.entries(source).forEach(([key, value]) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                target[key] = merge(target[key] && typeof target[key] === 'object' ? target[key] : {}, value)
            }
            else if (value !== undefined) {
                target[key] = value
            }
        })

        return target
    }

    return merge(merged, overrides)
}

const getPathValue = (source, path) => {
    return path.split('.').reduce((current, key) => current?.[key], source)
}

const COMPASS_COLOR_PATHS = ['background', 'overBackground', 'poles', 'text', 'needle.north', 'needle.south', 'needle.center']

const setPathValue = (target, path, value) => {
    const keys = path.split('.')
    let current = target
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
            current[keys[i]] = {}
        }
        current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value
}

export const CompassWidgetEditor = ({entity, syncGlobalCompass = false}) => {
    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const $configuration = lgs.settings.widgets['compass-widget'].configuration
    const $globalCompass = lgs.settings.ui.compass
    const configuration = useSnapshot($configuration)
    const globalCompass = useSnapshot($globalCompass)

    const element = useMemo(() => {
        const source = syncGlobalCompass
                       ? globalCompass
                       : configuration.elements?.[entity] ?? configuration.user ?? configuration.default
        return mergeCompassConfig(configuration.default, source)
    }, [configuration, entity, globalCompass, syncGlobalCompass])
    const compassMode = element?.mode?.toString() ?? ''
    const showsSurfaceColors = compassMode === COMPASS_FULL.toString()
    const showsDirectionalColors = compassMode === COMPASS_FULL.toString() || compassMode === COMPASS_WIND_ROSE.toString()

    /**
     * Pure and simple color + opacity to RGBA string conversion
     */
    const formatRGBA = useCallback((colorValue, opacityValue) => {
        const c = colord(colorValue || '#ffffff')
        // If color is invalid, colord still returns an object, but we force white
        if (!c.isValid()) {
            return 'rgba(255, 255, 255, 1)'
        }

        // If opacityValue is null/undefined, we keep the color's original alpha
        const alpha = (opacityValue !== undefined && opacityValue !== null) ? Number(opacityValue) : c.alpha()
        return c.alpha(alpha).toRgbString()
    }, [])

    /**
     * Syncs store data with DOM CSS Variables
     */
    const syncCSS = useCallback((path, part) => {
        if (!part) {
            return
        }
        const _sceneTarget = __.ui.widgetManager.getElementById(entity)
        const _previewTarget = document.querySelector('.compass-widget-preview .lgs-compass')
        const variableName = `--lgs-compass-${toCompassKebab(path)}`

        const baseColor = resolveCompassColor(part.color) || resolveCompassColor(variableName)
        const finalColor = formatRGBA(baseColor, part.opacity)

        if (_sceneTarget) {
            __.ui.css.setCSSVariable(variableName, finalColor, _sceneTarget)
        }
        if (_previewTarget) {
            __.ui.css.setCSSVariable(variableName, finalColor, _previewTarget)
        }
    }, [entity, formatRGBA])

    /**
     * Provides the RGBA string for ColorElement preview
     */
    const getColor = useCallback((item, path) => {
        const baseColor = resolveCompassColor(item?.color) || resolveCompassColor(`--lgs-compass-${toCompassKebab(path)}`)
        return formatRGBA(baseColor, item?.opacity)
    }, [formatRGBA])

    const updateValue = useCallback((path, value) => {
        if (syncGlobalCompass) {
            const mergedGlobal = mergeCompassConfig(configuration.default, $globalCompass)
            Object.assign($globalCompass, mergedGlobal)
            setPathValue($globalCompass, path, value)
        }
        else {
            if (!$configuration.elements) {
                $configuration.elements = {}
            }
            if (!$configuration.elements[entity]) {
                $configuration.elements[entity] = cloneConfig(element)
            }
            setPathValue($configuration.elements[entity], path, value)
        }

        const _rootPath = path.replace('.color', '').replace('.opacity', '')
        const _part = getPathValue(syncGlobalCompass ? $globalCompass : $configuration.elements[entity], _rootPath)

        if (_part && typeof _part === 'object' && _rootPath !== path) {
            syncCSS(_rootPath, _part)
        }

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, $globalCompass, element, entity, _moveable, syncCSS, configuration.default, syncGlobalCompass])

    const handleReset = useCallback(() => {
        if (!configuration.default) {
            return
        }

        const target = syncGlobalCompass ? $globalCompass : ($configuration.elements?.[entity] ?? cloneConfig(element))

        if (syncGlobalCompass) {
            Object.assign($globalCompass, mergeCompassConfig(configuration.default, $globalCompass))
        }
        else {
            if (!$configuration.elements) {
                $configuration.elements = {}
            }
            $configuration.elements[entity] = target
        }

        COMPASS_COLOR_PATHS.forEach(path => {
            const defaultValue = getPathValue(configuration.default, path)
            if (defaultValue) {
                setPathValue(target, path, cloneConfig(defaultValue))
            }
            const val = getPathValue(target, path)
            if (val) {
                syncCSS(path, val)
            }
        })

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, $globalCompass, element, entity, configuration.default, _moveable, syncCSS, syncGlobalCompass])

    const handleCompassMode = useCallback((event) => {
        const mode = Number(event.target.value)
        updateValue('mode', Number.isFinite(mode) ? mode : event.target.value)
    }, [updateValue])

    /**
     * Trigger moveable resize when compass mode changes
     * This ensures the handles match the new visual dimensions
     */
    useEffect(() => {
        let firstFrame = null
        let secondFrame = null

        firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                _moveable?.current?.updateRect()
            })
        })

        return () => {
            if (firstFrame !== null) {
                cancelAnimationFrame(firstFrame)
            }
            if (secondFrame !== null) {
                cancelAnimationFrame(secondFrame)
            }
        }
    }, [compassMode, _moveable])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    if (!element) {
        return null
    }

    return (
        <LGSScrollbars key={`editor-${entity}`}>
            <WaCard className="lgs-widget-editor-controls-wrapper lgs-widget-editor-card compass-widget-editor"
                    appearance="plain" orientation="vertical">
                <div className="drawer-horizontal-line">
                    <div className="drawer-horizontal-element">
                        <WaSelect
                            className="compass-mode-select"
                            size="s"
                            value={compassMode}
                            label="Model"
                            label-at-start
                            onChange={handleCompassMode}
                        >
                            <WaIcon slot="start" size="s" variant="regular" name="compass"/>
                            <WaOption value={COMPASS_FULL.toString()} label="Full">
                                <span slot="start" className="compass-select-thumbnail">
                                    <CompassFull width="24" height="24"/>
                                </span>
                                {'Full'}
                            </WaOption>
                            <WaOption value={COMPASS_LIGHT.toString()} label="Light">
                                <span slot="start" className="compass-select-thumbnail">
                                    <CompassLight width="24" height="24"/>
                                </span>
                                {'Light'}
                            </WaOption>
                            <WaOption value={COMPASS_WIND_ROSE.toString()} label="Rose">
                                <span slot="start" className="compass-select-thumbnail">
                                    <CompassWindRose width="24" height="24"/>
                                </span>
                                {'Rose'}
                            </WaOption>
                        </WaSelect>
                    </div>
                    <div className="drawer-horizontal-element">
                        <div className="widget-editor-reset-menus">
                            <WaButton size="s" appearance="plain" onClick={handleReset} aria-label="Reset">
                                <WaIcon size="s" variant="regular" name="arrow-rotate-left"/>
                            </WaButton>
                        </div>
                    </div>
                </div>
                <WaDivider/>
                <div className="compass-widget-editor-colors">
                    {showsSurfaceColors &&
                        <>
                            <ColorElement label="Background" path="background" part={element.background}
                                          swatches={swatches} getColor={(p) => getColor(p, 'background')}
                                          updateValue={updateValue}/>
                            <WaDivider/>
                            <ColorElement label="Over-Background" path="overBackground"
                                          part={element.overBackground}
                                          swatches={swatches} getColor={(p) => getColor(p, 'overBackground')}
                                          updateValue={updateValue}/>
                            <WaDivider/>
                            <ColorElement label="Poles" path="poles" part={element.poles} swatches={swatches}
                                          getColor={(p) => getColor(p, 'poles')} updateValue={updateValue}/>
                            <WaDivider/>
                            <ColorElement label="Text" path="text" part={element.text} swatches={swatches}
                                          getColor={(p) => getColor(p, 'text')} updateValue={updateValue}/>
                            <WaDivider/>
                        </>
                    }
                    {showsDirectionalColors && !showsSurfaceColors &&
                        <>
                            <ColorElement label="Poles" path="poles" part={element.poles} swatches={swatches}
                                          getColor={(p) => getColor(p, 'poles')} updateValue={updateValue}/>
                            <WaDivider/>
                            <ColorElement label="Text" path="text" part={element.text} swatches={swatches}
                                          getColor={(p) => getColor(p, 'text')} updateValue={updateValue}/>
                            <WaDivider/>
                        </>
                    }
                    <ColorElement label="Needle North" path="needle.north" part={element.needle.north}
                                  swatches={swatches} getColor={(p) => getColor(p, 'needle.north')}
                                  updateValue={updateValue}/>
                    <WaDivider/>
                    <ColorElement label="Needle South" path="needle.south" part={element.needle.south}
                                  swatches={swatches} getColor={(p) => getColor(p, 'needle.south')}
                                  updateValue={updateValue}/>
                    <WaDivider/>
                    <ColorElement label="Center Point" path="needle.center" part={element.needle.center}
                                  swatches={swatches} getColor={(p) => getColor(p, 'needle.center')}
                                  updateValue={updateValue}/>
                </div>
            </WaCard>
        </LGSScrollbars>
    )
}
