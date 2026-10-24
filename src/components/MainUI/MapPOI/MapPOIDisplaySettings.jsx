/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIDisplaySettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    normalizePOIDisplaySettings, POI_DISPLAY_MAX_WIDTH, POI_DISPLAY_MIN_WIDTH, POI_DISPLAY_WIDTH_STEP,
}                                    from '@Core/POIDisplaySettings'
import { WaDivider, WaSlider, WaSwitch } from '@awesome.me/webawesome/dist/react'
import { memo }                     from 'react'

const DISPLAY_OPTIONS = [
    {key: 'category', label: 'Category'},
    {key: 'titleCategoryIcon', label: 'Category icon in title'},
    {key: 'location', label: 'Location'},
    {key: 'altitude', label: 'Altitude'},
    {key: 'coordinates', label: 'Coordinates'},
    {key: 'dateTime', label: 'Date-Time'},
]

/**
 * Render persisted controls for the fields shown in an expanded POI.
 *
 * @param {Object} props - Component properties.
 * @param {string} props.poi - POI identifier.
 * @param {Object|null|undefined} props.display - Persisted POI display choices.
 * @param {Function} props.onDisplayChange - Callback for a changed display flag.
 * @returns {JSX.Element} The display controls.
 */
export const MapPOIDisplaySettings = memo(({poi, display, onDisplayChange}) => {
    const displaySettings = normalizePOIDisplaySettings(display)

    return (
        <section className="map-poi-display-settings" aria-labelledby={`map-poi-display-title-${poi}`}>
            <WaDivider/>
            <h4 id={`map-poi-display-title-${poi}`}>{'Display'}</h4>
            <div className="map-poi-display-controls">
                {DISPLAY_OPTIONS.map(({key, label}) => (
                    <WaSwitch
                        key={key}
                        size="xs"
                        label-at-start
                        width-auto
                        checked={displaySettings[key]}
                        onChange={event => onDisplayChange(key, event)}
                    >
                        {label}
                    </WaSwitch>
                ))}
            </div>
            <WaSlider
                className="map-poi-display-width-slider"
                label="Maximum width"
                label-at-start
                min={POI_DISPLAY_MIN_WIDTH}
                max={POI_DISPLAY_MAX_WIDTH}
                step={POI_DISPLAY_WIDTH_STEP}
                value={displaySettings.maxWidth}
                valueFormatter={value => `${value} px`}
                withTooltip
                onChange={event => onDisplayChange('maxWidth', event)}
            />
        </section>
    )
})

MapPOIDisplaySettings.displayName = 'MapPOIDisplaySettings'
