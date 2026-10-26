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
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    normalizePOIDisplaySettings, POI_DISPLAY_MAX_WIDTH, POI_DISPLAY_MIN_WIDTH, POI_DISPLAY_WIDTH_STEP,
}                                    from '@Core/POIDisplaySettings'
import { WaDivider, WaSlider, WaSwitch } from '@awesome.me/webawesome/dist/react'
import { memo }                     from 'react'

const TITLE_OPTIONS = [
    {key: 'titleCategoryIcon', label: 'Add Category'},
    {key: 'titleAltitude', label: 'Add Altitude'},
]

const CONTENT_OPTIONS = [
    {key: 'category', label: 'Category'},
    {key: 'location', label: 'Location'},
    {key: 'altitude', label: 'Altitude'},
    {key: 'coordinates', label: 'Coordinates'},
]

/**
 * Render persisted controls for the fields shown in an expanded POI.
 *
 * @param {Object} props - Component properties.
 * @param {string} props.poi - POI identifier.
 * @param {Object|null|undefined} props.display - Persisted POI display choices.
 * @param {boolean} props.hasDateTime - Whether the POI has a date to display.
 * @param {boolean} props.pill - Whether the POI card uses a rounded pill shape.
 * @param {boolean} props.noBackground - Whether the POI background is transparent.
 * @param {Function} props.onDisplayChange - Callback for a changed display flag.
 * @param {Function} props.onStyleChange - Callback for a changed POI style flag.
 * @returns {JSX.Element} The display controls.
 */
export const MapPOIDisplaySettings = memo(({
                                                poi,
                                                display,
                                                hasDateTime = false,
                                                pill = false,
                                                noBackground = false,
                                                onDisplayChange,
                                                onStyleChange,
                                            }) => {
    const displaySettings = normalizePOIDisplaySettings(display)

    return (
        <section className="map-poi-display-settings" aria-label={`POI style settings for ${poi}`}>
            <section className="map-poi-display-group" aria-label="Title">
                <h3>{'Title'}</h3>
                <div className="map-poi-display-controls">
                    {TITLE_OPTIONS.map(({key, label}) => (
                        <WaSwitch
                            key={key}
                            className="map-poi-style-switch"
                            size="xs"
                            label-at-start
                            checked={displaySettings[key]}
                            onChange={event => onDisplayChange(key, event)}
                        >
                            {label}
                        </WaSwitch>
                    ))}
                </div>
            </section>
            <WaDivider/>
            <section className="map-poi-display-group" aria-label="Content">
                <h3>{'Content'}</h3>
                <div className="map-poi-display-controls">
                    {[...CONTENT_OPTIONS, ...(hasDateTime ? [{key: 'dateTime', label: 'Date-Time'}] : [])].map(({key, label}) => (
                        <WaSwitch
                            key={key}
                            className="map-poi-style-switch"
                            size="xs"
                            label-at-start
                            checked={displaySettings[key]}
                            onChange={event => onDisplayChange(key, event)}
                        >
                            {label}
                        </WaSwitch>
                    ))}
                </div>
            </section>
            <WaDivider/>
            <section className="map-poi-display-group" aria-label="Appearance">
                <h3>{'Appearance'}</h3>
                <div className="map-poi-display-controls">
                    <WaSwitch
                        className="map-poi-style-switch"
                        size="xs"
                        label-at-start
                        checked={pill}
                        onChange={event => onStyleChange('pill', event)}
                    >
                        {'Pill'}
                    </WaSwitch>
                    <WaSwitch
                        className="map-poi-style-switch"
                        size="xs"
                        label-at-start
                        checked={noBackground}
                        onChange={event => onStyleChange('noBackground', event)}
                    >
                        {'No background'}
                    </WaSwitch>
                </div>
                <WaSlider
                    className="map-poi-display-width-slider"
                    label="Width"
                    label-at-start
                    min={POI_DISPLAY_MIN_WIDTH}
                    max={POI_DISPLAY_MAX_WIDTH}
                    step={POI_DISPLAY_WIDTH_STEP}
                    value={displaySettings.maxWidth}
                    valueFormatter={value => `${value} px`}
                    withTooltip
                    onInput={event => onDisplayChange('maxWidth', event)}
                />
            </section>
        </section>
    )
})

MapPOIDisplaySettings.displayName = 'MapPOIDisplaySettings'
