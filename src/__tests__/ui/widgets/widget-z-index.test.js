import { describe, expect, it } from 'vitest'
import { resolveActiveWidgetZIndex } from '@Components/MainUI/widgets/widgetZIndex'

describe('resolveActiveWidgetZIndex', () => {
    it('keeps Credits and Logo above ordinary widgets even with persisted lower layers', () => {
        const widgets = new Map([
            ['credits-widget', {zIndex: 4000}],
            ['logo-widget', {zIndex: 4001}],
            ['text-widget#1', {zIndex: 12000}],
        ])

        expect(resolveActiveWidgetZIndex({
            widgetId:         'credits-widget',
            widgetListSnapshot: widgets,
            config:            {zIndex: 4000},
            widgetDefinition:  {alwaysOnTop: true},
        })).toBe(12001)

        expect(resolveActiveWidgetZIndex({
            widgetId:         'logo-widget',
            widgetListSnapshot: widgets,
            config:            {zIndex: 4001},
            widgetDefinition:  {alwaysOnTop: true},
        })).toBe(12001)
    })

    it('does not change ordinary widget layers', () => {
        const widgets = new Map([['text-widget#1', {zIndex: 4002}]])

        expect(resolveActiveWidgetZIndex({
            widgetId:         'text-widget#1',
            widgetListSnapshot: widgets,
            config:            {zIndex: 4002},
            widgetDefinition:  {},
        })).toBe(4002)
    })
})
