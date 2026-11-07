/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-export-render-options.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaNumberInput: ({label, value, onChange, ...props}) => (
        <label>
            {label}
            <input aria-label={label} type="number" value={value} onChange={onChange} {...props}/>
        </label>
    ),
    WaOption: ({children, value}) => <option value={value}>{children}</option>,
    WaSelect: ({label, value, onChange, children, disabled}) => (
        <label>
            {label}
            <select aria-label={label} value={value} onChange={onChange} disabled={disabled}>{children}</select>
        </label>
    ),
}))

import {VideoExportRenderOptions} from '@Components/MainUI/video/toolbox/VideoExportRenderOptions'

describe('VideoExportRenderOptions', () => {
    beforeEach(() => {
        globalThis.lgs = {
            stores: {ui: {video: proxy({})}},
            settings: {ui: {video: proxy({})}},
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
    })

    it('persists renderer, resolution, LOD and readiness choices', async () => {
        render(<VideoExportRenderOptions/>)
        const video = globalThis.lgs.stores.ui.video
        const settings = globalThis.lgs.settings.ui.video

        expect(screen.getByLabelText('Export renderer').value).toBe('visible')
        await act(async () => {
            fireEvent.change(screen.getByLabelText('Export renderer'), {target: {value: 'isolated'}})
            await Promise.resolve()
        })
        expect(video.renderHostMode).toBe('isolated')
        expect(settings.renderHostMode).toBe('isolated')
        await waitFor(() => expect(screen.getByLabelText('Tile readiness').value).toBe('strict'))

        await act(async () => {
            fireEvent.change(screen.getByLabelText('Output resolution'), {target: {value: 'custom'}})
            await Promise.resolve()
        })
        await waitFor(() => expect(screen.getByLabelText('Maximum width')).not.toBeNull())

        await act(async () => {
            fireEvent.change(screen.getByLabelText('Maximum width'), {target: {value: '3000'}})
            fireEvent.change(screen.getByLabelText('Cesium detail'), {target: {value: 'maximum'}})
            fireEvent.change(screen.getByLabelText('Tile readiness'), {target: {value: 'adaptive'}})
            await Promise.resolve()
        })

        expect(video.resolutionProfile).toBe('custom')
        expect(video.customDimensions.width).toBe(3000)
        expect(settings.customDimensions.width).toBe(3000)
        expect(video.renderQuality).toBe('maximum')
        expect(settings.renderQuality).toBe('maximum')
        expect(video.readinessPolicy).toBe('adaptive')
        expect(settings.readinessPolicy).toBe('adaptive')
        await waitFor(() => expect(screen.getByLabelText('Tile readiness').value).toBe('adaptive'))
    })
})
