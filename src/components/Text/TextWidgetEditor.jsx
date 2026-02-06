/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-06
 * Last modified: 2026-02-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                                                  from '@Components/MainUI/LGSScrollbars'
import { TextEditorToolbar }                                              from '@Components/Text/TextEditorToolbar'
import { WIDGET_RADIUS, WIDGET_SYSTEM_FONT_STACK, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import {
    TextWidgetManager,
}                                                                         from '@Core/ui/text-metrics/TextWidgetManager'
import {
    SlColorPicker, SlDivider, SlInput, SlOption, SlRange, SlSelect, SlSwitch, SlTextarea,
}                                                                         from '@shoelace-style/shoelace/dist/react'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                    from 'valtio'
import './style.css'

/**
 * Optimized TextArea component with transform override during active editing
 */
const OptimizedTextArea = memo(({value, onInput, dynamicVars, onFocus, onBlur, isEditing}) => {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Backspace') {
            e.stopPropagation()
        }
    }

    const style = {
        ...dynamicVars,
        '--lgs-tx-transform': isEditing ? 'none' : dynamicVars['--lgs-tx-transform'],
    }

    return (
        <div style={style} className="text-widget-preview-container">
            <SlTextarea
                className="text-widget-preview-area"
                size="small"
                value={value}
                onSlInput={onInput}
                onSlFocus={onFocus}
                onSlBlur={onBlur}
                onKeyDown={handleKeyDown}
                enterkeyhint="enter"
            />
        </div>
    )
})

