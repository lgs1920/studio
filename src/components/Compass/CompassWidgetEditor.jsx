/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-23
 * Last modified: 2026-02-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                                            from '@Components/MainUI/LGSScrollbars'
import {
    ColorElement,
}                                                                   from '@Components/MainUI/widgets/editor/elements/ColorElement'
import { COMPASS_FULL, COMPASS_LIGHT }                              from '@Core/constants'
import { faArrowRotateLeft, faCompass, faLocationArrow }            from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDivider, SlIcon, SlRadioButton, SlRadioGroup } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import { colord, extend } from 'colord'
import namesPlugin                                from 'colord/plugins/names'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                            from 'valtio'

extend([namesPlugin])

export const CompassWidgetEditor = ({entity}) => {
    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const $configuration = lgs.settings.widgets['compass-widget'].configuration
    const configuration = useSnapshot($configuration)

    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    /**
     * Format path to kebab-case for CSS variables
     */
    const toKebab = (str) => {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/\./g, '-').toLowerCase()
    }

    /**
     * Resolve CSS variables to actual hex/rgb strings
     */
    const resolveColor = useCallback((color) => {
        if (!color || typeof color !== 'string') {
            return color
        }
        if (color.startsWith('--') || color.startsWith('var(')) {
            const cleanVar = color.startsWith('var(') ? color.replace(/^var\((--.*?)\)$/, '$1') : color
            const resolved = __.ui.css.getCSSVariable(cleanVar)
            if (!resolved || resolved === '' || resolved === cleanVar) {
                return '#ffffff'
            }
            return resolveColor(resolved)
        }
        return color
    }, [])

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
        const variableName = `--lgs-compass-${toKebab(path)}`

        const baseColor = resolveColor(part.color) || resolveColor(variableName)
        const finalColor = formatRGBA(baseColor, part.opacity)

        if (_sceneTarget) {
            __.ui.css.setCSSVariable(variableName, finalColor, _sceneTarget)
        }
        if (_previewTarget) {
            __.ui.css.setCSSVariable(variableName, finalColor, _previewTarget)
        }
    }, [entity, resolveColor, formatRGBA])

    /**
     * Provides the RGBA string for ColorElement preview
     */
    const getColor = useCallback((item, path) => {
        const baseColor = resolveColor(item?.color) || resolveColor(`--lgs-compass-${toKebab(path)}`)
        return formatRGBA(baseColor, item?.opacity)
    }, [resolveColor, formatRGBA])

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
        updateValue('mode', event.target.value)
    }, [updateValue])

    /**
     * Trigger moveable resize when compass mode changes
     * This ensures the handles match the new visual dimensions
     */
    useEffect(() => {
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [element.mode, _moveable])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    if (!element) {
        return null
    }

    return (
        <div className="lgs-widget-editor-controls-wrapper lgs-card" key={`editor-${entity}`}>
            <div className="drawer-horizontal-line">
                <div className="drawer-horizontal-element">
                    <SlRadioGroup label="Model" size="small" value={element.mode} onSlInput={handleCompassMode}
                                  align-right>
                        <SlRadioButton size="small" value={COMPASS_FULL}>
                            <SlIcon size="small" slot="prefix" library="fa" name={FA2SL.set(faCompass)}/>
                            {'Full'}
                        </SlRadioButton>
                        <SlRadioButton size="small" value={COMPASS_LIGHT}>
                            <SlIcon size="small" slot="prefix" library="fa" name={FA2SL.set(faLocationArrow)}/>
                            {'Light'}
                        </SlRadioButton>
                    </SlRadioGroup>
                </div>
                <div className="drawer-horizontal-element">
                    <div className="widget-editor-reset-menus">
                    <SlButton size="small" onClick={handleReset}>
                        <SlIcon size="small" slot="prefix" library="fa" name={FA2SL.set(faArrowRotateLeft)}/>
                        {'Reset'}
                    </SlButton>
                    </div>
                </div>
            </div>
            <SlDivider/>
            <LGSScrollbars>
                <div className="compass-widget-editor-colors">
                    {element.mode === COMPASS_FULL &&
                        <>
                            <ColorElement label="Background" path="background" part={element.background}
                                          swatches={swatches} getColor={(p) => getColor(p, 'background')}
                                          updateValue={updateValue}/>
                            <SlDivider/>
                            <ColorElement label="Over-Background" path="overBackground" part={element.overBackground}
                                          swatches={swatches} getColor={(p) => getColor(p, 'overBackground')}
                                          updateValue={updateValue}/>
                            <SlDivider/>
                            <ColorElement label="Poles" path="poles" part={element.poles} swatches={swatches}
                                          getColor={(p) => getColor(p, 'poles')} updateValue={updateValue}/>
                            <SlDivider/>
                            <ColorElement label="Text" path="text" part={element.text} swatches={swatches}
                                          getColor={(p) => getColor(p, 'text')} updateValue={updateValue}/>
                            <SlDivider/>
                        </>
                    }
                    <ColorElement label="Needle North" path="needle.north" part={element.needle.north}
                                  swatches={swatches} getColor={(p) => getColor(p, 'needle.north')}
                                  updateValue={updateValue}/>
                    <SlDivider/>
                    <ColorElement label="Needle South" path="needle.south" part={element.needle.south}
                                  swatches={swatches} getColor={(p) => getColor(p, 'needle.south')}
                                  updateValue={updateValue}/>
                    <SlDivider/>
                    <ColorElement label="Center Point" path="needle.center" part={element.needle.center}
                                  swatches={swatches} getColor={(p) => getColor(p, 'needle.center')}
                                  updateValue={updateValue}/>
                </div>
            </LGSScrollbars>
        </div>
    )
}