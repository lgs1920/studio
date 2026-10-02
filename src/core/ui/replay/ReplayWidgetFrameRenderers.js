/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayWidgetFrameRenderers.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-10-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { flushSync } from 'react-dom'

/** Imperative widget renderers owned by their mounted component lifecycle. */
const renderers = new Map()

/**
 * Register a widget's synchronous capture preparation and return its teardown.
 * Replacement cleanup cannot unregister a newer instance of the same widget.
 */
export const registerReplayWidgetFrameRenderer = (widgetId, render) => {
    if (!widgetId || typeof render !== 'function') {
        return () => {}
    }
    renderers.set(widgetId, render)
    return () => {
        if (renderers.get(widgetId) === render) {
            renderers.delete(widgetId)
        }
    }
}

/**
 * Commit synchronous Valtio subscribers before reading widget DOM for capture.
 * This boundary advances no clock and is only used by deterministic export.
 */
export const commitReplayWidgetFrame = publish => {
    let frameState = null
    flushSync(() => {
        frameState = publish()
    })
    return frameState
}

/** Render visible imperative surfaces after React has committed the same frame. */
export const renderReplayWidgetFrames = async ({widgetKeys = [], frameState = null} = {}) => {
    await Promise.all(widgetKeys.map(widgetId => renderers.get(widgetId)?.(frameState)))
}
