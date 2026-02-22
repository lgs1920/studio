/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
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

import { LGSScrollbars }                                    from '@Components/MainUI/LGSScrollbars'
import {
    BackgroundElement,
}                                                           from '@Components/MainUI/widgets/editor/elements/BackgroundElement'
import {
    BorderElement,
}                                                           from '@Components/MainUI/widgets/editor/elements/BorderElement'
import {
    RotationElement,
}                                                           from '@Components/MainUI/widgets/editor/elements/RotationElement'
import {
    ShadowElement,
}                                                           from '@Components/MainUI/widgets/editor/elements/ShadowElement'
import { TextEditorToolbar }                                from '@Components/Text/TextEditorToolbar'
import { SlDivider }                                        from '@shoelace-style/shoelace/dist/react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot }                                      from 'valtio'
import './style.css'

/**
 * text widget property editor.
 * normalized controls for text style and transformations.
 */
export const TextWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    const [localRotation, setLocalRotation] = useState(0)

    const isTextWidget = entity.startsWith('text-widget')
    const normalizedId = isTextWidget ? entity : (widget.current?.id || '')

    const _moveable = useMemo(() => __.ui.widgetManager.getMoveable(normalizedId), [normalizedId])

    const element = useMemo(() => {
        if (!normalizedId.startsWith('text-widget')) {
            return null
        }
        return configuration.elements?.[normalizedId] ?? configuration.user ?? configuration.default
    }, [configuration, normalizedId])

    /**
     * initialization: sync editor with stage/manager state
     */
    useEffect(() => {
        let isMounted = true
        if (!isTextWidget) {
            return
        }

        const syncInitialState = async () => {
            const position = await __.ui.widgetManager.getWidgetPosition(entity)

            if (isMounted) {
                const angle = position?.rotate !== undefined ? Number(position.rotate) : (element?.rotate ?? 0)
                setLocalRotation(Math.ceil(angle))

                $widget.current = {
                    id:     entity,
                    rotate: angle,
                }
            }
        }

        syncInitialState()
        return () => {
            isMounted = false
        }
    }, [entity, isTextWidget])

    /**
     * sync local rotation with store changes
     */
    useEffect(() => {
        if (widget.current?.rotate !== undefined) {
            setLocalRotation(Math.ceil(widget.current.rotate))
        }
    }, [widget.current?.rotate])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    /**
     * persistent value updater
     */
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
    }, [element, normalizedId, $configuration])

    /**
     * applies rotation to manager, ui store, and configuration
     */
    const applyRotation = async (val) => {
        const angle = parseFloat(val) || 0
        setLocalRotation(angle)

        const _target = __.ui.widgetManager.getElementById(entity)
        if (_target) {
            const transform = await __.ui.widgetManager.getTransform(_target)
            await __.ui.widgetManager.setTransform(_target, {
                ...transform,
                rotate: angle,
            })
        }
        if ($widget.current) {
            $widget.current.rotate = angle
        }
        updateValue('rotate', angle)

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
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
                        <TextEditorToolbar id={normalizedId} fonts={true} color={false} align={false} style={false}/>
                        <TextEditorToolbar id={normalizedId} color={true} align={true} style={true}/>
                    </div>
                    <div className="lgs-widget-editor-controls-wrapper">
                        <SlDivider/>
                        <RotationElement
                            element={element}
                            localRotation={localRotation}
                            applyRotation={applyRotation}
                            updateValue={updateValue}
                        />
                        <SlDivider/>
                        <ShadowElement
                            element={element}
                            swatches={swatches}
                            getColor={getColor}
                            updateValue={updateValue}
                        />
                        <SlDivider/>
                        <BorderElement
                            element={element}
                            swatches={swatches}
                            getColor={getColor}
                            updateValue={updateValue}
                            showPill={true}
                        />
                        <SlDivider/>
                        <BackgroundElement
                            element={element}
                            swatches={swatches}
                            getColor={getColor}
                            updateValue={updateValue}
                        />
                    </div>
                </LGSScrollbars>
            </div>
        </div>
    )
}