/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-20
 * Last modified: 2026-02-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ColorElement }                from '@Components/MainUI/widgets/editor/elements/ColorElement'
import { LGSScrollbars }               from '@Components/MainUI/LGSScrollbars'
import { SlDivider }                   from '@shoelace-style/shoelace/dist/react'
import { colord }                      from 'colord'
import React, { useCallback, useMemo } from 'react'
import { useSnapshot }                 from 'valtio'

export const CompassWidgetEditor = ({entity}) => {
    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const $configuration = lgs.settings.widgets['compass-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $element = $configuration.elements?.[entity]
    const element = configuration.elements?.[entity]

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    /**
     * Get the color string (rgba) from store or CSS variable.
     */
    const getColor = useCallback((item, path) => {
        let colorStr = item?.color

        if (!colorStr) {
            const _target = __.ui.widgetManager.getElementById(entity)
            const variableName = `--lgs-compass-${__.app.kebabCase(path.replace(/\./g, '-'))}`
            colorStr = __.ui.css.getCSSVariable(variableName, _target)
        }

        if (!colorStr || colorStr === '') {
            return 'rgba(255, 255, 255, 1)'
        }

        const c = colord(colorStr)
        return c.alpha(item?.opacity ?? 1).toRgbString()
    }, [entity])

    /**
     * Update proxy and sync CSS variable for instant preview.
     */
    const updateValue = useCallback((path, value) => {
        if (!$element) {
            return
        }

        // 1. Store Update
        const keys = path.split('.')
        let curr = $element
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            if (!curr[key]) {
                curr[key] = {}
            }
            curr = curr[key]
        }
        curr[keys[keys.length - 1]] = value

        // 2. CSS Sync
        // Target the main entity on the scene and the one in the previewer
        const _sceneTarget = __.ui.widgetManager.getElementById(entity)
        const _previewTarget = document.querySelector(`.compass-widget-preview .lgs-compass`)

        const _rootPath = path.replace('.color', '').replace('.opacity', '')
        const variableName = `--lgs-compass-${__.app.kebabCase(_rootPath.replace(/\./g, '-'))}`

        // Reach the part configuration to rebuild the full color
        const _keys = _rootPath.split('.')
        let _part = $element
        for (const key of _keys) {
            _part = _part[key]
        }

        if (_part) {
            // Rebuild color string with alpha channel
            const colorStr = _part.color || getColor(null, _rootPath)
            const finalColor = colord(colorStr).alpha(_part.opacity ?? 1).toRgbString()

            // Apply to scene widget
            if (_sceneTarget) {
                __.ui.css.setCSSVariable(variableName, finalColor, _sceneTarget)
            }

            // Apply to previewer widget
            if (_previewTarget) {
                __.ui.css.setCSSVariable(variableName, finalColor, _previewTarget)
            }
        }

        // 3. Moveable Sync
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$element, entity, _moveable, getColor])

    if (!element) {
        return null
    }

    return (
        <div className="lgs-widget-editor-controls-wrapper lgs-card" key={`editor-${entity}`}>
            <LGSScrollbars>
                <div className="compass-widget-editor-colors">
                    <ColorElement label="Background" path="background" part={element.background} swatches={swatches}
                                  getColor={(p) => getColor(p, 'background')} updateValue={updateValue}/>
                    <SlDivider/>
                    <ColorElement label="Over-Background" path="overBackground" part={element.overBackground}
                                  swatches={swatches}
                                  getColor={(p) => getColor(p, 'overBackground')} updateValue={updateValue}/>
                    <SlDivider/>
                    <ColorElement label="Poles" path="poles" part={element.poles} swatches={swatches}
                                  getColor={(p) => getColor(p, 'poles')} updateValue={updateValue}/>
                    <SlDivider/>
                    <ColorElement label="Text" path="text" part={element.text} swatches={swatches}
                                  getColor={(p) => getColor(p, 'text')} updateValue={updateValue}/>
                    <SlDivider/>
                    <ColorElement label="Needle North" path="needle.north" part={element.needle.north}
                                  swatches={swatches}
                                  getColor={(p) => getColor(p, 'needle.north')} updateValue={updateValue}/>
                    <SlDivider/>
                    <ColorElement label="Needle South" path="needle.south" part={element.needle.south}
                                  swatches={swatches}
                                  getColor={(p) => getColor(p, 'needle.south')} updateValue={updateValue}/>
                    <SlDivider/>
                    <ColorElement label="Center Point" path="needle.center" part={element.needle.center}
                                  swatches={swatches}
                                  getColor={(p) => getColor(p, 'needle.center')} updateValue={updateValue}/>
                </div>
            </LGSScrollbars>
        </div>
    )
}