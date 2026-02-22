/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-22
 * Last modified: 2026-02-22
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
import { colord }                                                   from 'colord'
import React, { useCallback, useMemo }                              from 'react'
import { useSnapshot }                                              from 'valtio'


export const CompassWidgetEditor = ({entity}) => {
    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const $configuration = lgs.settings.widgets['compass-widget'].configuration

    /**
     * Snapshot of the global configuration for read access
     */
    const configuration = useSnapshot($configuration)

    /**
     * Resolves the element to display based on entity priority
     */
    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    /**
     * Recursively resolves CSS variables if the color string is a reference
     */
    const resolveColor = (color) => {
        if (!color || typeof color !== 'string') {
            return color
        }
        let finalColor = color
        while (typeof finalColor === 'string' && finalColor.startsWith('--')) {
            const resolved = __.ui.css.getCSSVariable(finalColor)
            if (!resolved || resolved === finalColor) {
                break
            }
            finalColor = resolved
        }
        return finalColor
    }

    /**
     * Resolves the color string by prioritizing the store value, then the CSS variable,
     * and finally a safe fallback.
     */
    const getColor = useCallback((item, path) => {
        let colorStr = item?.color

        // Fallback to CSS variable if no color is defined in the store
        if (!colorStr) {
            const formattedPath = (path || '').replace(/\./g, '-')
            const variableName = `--lgs-compass-${formattedPath}`
            colorStr = __.ui.css.getCSSVariable(variableName)
        }

        const resolved = resolveColor(colorStr)

        // Avoid colord failing on empty strings which results in black
        if (!resolved || resolved === '') {
            return 'rgba(255, 255, 255, 1)'
        }

        const c = colord(resolved)
        return c.alpha(item?.opacity ?? c.alpha()).toRgbString()
    }, [])

    /**
     * Updates the proxy state and synchronizes the DOM visual state via CSS variables
     */
    const updateValue = useCallback((path, value) => {
        if (!$configuration.elements) {
            $configuration.elements = {}
        }

        if (!$configuration.elements[entity]) {
            $configuration.elements[entity] = JSON.parse(JSON.stringify(element))
        }

        // Update value in the store
        const keys = path.split('.')
        let curr = $configuration.elements[entity]
        for (let i = 0; i < keys.length - 1; i++) {
            if (!curr[keys[i]]) {
                curr[keys[i]] = {}
            }
            curr = curr[keys[i]]
        }
        curr[keys[keys.length - 1]] = value

        // Compute CSS variables
        const _sceneTarget = __.ui.widgetManager.getElementById(entity)
        const _previewTarget = document.querySelector(`.compass-widget-preview .lgs-compass`)

        const _rootPath = path.replace('.color', '').replace('.opacity', '')
        const variableName = `--lgs-compass-${__.app.kebabCase(_rootPath.replace(/\./g, '-'))}`

        // Retrieve the freshly updated partial object (e.g., needle.north)
        const _keys = _rootPath.split('.')
        let _part = $configuration.elements[entity]
        for (const key of _keys) {
            _part = _part?.[key]
        }

        if (_part) {
            // Direct resolution to prevent snapshot latency issues
            const rawColor = _part.color || resolveColor(`--lgs-compass-${_rootPath.replace(/\./g, '-')}`) || '#ffffff'
            const finalColor = colord(rawColor).alpha(_part.opacity ?? 1).toRgbString()

            if (_sceneTarget) {
                __.ui.css.setCSSVariable(variableName, finalColor, _sceneTarget)
            }
            if (_previewTarget) {
                __.ui.css.setCSSVariable(variableName, finalColor, _previewTarget)
            }
        }

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, element, entity, _moveable])

    /**
     * Updates the compass visual model mode
     */
    const handleCompassMode = useCallback((event) => {
        updateValue('mode', event.target.value)
    }, [updateValue])

    /**
     * Resets the element to factory default settings
     */
    const handleReset = useCallback(() => {
        if (!configuration.default) {
            return
        }

        // Reset entity-specific configuration if it exists
        if ($configuration.elements?.[entity]) {
            Object.assign($configuration.elements[entity], JSON.parse(JSON.stringify(configuration.default)))
        }
        else if ($configuration.user) {
            // Fallback to resetting user configuration
            Object.assign($configuration.user, JSON.parse(JSON.stringify(configuration.default)))
        }

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, entity, configuration.default, _moveable])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    if (!element) {
        return null
    }

    return (
        <div className="lgs-widget-editor-controls-wrapper lgs-card" key={`editor-${entity}`}>
            <div className="drawer-horizontal-line">
                <div className="drawer-horizontal-element">
                    <SlRadioGroup
                        label={'Model'}
                        size="small"
                        value={element.mode}
                        onSlInput={handleCompassMode}
                        align-right
                    >
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
                    <SlButton size="small" onClick={handleReset}>
                        <SlIcon size="small" slot="prefix" library="fa" name={FA2SL.set(faArrowRotateLeft)}/>
                        {'Reset'}
                    </SlButton>
                </div>
            </div>
            <SlDivider/>
            <LGSScrollbars>
                <div className="compass-widget-editor-colors">
                    {element.mode === COMPASS_FULL &&
                        <>
                            <ColorElement
                                label="Background" path="background" part={element.background} swatches={swatches}
                                getColor={(p) => getColor(p, 'background')} updateValue={updateValue}
                            />
                            <SlDivider/>
                            <ColorElement
                                label="Over-Background" path="overBackground" part={element.overBackground}
                                swatches={swatches}
                                getColor={(p) => getColor(p, 'overBackground')} updateValue={updateValue}
                            />
                            <SlDivider/>
                            <ColorElement
                                label="Poles" path="poles" part={element.poles} swatches={swatches}
                                getColor={(p) => getColor(p, 'poles')} updateValue={updateValue}
                            />
                            <SlDivider/>
                            <ColorElement
                                label="Text" path="text" part={element.text} swatches={swatches}
                                getColor={(p) => getColor(p, 'text')} updateValue={updateValue}
                            />
                            <SlDivider/>
                        </>
                    }
                    <ColorElement
                        label="Needle North" path="needle.north" part={element.needle.north} swatches={swatches}
                        getColor={(p) => getColor(p, 'needle.north')} updateValue={updateValue}
                    />
                    <SlDivider/>
                    <ColorElement
                        label="Needle South" path="needle.south" part={element.needle.south} swatches={swatches}
                        getColor={(p) => getColor(p, 'needle.south')} updateValue={updateValue}
                    />
                    <SlDivider/>
                    <ColorElement
                        label="Center Point" path="needle.center" part={element.needle.center} swatches={swatches}
                        getColor={(p) => getColor(p, 'needle.center')} updateValue={updateValue}
                    />
                </div>
            </LGSScrollbars>
        </div>
    )
}