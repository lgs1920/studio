/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-18
 * Last modified: 2026-06-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }        from '@Components/MainUI/LGSScrollbars'
import { AlignElement }         from '@Components/MainUI/widgets/editor/elements/AlignElement'
import { BackgroundElement }    from '@Components/MainUI/widgets/editor/elements/BackgroundElement'
import { BorderElement }        from '@Components/MainUI/widgets/editor/elements/BorderElement'
import { FontSizeElement }      from '@Components/MainUI/widgets/editor/elements/FontSizeElement'
import { LineHeightElement }    from '@Components/MainUI/widgets/editor/elements/LineHeightElement'
import { PaddingElement }       from '@Components/MainUI/widgets/editor/elements/PaddingElement'
import { RotationElement }      from '@Components/MainUI/widgets/editor/elements/RotationElement'
import { ScaleSwitchElement }   from '@Components/MainUI/widgets/editor/elements/ScaleSwitchElement'
import { StrokeElement }        from '@Components/MainUI/widgets/editor/elements/StrokeElement'
import { StyleElement }         from '@Components/MainUI/widgets/editor/elements/StyleElement'
import { TextColorElement }     from '@Components/MainUI/widgets/editor/elements/TextColorElement'
import { TextElevationElement } from '@Components/MainUI/widgets/editor/elements/TextElevationElement'
import { TypefaceElement }      from '@Components/MainUI/widgets/editor/elements/TypefaceElement'

import { WaCard, WaDivider } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot }          from 'valtio'
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
    const currentWidgetId = widget.current?.id
    const currentWidgetRotate = widget.current?.rotate

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
                const liveRotation = currentWidgetId === entity && Number.isFinite(Number(currentWidgetRotate))
                                    ? Number(currentWidgetRotate)
                                    : null
                const persistedRotation = Number(element?.rotate ?? 0)
                const positionRotation = position?.rotate !== undefined && Number.isFinite(Number(position.rotate))
                                         ? Number(position.rotate)
                                         : null
                const angle = liveRotation ?? positionRotation ?? persistedRotation
                setLocalRotation(Math.ceil(angle))

                if (currentWidgetId !== entity || currentWidgetRotate === undefined) {
                    $widget.current = {
                        ...($widget.current ?? {}),
                        id:     entity,
                        rotate: angle,
                    }
                }
            }
        }

        syncInitialState()
        return () => {
            isMounted = false
        }
    }, [$widget, currentWidgetId, currentWidgetRotate, element?.rotate, entity, isTextWidget])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    /**
     * persistent value updater
     */
    const updateValue = useCallback((path, val) => {
        if (!normalizedId.startsWith('text-widget') || !$configuration) {
            return
        }
        if (typeof val === 'number' && Number.isNaN(val)) {
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
     * Applies rotation to the widget and updates persistent configuration
     * @param {number|string} val - The rotation angle
     */
    const applyRotation = useCallback(async (val) => {
        const parsedAngle = parseFloat(val)
        const angle = Number.isFinite(parsedAngle) ? parsedAngle : 0
        setLocalRotation(angle)

        const target = __.ui.widgetManager.getElementById(entity)
        if (target) {
            const transform = await __.ui.widgetManager.getTransform(target)
            await __.ui.widgetManager.setTransform(target, {
                ...transform,
                rotate: angle,
            })

            const config = __.ui.widgetManager.getWidgetConfig(entity)
            if (config?.persist) {
                await __.ui.widgetManager.saveWidgetPosition(entity, config)
            }
        }

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }

        // Update ephemeral store for UI sync
        $widget.current = {
            id:     entity,
            rotate: angle,
        }

        // Persist the value to the configuration store
        updateValue('rotate', angle)
    }, [entity, _moveable, $widget, updateValue])


    const resolvedRotation = useMemo(() => {
        if (widget.current?.id !== entity || widget.current?.rotate === undefined) {
            return localRotation
        }

        const angle = Number(widget.current.rotate)
        return Math.ceil(Number.isFinite(angle) ? angle : 0)
    }, [entity, localRotation, widget])

    const getColor = useCallback((item, alpha = false) => __.ui.ui.resolveItemColor(item, alpha), [])

    if (!isTextWidget || !element) {
        return null
    }

    return (
        <LGSScrollbars>
            <WaCard appearance="plain" className="lgs-widget-editor lgs-widget-editor-card">

                <div className="text-widget-editor-header">
                    <TextColorElement id={normalizedId}>
                        <RotationElement localRotation={resolvedRotation}
                                         applyRotation={applyRotation}
                        />
                        <WaDivider/>
                        <PaddingElement element={element} updateValue={updateValue} moveableId={normalizedId}
                                        autoRealign={true}/>
                        <WaDivider/>

                        <div className="drawer-horizontal-line">
                            <TypefaceElement id={normalizedId}/>
                            <LineHeightElement id={normalizedId}/>
                        </div>

                        <div className="drawer-horizontal-line">
                            <FontSizeElement id={normalizedId}/>
                            <div className="drawer-horizontal-line">
                                {!__.device.isMobile ?
                                 <><StyleElement id={normalizedId}/><AlignElement id={normalizedId}/> </> : null}

                            </div>
                        </div>
                        <ScaleSwitchElement
                            checked={element?.scaled ?? true}
                            onChange={(checked) => updateValue('scaled', checked)}
                            className="lgs-widget-scaled-line-right"
                        />
                        {__.device.isMobile ?
                         <div className="drawer-horizontal-line">
                             <StyleElement id={normalizedId}/><AlignElement id={normalizedId}/>
                         </div> : null}
                    </TextColorElement>
                </div>


                <WaDivider/>
                <StrokeElement
                    element={element}
                    swatches={swatches}
                    getColor={getColor}
                    updateValue={updateValue}
                />
                <WaDivider/>
                <TextElevationElement
                    element={element}
                    swatches={swatches}
                    updateValue={updateValue}
                />
                <WaDivider/>
                <BorderElement
                    element={element}
                    swatches={swatches}
                    getColor={getColor}
                    updateValue={updateValue}
                    moveableId={normalizedId}
                    autoRealign={true}
                    showPill={true}
                />
                <WaDivider/>
                <BackgroundElement
                    element={element}
                    swatches={swatches}
                    getColor={getColor}
                    updateValue={updateValue}
                />
            </WaCard>
        </LGSScrollbars>
    )
}
