/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widgetContentRealign.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-19
 * Last modified: 2026-06-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGET_SYSTEM_FONT_STACK }                   from '@Core/constants'
import { TextWidgetManager }                          from '@Core/ui/text-metrics/TextWidgetManager'
import { resolveWidgetScaleCorrection }               from '@Core/ui/widget-manager/widgetScaleUtils'

const resolveTextWidgetElement = (moveableId) => {
    const configuration = lgs?.settings?.widgets?.['text-widget']?.configuration

    return configuration?.elements?.[moveableId] ?? configuration?.user ?? configuration?.default ?? null
}

const resolveWidgetCenter = (target, config) => {
    const dimensions = config?.dimensions ?? {
        width:  Number.parseFloat(target?.style?.width || '') || target?.offsetWidth || 0,
        height: Number.parseFloat(target?.style?.height || '') || target?.offsetHeight || 0,
    }
    const position = config?.position ?? {
        left: Number.parseFloat(target?.style?.left || '') || 0,
        top:  Number.parseFloat(target?.style?.top || '') || 0,
    }

    return {
        x: position.left + (dimensions.width / 2),
        y: position.top + (dimensions.height / 2),
    }
}

export const realignWidgetAroundContent = (moveableId) => {
    if (!moveableId || typeof __ === 'undefined' || typeof lgs === 'undefined') {
        return
    }

    const moveable = __.ui.widgetManager.getMoveable(moveableId)
    const target = moveable?.current?.target

    if (!target) {
        moveable?.current?.updateRect?.()
        return
    }

    const config = __.ui.widgetManager.getWidgetConfig(moveableId)
    const element = resolveTextWidgetElement(moveableId)

    if (!config || !element) {
        moveable?.current?.updateRect?.()
        return
    }

    const correction = resolveWidgetScaleCorrection(moveableId)
    const measured = TextWidgetManager.instance.measureContent(element, WIDGET_SYSTEM_FONT_STACK, {
        correction,
        buffer:    0,
    })

    const width = Number.isFinite(measured?.width) ? Math.ceil(measured.width) : 0
    const height = Number.isFinite(measured?.height) ? Math.ceil(measured.height) : 0

    if (width <= 0 || height <= 0) {
        moveable?.current?.updateRect?.()
        return
    }

    const center = resolveWidgetCenter(target, config)
    const nextLeft = center.x - (width / 2)
    const nextTop = center.y - (height / 2)

    target.style.width = `${width}px`
    target.style.height = `${height}px`
    target.style.left = `${nextLeft}px`
    target.style.top = `${nextTop}px`

    config.dimensions = {width, height}
    config.position = {left: nextLeft, top: nextTop}

    if (config.persist && config.runtimeReady) {
        void __.ui.widgetManager.saveWidgetPosition(moveableId, config)
    }

    moveable?.current?.updateRect?.()
}
