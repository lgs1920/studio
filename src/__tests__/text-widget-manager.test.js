/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: text-widget-manager.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-09
 * Last modified: 2026-06-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TextWidgetManager } from '@Core/ui/text-metrics/TextWidgetManager'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('TextWidgetManager', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                ui: {
                    resolveItemColor: () => 'rgba(255, 255, 255, 1)',
                },
            },
        }
    })

    afterEach(() => {
        globalThis.__ = undefined
    })

    it('measures text content with scaled font and padding', () => {
        const manager = TextWidgetManager.instance
        const element = {
            size:       20,
            lineHeight: 1.5,
            fontFamily: 'System',
            weight:     '700',
            style:      'normal',
            padding:    {
                top:    8,
                right:  10,
                bottom: 12,
                left:   14,
                scaled: false,
            },
            border:     {
                show:    true,
                thickness: 2,
                scaled:  false,
            },
            text:       {
                content: 'Hello\nWorld',
                stroke:  {
                    show:  true,
                    width: 1,
                },
            },
        }

        const measured = manager.measureContent(element, 'system-ui', {
            correction: 2,
            buffer:     4,
        })

        expect(measured.width).toBeGreaterThan(60)
        expect(measured.height).toBeGreaterThan(100)
    })

    it('exposes textarea padding variables with line-height trim', () => {
        const manager = TextWidgetManager.instance
        const variables = manager.generateCSSVariables({
            size:       20,
            lineHeight: 1.4,
            fontFamily: 'System',
            padding:    {
                top:    8,
                right:  10,
                bottom: 12,
                left:   14,
            },
            border: {
                show: false,
            },
            background: {
                show: false,
            },
            text: {
                content: 'Hello',
            },
        }, null, 'system-ui')

        expect(variables['--lgs-tx-textarea-line-trim']).toBe('calc((var(--lgs-tx-line-height) - 1em) / 2)')
        expect(variables['--lgs-tx-textarea-padding-top']).toContain('var(--lgs-tx-padding-top)')
        expect(variables['--lgs-tx-textarea-padding-bottom']).toContain('var(--lgs-tx-padding-bottom)')
    })
})
