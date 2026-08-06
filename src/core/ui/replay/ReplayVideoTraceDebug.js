/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoTraceDebug.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const TRACE_BUFFER_LIMIT = 1000
const TRACE_GLOBAL_KEY = '__lgsReplayVideoTrace'

const safeValue = (value, depth = 0) => {
    if (value === null || value === undefined) {
        return value
    }

    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'function') {
        return '[function]'
    }

    if (typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement) {
        return {
            type:   'canvas',
            width:  value.width,
            height: value.height,
        }
    }

    if (depth >= 2) {
        return '[object]'
    }

    if (Array.isArray(value)) {
        return value.slice(0, 12).map(item => safeValue(item, depth + 1))
    }

    if (typeof value === 'object') {
        const result = {}
        Object.entries(value).slice(0, 32).forEach(([key, item]) => {
            result[key] = safeValue(item, depth + 1)
        })
        return result
    }

    return `${value}`
}

export const replayVideoTraceDebug = (event, payload = {}) => {
    const root = globalThis
    const buffer = Array.isArray(root[TRACE_GLOBAL_KEY])
                   ? root[TRACE_GLOBAL_KEY]
                   : (root[TRACE_GLOBAL_KEY] = [])
    const previous = buffer.at?.(-1)
    const entry = {
        index: Number.isFinite(Number(previous?.index)) ? previous.index + 1 : 0,
        time:  root.performance?.now?.() ?? Date.now(),
        event,
        data:  safeValue(payload),
    }

    buffer.push(entry)
    while (buffer.length > TRACE_BUFFER_LIMIT) {
        buffer.shift()
    }

    return entry
}
