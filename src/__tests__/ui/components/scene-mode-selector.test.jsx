/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: scene-mode-selector.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-26
 * Last modified: 2026-11-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@awesome.me/webawesome/dist/react', async () => {
    const React = await import('react')
    return {
        WaButton: ({children, id, onClick, disabled, role, ...props}) => React.createElement('button', {
            id,
            onClick,
            disabled,
            role,
            'aria-haspopup': props['aria-haspopup'],
            'aria-expanded': props['aria-expanded'],
        }, children),
        WaIcon: ({name}) => React.createElement('span', {'data-icon': name}),
        WaTooltip: ({children}) => React.createElement('span', null, children),
    }
})

vi.mock('@Components/LGSPopup', async () => {
    const React = await import('react')
    return {
        LGSPopup: ({active, children}) => active ? React.createElement('div', null, children) : null,
    }
})

import { SceneModeSelector } from '@Components/MainUI/SceneModeSelector'

beforeEach(() => {
    vi.stubGlobal('lgs', {
        settings: proxy({scene: {mode: {value: 3, available: [2, 3, 2.5]}}}),
        stores:   {ui: {mainUI: proxy({rotate: {running: false}, panorama: {active: false}})}},
        gutter:   {xs: '4px'},
    })
    vi.stubGlobal('__', {ui: {sceneManager: {morph: vi.fn(), afterMorphing: vi.fn()}}})
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('scene mode selector', () => {
    it('omits 2D from selectable modes and keeps the remaining supported mode', () => {
        const {container} = render(<SceneModeSelector/>)

        fireEvent.click(container.querySelector('#scene-mode-trigger'))

        expect(container.querySelector('[id="scene-mode-2"]')).toBeNull()
        expect(container.querySelector('[id="scene-mode-2.5"]')).not.toBeNull()
    })

    it('hides the selector when 3D is the only remaining mode', () => {
        lgs.settings.scene.mode.available = [2, 3]

        const {container} = render(<SceneModeSelector/>)

        expect(container.querySelector('.scene-mode-selector')).toBeNull()
    })
})
