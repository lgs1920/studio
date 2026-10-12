/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-content-height.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-12
 * Last modified: 2026-10-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WidgetCoreControls} from '@Core/ui/widget-manager/WidgetCoreControls'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

describe('content-height widget initialization', () => {
    let controls
    let element
    let content
    let config

    beforeEach(() => {
        controls = new WidgetCoreControls({})
        element = document.createElement('div')
        content = document.createElement('aside')
        content.className = 'monitor'
        element.appendChild(content)
        element.getBoundingClientRect = () => ({width: 640, height: 480})
        content.getBoundingClientRect = () => ({width: 640, height: 156})
        const container = {
            getBoundingClientRect: () => ({left: 0, top: 0, right: 1200, bottom: 900, width: 1200, height: 900}),
        }
        config = {
            container,
            position: {left: 400, top: 300},
            dimensions: {width: 640, height: 480},
            fromRuntime: true,
            resizable: true,
            min: {width: 360, height: 120},
            max: {width: 1280, height: 900},
            resizeToContent: {target: '.monitor', height: true, minHeight: true},
        }
        vi.stubGlobal('__', {ui: {widgetManager: {}}})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it.each(['fromRuntime', 'fromDB'])('fits restored %s dimensions to compact content while retaining position and width', source => {
        config.fromRuntime = false
        config[source] = true

        const position = controls.computeInitialPosition(config, element)

        expect(config.dimensions).toEqual({width: 640, height: 156})
        expect(position).toEqual({left: 400, top: 300})
    })

    it('expands a saved Dry run height when frame-preview content returns', () => {
        config.dimensions.height = 156
        config.min.height = 280
        config.resizeToContent.height = false
        content.getBoundingClientRect = () => ({width: 640, height: 460})

        controls.computeInitialPosition(config, element)

        expect(config.dimensions).toEqual({width: 640, height: 460})
    })

    it('uses compact content dimensions before anchoring a fresh widget', () => {
        config.fromRuntime = false
        config.attachTo = 'bottom-right'
        config.left = '100%'
        config.top = '100%'
        config.margin = 8
        __.ui.widgetManager.transform = {parsePosition: (_, size) => size}

        const position = controls.computeInitialPosition(config, element)

        expect(config.dimensions).toEqual({width: 640, height: 156})
        expect(position).toEqual({left: 552, top: 736})
    })

    it('preserves restored dimensions when content constraints are explicitly disabled', () => {
        config.constrainResizeToContent = false

        controls.computeInitialPosition(config, element)

        expect(config.dimensions).toEqual({width: 640, height: 480})
    })

    it('retains a user-enlarged preview height when it already fits the content', () => {
        config.resizeToContent.height = false

        controls.computeInitialPosition(config, element)

        expect(config.dimensions).toEqual({width: 640, height: 480})
    })

    it('keeps collapsed host dimensions independent of the expanded content', () => {
        config.collapsed = true
        config.dimensions = {width: 40, height: 40}

        controls.computeInitialPosition(config, element)

        expect(config.dimensions).toEqual({width: 40, height: 40})
    })
})
