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
import {
    BackgroundElement,
} from '@Components/MainUI/widgets/editor/elements/BackgroundElement'
import {
    BorderElement,
} from '@Components/MainUI/widgets/editor/elements/BorderElement'
import {
    RotationElement,
} from '@Components/MainUI/widgets/editor/elements/RotationElement'
import {
    ShadowElement,
} from '@Components/MainUI/widgets/editor/elements/ShadowElement'
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

    const updateValue = useCallback((path, val) => {
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
                    updateValue('text', e.target.value)
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
                        <RotationElement element={element}
                                         localRotation={localRotation}
                                         applyRotation={applyRotation}
                                         updateValue={updateValue}/>
                        <SlDivider/>
                        <ShadowElement element={element} swatches={swatches} getColor={getColor}
                                       updateValue={updateValue}/>

                        <SlDivider/>
                        <BorderElement element={element} swatches={swatches} getColor={getColor}
                                       updateValue={updateValue}
                                       showPill={true}/>
                        <SlDivider/>
                        <BackgroundElement element={element} swatches={swatches} getColor={getColor}
                                           updateValue={updateValue}/>

                    </div>
                </LGSScrollbars>
            </div>
        </div>
    )
}