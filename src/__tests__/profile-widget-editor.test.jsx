/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profile-widget-editor.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-06-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor }     from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                                           from 'valtio'

let widgetConfig
let widgetElement

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <div>{children}</div>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/BackgroundElement', () => ({
    BackgroundElement: () => <div data-testid="background-element"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/BorderElement', () => ({
    BorderElement: () => <div data-testid="border-element"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/PaddingElement', () => ({
    PaddingElement: () => <div data-testid="padding-element"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/ScaleSwitchElement', () => ({
    ScaleSwitchElement: () => <div data-testid="scale-switch-element"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/elements/sliderUtils', () => ({
    formatSliderPercent: value => `${value}%`,
}))
vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton:      ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaCard:        ({children}) => <div>{children}</div>,
    WaColorPicker: props => <input data-testid="color-picker" {...props}/>,
    WaDivider:     () => <hr/>,
    WaIcon:        ({name}) => <span data-icon={name}/>,
    WaNumberInput: ({label, onInput, value, children, ...props}) => {
        delete props['label-at-start']
        delete props['width-auto']
        delete props['no-start']
        return (
            <label>
                {label}
                <input aria-label={label} type="number" value={value ?? ''} onInput={onInput} {...props}/>
                {children}
            </label>
        )
    },
    WaOption:      ({children, value}) => <option value={value}>{children}</option>,
    WaSelect:      ({label, onChange, value, children, ...props}) => {
        delete props['label-at-start']
        delete props['width-auto']
        delete props['no-start']
        return (
            <label>
                {label}
                <select aria-label={label} value={value} onChange={onChange} {...props}>
                    {children}
                </select>
            </label>
        )
    },
    WaSlider:      ({label, onInput, value, defaultValue, ...props}) => (
        <label>
            {label}
            <input
                aria-label={label}
                value={value ?? defaultValue ?? ''}
                onInput={onInput}
                {...props}
            />
        </label>
    ),
    WaSwitch:      ({children, checked, onChange, ...props}) => {
        delete props['label-at-start']
        delete props['width-auto']
        return (
            <label>
                <input type="checkbox" checked={checked} onChange={onChange} {...props}/>
                {children}
            </label>
        )
    },
}))

import { ProfileWidgetEditor } from '@Components/Profile/ProfileWidgetEditor'

