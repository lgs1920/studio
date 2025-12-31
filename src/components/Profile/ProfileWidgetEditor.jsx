/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-31
 * Last modified: 2025-12-31
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    SlColorPicker, SlDivider, SlInput, SlRadioButton, SlRadioGroup, SlRange, SlSwitch,
}                                        from '@shoelace-style/shoelace/dist/react'
import { IMPERIAL, INTERNATIONAL }       from '@Utils/UnitUtils'
import React, { useCallback, useEffect } from 'react'
import { useSnapshot }                   from 'valtio'

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

    // Access proxies and snapshots via object keys
    const $element = $configuration.elements?.[entity]
    const element = configuration.elements?.[entity]

    /**
     * Updates the specific widget property
     * Valtio detects changes to object properties automatically
     */
    const handleBooleanChange = useCallback((event, item) => {
        console.log(window.isOK(event.target.checked))
        if ($element) {
            $element.item = event.target.checked
        }

        console.log(event, item)
        switch (item) {
            case 'background':
                $element.backdropFilter = null
                $element.border = null
                break

            default:
        }

        event.preventDefault()
        event.stopPropagation()

    }, [$element])

    // Safety check to prevent rendering with undefined data
    if (!element) {
        return null
    }

    const handleChangeColor = (event) => {
        console.log(event)
        event.preventDefault()
        event.stopPropagation()
    }

    return (
        <div className="lgs-card">
            <section className="widget-background-section">
                <SlSwitch
                    align-right="true"
                    size="x-small"
                    checked={element.background ?? false}
                    onSlInput={(e) => handleBooleanChange(e, 'background')}
                >
                    <label>{'Background'}</label>
                </SlSwitch>

                {element.background && (
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element xlarge-element">
                            {'Opacity'}
                            <SlRange min="0.1" max="1" step="0.05" value={element.backdropFilter ?? 0.5}/>
                        </div>
                        <div className="drawer-horizontal-element">
                            {'Color'}
                            <SlColorPicker size="small" disable={!element.background}
                                           onSlChange={handleChangeColor} value={element.backgroundColor ?? 'none'}/>
                        </div>
                        <div className="drawer-horizontal-element">
                            <SlSwitch
                                align-right="true"
                                size="x-small"
                                checked={element.blur ?? false}
                                onSlChange={(e) => handleBooleanChange(e, 'blur')}
                            >
                                {'Blur'}
                            </SlSwitch>
                        </div>
                    </div>
                )}

                <SlDivider/>
                <SlSwitch size="x-small" align-right="true" classNames="vertical-centered">
                    <label>{'Border'}</label>
                </SlSwitch>
                {element.border && (
                    <div className="drawer-horizontal-line  three-columns">
                        <div className="drawer-horizontal-element xlarge-element">
                            {'Opacity'}
                            <SlRange min="0.1" max="1" step="0.05" value={element.backdropFilter ?? 0.5}/>
                        </div>
                        <div className="drawer-horizontal-element">
                            {'Color'}&nbsp;<SlColorPicker size="small" onSlChange={handleChangeColor}
                                                          disable={!element.border}/>
                        </div>
                        <div className="drawer-horizontal-element">
                            {'Thickness'}
                            <SlInput type="number" min="1" max="10"
                                     value={element.border ?? 1}
                                     size="small"
                                     className={'widget-border-field-width'}>
                            </SlInput>
                        </div>
                    </div>
                )}
                <SlDivider/>

                <div className="drawer-horizontal-line">
                    <div className="drawer-horizontal-element xlarge-element">{'Distance:'}</div>
                    <div className="drawer-horizontal-line three-columns">
                        <SlSwitch className="drawer-align-right" size="x-small"
                                  classNames="vertical-centered">{'Axis'}</SlSwitch>
                        <SlSwitch size="x-small" classNames="vertical-centered">{'Labels'}</SlSwitch>
                        <SlSwitch size="x-small" classNames="vertical-centered">{'Units'}</SlSwitch>
                    </div>
                </div>

                <div className="drawer-horizontal-line">
                    <div className="drawer-horizontal-element xlarge-element">{'Elevation:'}</div>
                    <div className="drawer-horizontal-line three-columns">
                        <SlSwitch className="drawer-align-right" size="x-small"
                                  classNames="vertical-centered">{'Axis'}</SlSwitch>
                        <SlSwitch size="x-small" classNames="vertical-centered">{'Labels'}</SlSwitch>
                        <SlSwitch size="x-small" classNames="vertical-centered">{'Units'}</SlSwitch>
                    </div>
                </div>

                <SlDivider/>
                {'Main Axis:'}
                <div className="drawer-horizontal-line  three-columns">
                    <div className="drawer-horizontal-element xlarge-element">
                        {'Opacity'}
                        <SlRange min="0.1" max="1" step="0.05" value={element.backdropFilter ?? 0.5}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Color'}&nbsp;<SlColorPicker size="small" onSlChange={handleChangeColor}
                                                      disable={!element.border}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Thickness'}
                        <SlInput type="number" min="0.5" max="10" step="0.5"
                                 value={element.border ?? 1}
                                 size="small"
                                 className={'widget-border-field-width'}>
                        </SlInput>
                    </div>
                </div>
                {'Secondary Axis:'}
                <div className="drawer-horizontal-line  three-columns">
                    <div className="drawer-horizontal-element xlarge-element">
                        {'Opacity'}
                        <SlRange min="0.1" max="1" step="0.05" value={element.backdropFilter ?? 0.5}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Color'}&nbsp;<SlColorPicker size="small" onSlChange={handleChangeColor}
                                                      disable={!element.border}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Thickness'}
                        <SlInput type="number" min="0.5" max="10" step="0.5"
                                 value={element.border ?? 1}
                                 size="small"
                                 className={'widget-border-field-width'}>
                        </SlInput>
                    </div>
                </div>
            </section>
        </div>
    )
}