/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-13
 * Last modified: 2025-07-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { useSnapshot }                  from 'valtio'
import { SlSelect, SlOption, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import './style.css'

export const CropSelector = () => {
    const $cropper = lgs.stores.main.components.cropper
    const state = useSnapshot($cropper)

    const ratioPresets = __.presets.ratios.filter(
        r => r.orientation === state.orientation || r.orientation === 'square',
    )
    const sizePresets = __.presets.sizes.filter(
        s => s.orientation === state.orientation || s.orientation === 'square',
    )

    const handleRatio = value => {
        videoCropper.mode = 'ratio'
        videoCropper.presetValue = value
    }

    const handleSize = value => {
        videoCropper.mode = 'size'
        videoCropper.presetValue = value
    }

    const toggle = (key, val) => videoCropper[key] = val

    return (
        <div className="crop-controls">
            <SlSelect label="Ratio Presets" onSlChange={e => handleRatio(e.target.value)}>
                {ratioPresets.map(p => (
                    <SlOption key={p.value} value={p.value}>
                        {p.label}
                    </SlOption>
                ))}
            </SlSelect>

            <SlSelect label="Fixed Size Presets" onSlChange={e => handleSize(e.target.value)}>
                {sizePresets.map(p => (
                    <SlOption key={p.value} value={p.value}>
                        {p.label} ({p.width}×{p.height})
                    </SlOption>
                ))}
            </SlSelect>

            <SlSwitch checked={state.lockRatio} onSlChange={e => toggle('lockRatio', e.target.checked)}>
                Lock aspect ratio
            </SlSwitch>

            <SlSwitch checked={state.resizable} onSlChange={e => toggle('resizable', e.target.checked)}>
                Allow resize
            </SlSwitch>

            <SlSwitch checked={state.draggable} onSlChange={e => toggle('draggable', e.target.checked)}>
                Allow drag
            </SlSwitch>

            <SlSwitch
                checked={state.orientation === 'landscape'}
                onSlChange={e => toggle('orientation', e.target.checked ? 'landscape' : 'portrait')}
            >
                Landscape mode
            </SlSwitch>
        </div>
    )
}