export const TextWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $widgetStore = lgs.stores.ui.widget
    const widgetStore = useSnapshot($widgetStore)

    const entityId = typeof entity === 'string' ? entity : ''
    const isEntityTextWidget = entityId.split('#')[0] === 'text-widget'
    const activeId = isEntityTextWidget ? entityId : widgetStore.current?.id || entity
    const normalizedId = typeof activeId === 'string' ? activeId : ''
    const isTextWidget = normalizedId.split('#')[0] === 'text-widget'

    const $current = lgs.stores.ui.widget.current

    useEffect(() => {
        if (!isEntityTextWidget || !entityId || widgetStore.current?.id === entityId) {
            return
        }
        $widgetStore.current = {id: entityId}
    }, [entityId, isEntityTextWidget, $widgetStore, widgetStore.current?.id])

    const element = isTextWidget
                    ? (configuration?.elements?.[normalizedId] ?? configuration.user ?? configuration.default)
                    : null

    const widget = useMemo(() => {
        if (!isTextWidget || !normalizedId) {
            return null
        }
        return __.ui.widgetManager.getElementById(normalizedId)
    }, [isTextWidget, normalizedId])

    const bgSnapshot = widgetStore.currentSnapshot
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const widgetManager = useMemo(() => TextWidgetManager.instance, [])

    const [localRotation, setLocalRotation] = useState(0)
    const [isEditing, setIsEditing] = useState(false)
    const _timer = useRef(null)
    const _moveable = useMemo(() => {
        if (!isTextWidget || !normalizedId) {
            return null
        }
        return __.ui.widgetManager.getMoveable(normalizedId)
    }, [isTextWidget, normalizedId])

    const fastUpdate = useCallback((path, val) => {
        if (!isTextWidget || !$configuration || !normalizedId) {
            return
        }

        if (!$configuration.elements) {
            $configuration.elements = {}
        }
        if (!$configuration.elements[normalizedId]) {
            $configuration.elements[normalizedId] = JSON.parse(JSON.stringify(element))
        }

        const _keys = path.split('.')
        let _curr = $configuration.elements[normalizedId]
        let _source = element

        for (let i = 0; i < _keys.length - 1; i++) {
            const _key = _keys[i]
            if (!_curr[_key] || typeof _curr[_key] !== 'object') {
                _curr[_key] = _source?.[_key] ? JSON.parse(JSON.stringify(_source[_key])) : {}
            }
            _curr = _curr[_key]
            _source = _source?.[_key]
        }

        _curr[_keys[_keys.length - 1]] = val

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, element, isTextWidget, normalizedId, _moveable])

    useEffect(() => {
        if (!isTextWidget || !widget) {
            return
        }
        const transform = __.ui.widgetManager.getTransform(widget)
        const currentRotate = widgetStore.current?.rotate ?? transform.rotate ?? 0
        setLocalRotation(Math.ceil(currentRotate))
    }, [isTextWidget, widget, widgetStore.current?.rotate])

    const applyRotation = async (val) => {
        if (!isTextWidget || !widget || !normalizedId) {
            return
        }
        const clampedVal = parseFloat(val) || 0
        setLocalRotation(clampedVal)
        const {translate, scale} = __.ui.widgetManager.getTransform(widget)

        __.ui.widgetManager.setTransform(widget, {translate, scale, rotate: clampedVal})
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
        if ($current) {
            $current.rotate = clampedVal
        }

        const initConfig = await __.ui.widgetManager.getWidgetConfig(normalizedId)
        const config = await __.ui.widgetManager.retrieveConfig(normalizedId, initConfig)
        config.rotate = clampedVal
        __.ui.widgetManager.saveWidgetPosition(normalizedId, config)
    }

    const resetRotationTimer = useCallback(() => {
        if (_timer.current) {
            clearTimeout(_timer.current)
        }
        _timer.current = setTimeout(() => setIsEditing(false), 1000)
    }, [])

    const scheduleMoveableUpdate = useCallback(() => {
        if (_moveable?.current) {
            requestAnimationFrame(() => _moveable.current.updateRect())
        }
    }, [_moveable])

    const getColor = useCallback((item, alpha = false) => __.ui.ui.resolveItemColor(item, alpha), [])

    const dynamicVars = useMemo(() => {
        if (!isTextWidget || !element) {
            return {}
        }
        return {
            ...widgetManager.generateCSSVariables(element, bgSnapshot?.image, WIDGET_SYSTEM_FONT_STACK),
            '--lgs-tx-transform': `rotate(${localRotation}deg)`,
        }
    }, [bgSnapshot?.image, element, isTextWidget, localRotation, widgetManager])

    if (!isTextWidget || !element) {
        return null
    }

    return (
        <div className="lgs-card lgs-widget-editor" key={activeId}>
            <OptimizedTextArea
                value={element.text.content}
                onInput={(e) => {
                    fastUpdate('text', e.target.value)
                    scheduleMoveableUpdate()
                    if (isEditing) {
                        resetRotationTimer()
                    }
                }}
                onFocus={() => setIsEditing(true)}
                onBlur={resetRotationTimer}
                isEditing={isEditing}
                dynamicVars={dynamicVars}
            />
            <div className="text-widget-editor-scroll">
                <LGSScrollbars>
                    <div className="text-widget-editor-header">
                        <TextEditorToolbar id={activeId} color={true} align={true} style={true}/>
                        <TextEditorToolbar id={activeId} fonts={true} color={false} align={false} style={false}/>
                    </div>

                    <div className="lgs-widget-editor-controls-wrapper">

                        {/* Rotation Header: Label + Input + Range + Switch */}
                        <SlDivider/>
                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-element">
                                <label>{'Rotation'}</label>
                                <SlInput
                                    size="small"
                                    type="number"
                                    value={-localRotation}
                                    style={{marginLeft: 'auto', width: '5rem'}}
                                    step="1" min="-180" max="180"
                                    onSlInput={(e) => applyRotation(-parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div className="drawer-horizontal-element xlarge-element">
                                <SlRange
                                    min="-180" max="180" step="1" align-right
                                    value={-localRotation}
                                    tooltip="bottom"
                                    style={{'--track-active-offset': '50%'}}
                                    onSlInput={(e) => applyRotation(-parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div className="drawer-horizontal-element">
                                <SlSwitch
                                    align-right
                                    size="x-small"
                                    checked={localRotation !== 0}
                                    disabled={localRotation === 0}
                                    onSlChange={(e) => {
                                        if (!e.target.checked) {
                                            applyRotation(0)
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <SlDivider/>

                        {/* Text Elevation */}
                        <SlSwitch align-right size="x-small" checked={element.shadow?.show ?? false}
                                  onSlInput={(e) => fastUpdate('text.shadow.show', e.target.checked)}>
                            <label>{'Text elevation'}</label>
                        </SlSwitch>

                        {element.shadow?.show && (
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlColorPicker size="small" swatches={swatches} value={getColor(element.shadow)}
                                                   onSlInput={(e) => fastUpdate('shadow.color', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlSelect hoist size="small" value={element.shadow?.value ?? 'normal'}
                                              style={{marginLeft: 'auto', width: '6rem'}}
                                              onSlChange={(e) => fastUpdate('shadow.value', e.target.value)}>
                                        <SlOption value="small">{'Small'}</SlOption>
                                        <SlOption value="normal">{'Medium'}</SlOption>
                                        <SlOption value="large">{'Large'}</SlOption>
                                    </SlSelect>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right tooltip="bottom"
                                             value={element.shadow?.opacity ?? 1}
                                             onSlInput={(e) => fastUpdate('shadow.opacity', parseFloat(e.target.value))}/>
                                </div>
                            </div>
                        )}

                        <SlDivider/>

                        {/* Background */}
                        <SlSwitch align-right size="x-small" checked={element.background?.show ?? false}
                                  onSlInput={(e) => fastUpdate('background.show', e.target.checked)}>
                            <label>{'Background'}</label>
                        </SlSwitch>

                        {element.background?.show && (
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlColorPicker size="small" swatches={swatches} value={getColor(element.background)}
                                                   onSlInput={(e) => fastUpdate('background.color', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlSwitch align-right size="x-small" checked={element.background.blur ?? false}
                                              onSlChange={(e) => fastUpdate('background.blur', e.target.checked)}>
                                        {'Blur'}&nbsp;
                                    </SlSwitch>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right tooltip="bottom"
                                             value={element.background.opacity ?? 0.5}
                                             onSlInput={(e) => fastUpdate('background.opacity', parseFloat(e.target.value))}/>
                                </div>
                            </div>
                        )}

                        <SlDivider/>

                        {/* Border */}
                        <SlSwitch align-right size="x-small" checked={element.border?.show ?? false}
                                  onSlInput={(e) => fastUpdate('border.show', e.target.checked)}>
                            <span>{'Border'}</span>
                        </SlSwitch>

                        {element.border?.show && (
                            <>
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">
                                        <SlColorPicker size="small" swatches={swatches} value={getColor(element.border)}
                                                       onSlInput={(e) => fastUpdate('border.color', e.target.value)}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Width" min="1" max="20" step="1" align-right
                                                 value={element.border.thickness ?? 1}
                                                 onSlInput={(e) => fastUpdate('border.thickness', parseInt(e.target.value))}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right
                                                 value={element.border.opacity ?? 1}
                                                 onSlInput={(e) => fastUpdate('border.opacity', parseFloat(e.target.value))}/>
                                    </div>
                                </div>
                                <div className="drawer-horizontal-line">
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlSelect hoist size="small" label="Radius" align-right
                                                  style={{marginLeft: 'auto', width: '10rem'}}
                                                  value={element.border.radius ?? 'none'}
                                                  onSlChange={(e) => fastUpdate('border.radius', e.target.value)}>
                                            {[...WIDGET_RADIUS.entries()].map(([_key, _data]) => (
                                                <SlOption key={_key} value={_key}>
                                                    {_data.name}
                                                </SlOption>
                                            ))}
                                        </SlSelect>
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