/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                                            from '@Components/MainUI/LGSScrollbars'
import {
    ColorElement,
}                                                                   from '@Components/MainUI/widgets/editor/elements/ColorElement'
import { COMPASS_FULL, COMPASS_LIGHT }                              from '@Core/constants'
import { WaButton, WaCard, WaDivider, WaIcon, WaRadio, WaRadioGroup } from '@web.awesome.me/webawesome-pro/dist/react'
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

export const CompassWidgetEditor = ({entity}) => {
    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const $configuration = lgs.settings.widgets['compass-widget'].configuration
    const configuration = useSnapshot($configuration)

    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])
    const compassMode = element?.mode?.toString() ?? ''

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
        if (!$configuration.elements) {
            $configuration.elements = {}
        }
        if (!$configuration.elements[entity]) {
            $configuration.elements[entity] = JSON.parse(JSON.stringify(element))
        }

        const keys = path.split('.')
        let curr = $configuration.elements[entity]
        for (let i = 0; i < keys.length - 1; i++) {
            if (!curr[keys[i]]) {
                curr[keys[i]] = {}
            }
            curr = curr[keys[i]]
        }
        curr[keys[keys.length - 1]] = value

        const _rootPath = path.replace('.color', '').replace('.opacity', '')
        const _keys = _rootPath.split('.')
        let _part = $configuration.elements[entity]
        for (const key of _keys) {
            _part = _part?.[key]
        }

        if (_part && typeof _part === 'object' && _rootPath !== path) {
            syncCSS(_rootPath, _part)
        }

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, element, entity, _moveable, syncCSS])

    const handleReset = useCallback(() => {
        if (!configuration.default) {
            return
        }
        if (!$configuration.elements) {
            $configuration.elements = {}
        }
        $configuration.elements[entity] = JSON.parse(JSON.stringify(configuration.default))

        const defaults = $configuration.elements[entity]
        const paths = ['background', 'overBackground', 'poles', 'text', 'needle.north', 'needle.south', 'needle.center']

        paths.forEach(path => {
            const keys = path.split('.')
            let val = defaults
            for (const key of keys) {
                val = val?.[key]
            }
            if (val) {
                syncCSS(path, val)
            }
        })

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, entity, configuration.default, _moveable, syncCSS])

    const handleCompassMode = useCallback((event) => {
        const mode = Number(event.target.value)
        updateValue('mode', Number.isFinite(mode) ? mode : event.target.value)
    }, [updateValue])

    /**
     * Trigger moveable resize when compass mode changes
     * This ensures the handles match the new visual dimensions
     */
    useEffect(() => {
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [compassMode, _moveable])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    if (!element) {
        return null
    }

    return (
        <WaCard className="lgs-widget-editor-controls-wrapper compass-widget-editor" appearance="plain"
                orientation="vertical" key={`editor-${entity}`}>
            <div className="drawer-horizontal-line">
                <div className="drawer-horizontal-element">
                    <WaRadioGroup size="small" value={compassMode} orientation="horizontal" label-at-start
                                  onChange={handleCompassMode}>
                        <span slot="label">{'Model'}</span>
                        <WaRadio value={COMPASS_FULL.toString()}>
                            <WaIcon size="small" variant="regular" name="compass"/>
                            <span>{'Full'}</span>
                        </WaRadio>
                        <WaRadio value={COMPASS_LIGHT.toString()}>
                            <WaIcon size="small" variant="regular" name="location-arrow"/>
                            <span>{'Light'}</span>
                        </WaRadio>
                    </WaRadioGroup>
                </div>
                <div className="drawer-horizontal-element">
                    <div className="widget-editor-reset-menus">
                        <WaButton size="small" appearance="plain" onClick={handleReset} aria-label="Reset">
                            <WaIcon size="small" variant="regular" name="arrow-rotate-left"/>
                        </WaButton>
                    </div>
                </div>
            </div>
            <WaDivider/>
            <div className="compass-widget-editor-scroll">
                <LGSScrollbars>
                    <div className="compass-widget-editor-colors">
                        {compassMode === COMPASS_FULL.toString() &&
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
                </LGSScrollbars>
            </div>
        </WaCard>
    )
}
