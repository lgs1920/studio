/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackStyleSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-01
 * Last modified: 2026-04-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DRAW_THEN_SAVE }                           from '@Core/constants'
import { TrackUtils }                               from '@Utils/cesium/TrackUtils'
import { WaColorPicker, WaDivider, WaSlider }       from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                                   from 'colord'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                              from 'valtio'
import { Utils }                                    from '../Utils'

/**
 * Component to manage track visual settings (color, opacity, thickness)
 * Optimized for high-performance dragging
 * @returns {JSX.Element|null}
 */
export const TrackStyleSettings = () => {
    const $editor = lgs.theJourneyEditorProxy
    const {track} = useSnapshot($editor)

    const _saveTimeoutRef = useRef(null)
    const _thicknessRef = useRef(null)
    const _opacityRef = useRef(null)

    const [trackColor, setTrackColor] = useState(() => {
        const initialColor = colord($editor.track?.color ?? '#ffffff')
        return {
            color:   initialColor.alpha(1).toRgbString(),
            opacity: initialColor.alpha(),
        }
    })

    useEffect(() => {
        if (!$editor.track) {
            TrackUtils.setTheTrack(false)
        }
    }, [$editor])

    /**
     * Sync sliders only when external changes occur (Initial mount or undo/redo)
     */
    useEffect(() => {
        if (_thicknessRef.current) {
            _thicknessRef.current.value = track?.thickness
        }
        if (_opacityRef.current) {
            _opacityRef.current.value = colord(track?.color).alpha()
        }
    }, [track?.thickness, track?.color])

    /**
     * High-performance thickness update
     */
    const handleThicknessInput = (event) => {
        const val = parseFloat(event.target.value)

        // 1. Immediate visual feedback on the scene (Proxy)
        $editor.track.thickness = val

        // 2. Debounce the heavy save operation
        if (_saveTimeoutRef.current) {
            clearTimeout(_saveTimeoutRef.current)
        }
        _saveTimeoutRef.current = setTimeout(async () => {
            await Utils.updateTrack(DRAW_THEN_SAVE)
            _saveTimeoutRef.current = null
        }, 150)
    }

    /**
     * High-performance color/opacity update
     */
    const handleColorInput = (event) => {
        const isSlider = event.target.nodeName === 'WA-SLIDER'
        const val = event.target.value

        let newColor = colord(trackColor.color)
        let newOpacity = trackColor.opacity

        if (isSlider) {
            newOpacity = parseFloat(val)
        }
        else {
            newColor = colord(val)
        }

        const finalRgba = newColor.alpha(newOpacity).toRgbString()

        // Update Proxy for real-time scene rendering
        $editor.track.color = finalRgba

        // Update local state for the ColorPicker and UI logic
        setTrackColor({
                          color:   newColor.alpha(1).toRgbString(),
                          opacity: newOpacity,
                      })

        if (_saveTimeoutRef.current) {
            clearTimeout(_saveTimeoutRef.current)
        }
        _saveTimeoutRef.current = setTimeout(async () => {
            await Utils.updateTrack(DRAW_THEN_SAVE)
            __.ui.profiler?.updateColor()
            _saveTimeoutRef.current = null
        }, 150)
    }

    /**
     * Scene render loop
     */
    const requestRender = useCallback(() => {
        lgs.scene.requestRender()
    }, [])

    useEffect(() => {
        lgs.scene.postUpdate.addEventListener(requestRender)
        return () => lgs.scene.postUpdate.removeEventListener(requestRender)
    }, [requestRender])

    if (!track?.visible) {
        return null
    }

    return (
        <div id="track-line-settings">
            <label>
                {'Track style'}
                <WaDivider
                    id="test-line"
                    style={{
                        '--color':   track.color,
                        '--width':   `${track.thickness}px`,
                        '--spacing': 0,
                    }}
                />
            </label>

            <div className="drawer-horizontal-line lgs--track-style-settings">
                <WaColorPicker
                    opacity={false}
                    size="small"
                    value={trackColor.color}
                    swatches={lgs.settings.getSwatches.list.join(';')}
                    onChange={handleColorInput}
                    withoutFormatToggle
                />

                <div>
                    <WaSlider
                        ref={_opacityRef}
                        min={0.05}
                        max={1}
                        step={0.05}
                        label-at-start
                        size="small"
                        label="Opacity"
                        defaultValue={trackColor.opacity}
                        onInput={handleColorInput}
                        valueFormatter={value => `${Math.round(value * 100)}%`}
                        placement="bottom"
                        withTooltip
                />
                    <WaSlider
                        ref={_thicknessRef}
                        min={0.5}
                        max={15}
                        step={0.1} // Finer steps for smoother drag
                        label-at-start
                        size="small"
                        label="Thickness"
                        defaultValue={track.thickness}
                        onInput={handleThicknessInput}
                        placement="bottom"
                        withTooltip
                    />
                </div>
            </div>
        </div>
    )
}