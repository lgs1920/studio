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

import { cleanup, fireEvent, render, screen }              from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy }                                           from 'valtio'

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
    WaSwitch:      ({children, checked, onChange, ...props}) => (
        <label>
            <input type="checkbox" checked={checked} onChange={onChange} {...props}/>
            {children}
        </label>
    ),
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
            },
        }

        globalThis.lgs = {
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
                                                             noLiveData: false,
                                                         }),
                                   }),
                widgets:     {
                    'profile-widget': {
                        configuration: proxy({
                                                 default:  {
                                                     xAxis:      {},
                                                     yAxis:      {},
                                                     gradient:   {
                                                         show: false,
                                                     },
                                                     mainAxis:   {},
                                                     secondAxis: {},
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

        const toggle = screen.getByLabelText('No live data')
        expect(toggle.checked).toBe(false)

        fireEvent.click(toggle)

        expect(lgs.settings.ui.profile.noLiveData).toBe(true)
        expect(__.ui.profiler.draw).toHaveBeenCalled()
    })
})
