/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-09
 * Last modified: 2026-01-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TextEditorToolbar }                      from '@Components/Text/TextEditorToolbar'
import {
    SlColorPicker, SlDivider, SlInput, SlOption, SlRange, SlSelect, SlSwitch, SlTextarea,
}                                                 from '@shoelace-style/shoelace/dist/react'
import { colord }                                 from 'colord'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                            from 'valtio'

/**
 * Editor for the Profile Widget configuration using a plain Object
 * Keys are widget IDs (e.g., 'profile-widget#1234')
 * @param {Object} props
 * @param {string} props.entity - The unique ID of the widget
 * @returns {JSX.Element}
 */
export const TextWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)
    const $element = $configuration.elements?.[entity]
    const element = configuration.elements?.[entity]

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

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

    const handleChangeText = useCallback((event) => {
        updateElementValue('text', event.target.value)
        event.preventDefault()
        event.stopPropagation()
    }, [updateElementValue])

    const handleSelectTextShadow = useCallback((event) => {
        updateElementValue('shadow', event.target.value)
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
        <div className="lgs-card text-widget-editor">
            <section>
                <div className="text-widget-editor-header">
                    {'Text'}
                    <TextEditorToolbar id={entity}/>
                </div>
                <SlTextarea resize="auto" size="small"
                            value={element.text}
                            onSlInput={handleChangeText}>
                </SlTextarea>

                <div className="drawer-horizontal-line three-columns">
                    <div className="drawer-horizontal-element">
                        {'Color'}&nbsp;
                        <SlColorPicker
                            size="small" swatches={swatches}
                            value={setColor(element)}
                            onSlInput={(e) => handleChangeColor(e, 'color')}
                        />
                    </div>
                    <div className="drawer-horizontal-element">
                        <SlSelect hoist size="small" value={element.shadow ?? 'none'}
                                  label={'Shadow'} onChange={handleSelectTextShadow}>
                            <SlOption value="none">{'None'}</SlOption>
                            <SlOption value="small">{'Small'}</SlOption>
                            <SlOption value="medium">{'Medium'}</SlOption>
                            <SlOption value="large">{'Large'}</SlOption>
                        </SlSelect>
                    </div>
                    <div className="drawer-horizontal-element xlarge-element">
                        {'Opacity'}
                        <SlRange
                            min="0.1" max="1" step="0.05"
                            tooltipFormatter={opacityFormatter}
                            value={element.opacity ?? 0.5}
                            onSlInput={(e) => handleChangeNumber(e, 'opacity')}
                        />
                    </div>
                </div>

                <SlDivider/>
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
            </section>
        </div>
    )
}