/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-19
 * Last modified: 2026-02-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                          from '@Components/MainUI/LGSScrollbars'
import { BackgroundElement }                      from '@Components/MainUI/widgets/editor/elements/BackgroundElement'
import { BorderElement }                          from '@Components/MainUI/widgets/editor/elements/BorderElement'
import { RotationElement }                        from '@Components/MainUI/widgets/editor/elements/RotationElement'
import { ShadowElement }                          from '@Components/MainUI/widgets/editor/elements/ShadowElement'
import { TextEditorToolbar }                      from '@Components/Text/TextEditorToolbar'
import { SlDivider }                              from '@shoelace-style/shoelace/dist/react'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                            from 'valtio'
import './style.css'

/**
 * Text Widget Property Editor.
 * Normalized controls for text style and transformations.
 */
export const TextWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    const entityId = typeof entity === 'string' ? entity : ''
    const isTextWidget = entityId.startsWith('text-widget')
    const normalizedId = isTextWidget ? entityId : (widget.current?.id || '')

    useEffect(() => {
        if (!isTextWidget || !entityId || widget.current?.id === entityId) {
            return
        }
        $widget.current = {id: entityId}
    }, [entityId, isTextWidget, widget.current?.id])

    const element = useMemo(() => {
        if (!normalizedId.startsWith('text-widget')) {
            return null
        }
        return configuration.elements?.[normalizedId] ?? configuration.user ?? configuration.default
    }, [configuration, normalizedId])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    const updateValue = useCallback((path, val) => {
        if (!normalizedId.startsWith('text-widget') || !$configuration) {
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

        const _moveable = __.ui.widgetManager.getMoveable(normalizedId)
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [element, normalizedId, $configuration])

    const applyRotation = async (val) => {
        const _instance = __.ui.widgetManager.getElementById(normalizedId)
        if (!isTextWidget || !_instance) {
            return
        }

        const clampedVal = parseFloat(val) || 0
        const {translate, scale} = __.ui.widgetManager.getTransform(_instance)

        __.ui.widgetManager.setTransform(_instance, {translate, scale, rotate: clampedVal})

        if ($widget.current) {
            $widget.current.rotate = clampedVal
        }

        const initConfig = await __.ui.widgetManager.getWidgetConfig(normalizedId)
        const config = await __.ui.widgetManager.retrieveConfig(normalizedId, initConfig)
        config.rotate = clampedVal
        __.ui.widgetManager.saveWidgetPosition(normalizedId, config)
    }

    const getColor = useCallback((item, alpha = false) => __.ui.ui.resolveItemColor(item, alpha), [])

    if (!isTextWidget || !element) {
        return null
    }

    return (
        <div className="lgs-card lgs-widget-editor">
            <div className="text-widget-editor-scroll">
                <LGSScrollbars>
                    <div className="text-widget-editor-header">
                        <TextEditorToolbar id={normalizedId} color={true} align={true} style={true}/>
                        <TextEditorToolbar id={normalizedId} fonts={true} color={false} align={false} style={false}/>
                    </div>

                    <div className="lgs-widget-editor-controls-wrapper">
                        <SlDivider/>

                        <RotationElement
                            element={element}
                            localRotation={widget.current?.rotate ?? 0}
                            applyRotation={applyRotation}
                            updateValue={updateValue}
                        />
                        <SlDivider/>
                        <ShadowElement element={element} swatches={swatches} getColor={getColor}
                                       updateValue={updateValue}/>
                        <SlDivider/>
                        <BorderElement element={element} swatches={swatches} getColor={getColor}
                                       updateValue={updateValue} showPill={true}/>
                        <SlDivider/>
                        <BackgroundElement element={element} swatches={swatches} getColor={getColor}
                                           updateValue={updateValue}/>
                    </div>
                </LGSScrollbars>
            </div>
        </div>
    )
}