describe('ProfileWidgetEditor', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                profiler: {
                    draw:        vi.fn(),
                    prepareData: vi.fn(() => ({
                        options: [{color: '#3b82f6'}],
                    })),
                },
                css:      {
                    getCSSVariable: vi.fn(value => value),
                },
                widgetManager: {
                    getElementById:     vi.fn(() => widgetElement),
                    getMoveable:        vi.fn(() => ({current: {updateRect: vi.fn()}})),
                    getWidgetConfig:    vi.fn(() => widgetConfig),
                    saveWidgetPosition: vi.fn(),
                    setConfig:          vi.fn(),
                    refreshEditorPreviewSnapshot: vi.fn(),
                },
            },
            app: {},
        }

        widgetConfig = {
            persist: true,
            position: {left: 100, top: 100},
            dimensions: {width: 1600, height: 300},
            ratio:   {
                value:       '16x9',
                aspectRatio: 16 / 9,
                locked:      true,
                width:       16,
                height:      9,
            },
        }

        widgetElement = {
            style: {
                left:   '100px',
                top:    '100px',
                width:  '1600px',
                height: '300px',
            },
            getBoundingClientRect: vi.fn(() => ({
                left:   100,
                top:    100,
                width:  1600,
                height: 300,
            })),
        }

        globalThis.lgs = {
            configuration: {
                videoFormats: [
                    {value: '1x1', label: '1:1', aspectRatio: 1},
                    {value: '16x9', label: '16:9', aspectRatio: 16 / 9},
                ],
                widgetRatio: {value: '16x9', label: '16:9', aspectRatio: 16 / 9},
            },
            settings: {
                getSwatches: {
                    list: ['#ffffff', '#000000'],
                },
                ui:          proxy({
                                       flythrough: proxy({
                                                             profileInfo: proxy({
                                                                                    color:         '#ffffff',
                                                                                    useTrackStyle: false,
                                                                                }),
                                                         }),
                                       profile:    proxy({
                                                             liveData: false,
                                                         }),
                                   }),
                widgets:     {
                    'profile-widget': {
                        configuration: proxy({
                                                 default: {
                                                     show: true,
                                                     background: {
                                                         show: true,
                                                         color: '#ffffff',
                                                         opacity: 0.15,
                                                         blur: true,
                                                         shadow: {
                                                             show: true,
                                                             value: 'normal',
                                                             color: '#000000',
                                                             opacity: 0.5,
                                                         },
                                                     },
                                                     border: {
                                                         show: true,
                                                         color: '#ffffff',
                                                         opacity: 0.5,
                                                         thickness: 1,
                                                         scaled: false,
                                                     },
                                                     padding: {
                                                         top: 8,
                                                         right: 8,
                                                         bottom: 8,
                                                         left: 8,
                                                         scaled: false,
                                                     },
                                                     xAxis: {
                                                         main: true,
                                                         second: true,
                                                         labels: true,
                                                         units: true,
                                                     },
                                                     yAxis: {
                                                         main: true,
                                                         second: true,
                                                         labels: true,
                                                         units: true,
                                                     },
                                                     mainAxis: {
                                                         color: '--lgs-dark-color',
                                                         opacity: 0.8,
                                                         thickness: 1,
                                                         scaled: false,
                                                     },
                                                     secondAxis: {
                                                         color: '--lgs-light-color',
                                                         opacity: 0.6,
                                                         thickness: 0.5,
                                                         scaled: false,
                                                     },
                                                     shadow: {
                                                         show: true,
                                                         value: 'normal',
                                                         color: '#000000',
                                                         opacity: 0.5,
                                                     },
                                                     gradient: {
                                                         show: true,
                                                         color: null,
                                                     },
                                                 },
                                                 user:     null,
                                                 elements: {},
                                             }),
                    },
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('toggles the no live data profile setting', () => {
        render(<ProfileWidgetEditor entity="default"/>)

        const toggle = screen.getByLabelText('Show live data')
        expect(toggle.checked).toBe(false)

        fireEvent.click(toggle)

        expect(lgs.settings.ui.profile.liveData).toBe(true)
        expect(__.ui.profiler.draw).toHaveBeenCalled()
    })

    it('updates the widget ratio preset and keeps custom dimensions independent', async () => {
        render(<ProfileWidgetEditor entity="profile-widget#1"/>)

        fireEvent.change(screen.getByLabelText('Ratio'), {target: {value: 'custom'}})
        const widthInput = await screen.findByLabelText('Width (px)')
        const heightInput = await screen.findByLabelText('Height (px)')

        fireEvent.input(widthInput, {target: {value: '400'}})
        expect(heightInput.value).toBe('300')

        fireEvent.input(heightInput, {target: {value: '500'}})
        expect(widthInput.value).toBe('400')
        expect(heightInput.value).toBe('320')

        expect(__.ui.widgetManager.setConfig).toHaveBeenCalled()
        expect(__.ui.widgetManager.saveWidgetPosition).toHaveBeenCalled()
        expect(widgetConfig.ratio.value).toBe('custom')
        expect(widgetConfig.ratio.aspectRatio).toBeCloseTo(1.25)
        expect(widgetConfig.ratio.width).toBe(400)
        expect(widgetConfig.ratio.height).toBe(320)
        expect(widgetConfig.ratio.locked).toBe(true)
        expect(widgetElement.style.width).toBe('400px')
        expect(widgetElement.style.height).toBe('320px')
        expect(__.ui.profiler.draw).toHaveBeenCalled()
    })

    it('exposes the updated preset list', () => {
        render(<ProfileWidgetEditor entity="profile-widget#1"/>)

        expect(screen.getByRole('option', {name: 'Large'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'X large'})).toBeTruthy()
        expect(screen.getByRole('option', {name: 'Golden'})).toBeTruthy()
        expect(screen.queryByRole('option', {name: '4:3'})).toBeNull()
    })
})
