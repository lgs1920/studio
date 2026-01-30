/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
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

import { LGSScrollbars }                                                  from '@Components/MainUI/LGSScrollbars'
import { TextEditorToolbar }                                              from '@Components/Text/TextEditorToolbar'
import { WIDGET_RADIUS, WIDGET_SYSTEM_FONT_STACK, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import {
    TextWidgetManager,
}                                                                         from '@Core/ui/text-metrics/TextWidgetManager'
import { faArrowRotateLeft }                                              from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlColorPicker, SlDivider, SlIcon, SlInput, SlOption, SlRange, SlSelect, SlSwitch, SlTextarea, SlTooltip,
}                                                                         from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                          from '@Utils/FA2SL'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                    from 'valtio'
import './style.css'

/**
 * Optimized TextArea component with transform override during active editing
 */
const OptimizedTextArea = memo(({value, onInput, dynamicVars, onFocus, onBlur, isEditing}) => {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.stopPropagation()
        }
        if (e.key === 'Backspace') {
            // Prevent bubbling to global listeners that might delete the widget
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

    // Snapshot of the parent store to detect re-assignments of 'current'
    const $widgetStore = lgs.stores.ui.widget
    const widgetStore = useSnapshot($widgetStore)
    const $drawers = lgs.stores.ui.drawers
    const drawers = useSnapshot($drawers)

    // Identity resolution: prefer drawer entity when it targets a text widget
    const entityId = typeof entity === 'string' ? entity : ''
    const isEntityTextWidget = entityId.split('#')[0] === 'text-widget'
    const activeId = isEntityTextWidget ? entityId : widgetStore.current?.id || entity
    const normalizedId = typeof activeId === 'string' ? activeId : ''
    const isTextWidget = normalizedId.split('#')[0] === 'text-widget'

    // Proxy reference for mutations
    const $current = lgs.stores.ui.widget.current
    useEffect(() => {
        if (!isEntityTextWidget || !entityId) {
            return
        }
        if (widgetStore.current?.id === entityId) {
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

    /**
     * Deep update for configuration proxy.
     * Inherits from snapshot to prevent state loss during partial updates.
     */
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

    /**
     * Sync local rotation on activeId change or store rotation update
     */
    useEffect(() => {
        if (!isTextWidget || !widget) {
            return
        }
        const transform = __.ui.widgetManager.getTransform(widget)
        const currentRotate = widgetStore.current?.rotate ?? transform.rotate ?? 0
        setLocalRotation(-Math.ceil(currentRotate))
    }, [isTextWidget, widget, widgetStore.current?.rotate])

    /**
     * Update rotation in DOM and stores
     */
    const applyRotation = async (val) => {
        if (!isTextWidget || !widget || !normalizedId) {
            return
        }
        setLocalRotation(val)
        const {translate, scale} = __.ui.widgetManager.getTransform(widget)
        const targetRotate = -val

        __.ui.widgetManager.setTransform(widget, {translate, scale, rotate: targetRotate})
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }

        if ($current) {
            $current.rotate = targetRotate
        }

        const initConfig = await __.ui.widgetManager.getWidgetConfig(normalizedId)
        const config = await __.ui.widgetManager.retrieveConfig(normalizedId, initConfig)
        config.rotate = targetRotate
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

    const getColor = useCallback((item, alpha = false) => widgetManager.getColor(item, alpha), [widgetManager])

    const dynamicVars = useMemo(() => {
        if (!isTextWidget || !element) {
            return {}
        }
        return {
            ...widgetManager.generateCSSVariables(element, bgSnapshot?.image, WIDGET_SYSTEM_FONT_STACK),
            '--lgs-tx-transform': `rotate(${-localRotation}deg)`,
        }
    }, [bgSnapshot?.image, element, isTextWidget, localRotation, widgetManager])

    useEffect(() => {
        if (isTextWidget) {
            return
        }
        const drawerEntity = typeof drawers.entity === 'string' ? drawers.entity : ''
        const isTextDrawer = drawerEntity.split('#')[0] === 'text-widget'
        if (isTextDrawer && drawers.open === WIDGETS_EDITOR_DRAWER) {
            __.ui.drawerManager.close()
        }
    }, [drawers.entity, drawers.open, isTextWidget])

    if (!isTextWidget || !element) {
        return null
    }

    const hasVisibleContainer = element.background?.show || element.border?.show

    return (
        <div className="lgs-card text-widget-editor" key={activeId}>
            <OptimizedTextArea
                value={element.text}
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


                    <div className="editor-controls-wrapper">
                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-element">
                                <div className="text-widget-rotation">
                                    <SlInput
                                        align-right
                                        size="small"
                                        type="number"
                                        maxlength="2"
                                        step="1"
                                        min="-180" max="180"
                                        value={localRotation}
                                        onSlInput={(e) => applyRotation(parseFloat(e.target.value) || 0)}
                                    >
                                        <span slot="suffix">{'deg'} </span>
                                        <span slot="label">{'Rotation'}</span>
                                    </SlInput>
                                    <SlTooltip content="Reset">
                                        <SlButton size="small" onClick={() => applyRotation(0)}
                                                  className="square-button small">
                                            <SlIcon slot="prefix" size="small" library="fa"
                                                    name={FA2SL.set(faArrowRotateLeft)}/>
                                        </SlButton>
                                    </SlTooltip>
                                </div>
                            </div>
                        </div>

                        <SlDivider/>

                        {/* Text Elevation */}
                        <SlSwitch align-right size="x-small" checked={element.shadow?.show ?? false}
                                  onSlInput={(e) => fastUpdate('shadow.show', e.target.checked)}>
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
                                              onSlChange={(e) => fastUpdate('shadow.value', e.target.value)}>
                                        <SlOption value="small">{'Small'}</SlOption>
                                        <SlOption value="normal">{'Medium'}</SlOption>
                                        <SlOption value="large">{'Large'}</SlOption>
                                    </SlSelect>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange min="0.1" max="1" step="0.05" value={element.shadow?.opacity ?? 1}
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
                                    <SlSwitch
                                        align-right
                                        size="x-small"
                                        checked={element.background.blur ?? false}
                                        onSlChange={(e) => fastUpdate('background.blur', e.target.checked)}
                                    >
                                        {'Blur'}&nbsp;
                                    </SlSwitch>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange min="0.1" max="1" step="0.05" value={element.background.opacity ?? 0.5}
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
                                    <div className="drawer-horizontal-element">
                                        <SlInput type="number" min="1" max="10" value={element.border.thickness ?? 1}
                                                 size="small"
                                                 onSlInput={(e) => fastUpdate('border.thickness', parseInt(e.target.value))}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange min="0.1" max="1" step="0.05" value={element.border.opacity ?? 1}
                                                 onSlInput={(e) => fastUpdate('border.opacity', parseFloat(e.target.value))}/>
                                    </div>
                                </div>

                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element"/>
                                    <div className="drawer-horizontal-element"/>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        Rounded <SlSelect hoist size="small"
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

                        {/* {hasVisibleContainer && ( */}
                        {/*     <> */}
                        {/*         <SlDivider/> */}
                        {/*         <SlSwitch align-right size="x-small" checked={element.background?.shadow?.show ?? false} */}
                        {/*                   onSlInput={(e) => fastUpdate('background.shadow.show', e.target.checked)}> */}
                        {/*             <label>Box elevation</label> */}
                        {/*         </SlSwitch> */}

                        {/*         {element.background?.shadow?.show && ( */}
                        {/*             <div className="drawer-horizontal-line three-columns"> */}
                        {/*                 <div className="drawer-horizontal-element"> */}
                        {/*                     <SlColorPicker size="small" swatches={swatches} */}
                        {/*                                    value={getColor(element.background.shadow)} */}
                        {/*                                    onSlInput={(e) => fastUpdate('background.shadow.color', e.target.value)}/> */}
                        {/*                 </div> */}
                        {/*                 <div className="drawer-horizontal-element"> */}
                        {/*                     <SlSelect hoist size="small" */}
                        {/*                               value={element.background.shadow?.value ?? 'normal'} */}
                        {/*                               onSlChange={(e) => fastUpdate('background.shadow.value', e.target.value)}> */}
                        {/*                         <SlOption value="small">Small</SlOption> */}
                        {/*                         <SlOption value="normal">Medium</SlOption> */}
                        {/*                         <SlOption value="large">Large</SlOption> */}
                        {/*                     </SlSelect> */}
                        {/*                 </div> */}
                        {/*                 <div className="drawer-horizontal-element xlarge-element"> */}
                        {/*                     <SlRange min="0.1" max="1" step="0.05" */}
                        {/*                              value={element.background.shadow?.opacity ?? 1} */}
                        {/*                              onSlInput={(e) => fastUpdate('background.shadow.opacity', parseFloat(e.target.value))}/> */}
                        {/*                 </div> */}
                        {/*             </div> */}
                        {/*         )} */}
                        {/*     </> */}
                        {/* )} */}
                    </div>
                </LGSScrollbars>
            </div>
        </div>
    )
}
