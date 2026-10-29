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
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    normalizePOIDisplaySettings,
    POI_DISPLAY_DEFAULT_FONT_FAMILY,
    POI_DISPLAY_DEFAULT_FONT_SIZE,
    POI_DISPLAY_DEFAULT_STICK_ANGLE,
    POI_DISPLAY_DEFAULT_STICK_HORIZONTAL_POSITION,
    POI_DISPLAY_DEFAULT_STICK_LENGTH,
    POI_DISPLAY_DEFAULT_STICK_POSITION,
    POI_DISPLAY_DEFAULT_STYLE,
    POI_DISPLAY_STYLES,
    POI_DISPLAY_STYLE_LABELS,
    POI_DISPLAY_MAX_WIDTH,
    POI_DISPLAY_MIN_WIDTH,
    POI_DISPLAY_STICK_LENGTH_MAX,
    POI_DISPLAY_WIDTH_STEP,
}                                    from '@Core/POIDisplaySettings'
import {WIDGET_FONT_FAMILIES, WIDGET_SYSTEM_FONT_STACK} from '@Core/constants'
import {
    WaButton, WaButtonGroup, WaDivider, WaIcon, WaNumberInput, WaOption, WaSelect, WaSlider, WaSwitch,
}                                    from '@awesome.me/webawesome/dist/react'
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
 * @param {string} props.panel - Which existing display-settings groups to render.
 * @param {string} props.poi - POI identifier.
 * @param {Object|null|undefined} props.display - Persisted POI display choices.
 * @param {boolean} props.hasDateTime - Whether the POI has a date to display.
 * @param {boolean} props.background - Whether the POI background is visible.
 * @param {Function} props.onDisplayChange - Callback for a changed display flag.
 * @param {Function} props.onDisplayValueChange - Callback for a changed typography or stick setting.
 * @param {Function} props.onStyleChange - Callback for a changed POI style flag.
 * @returns {JSX.Element} The display controls.
 */
export const MapPOIDisplaySettings = memo(({
                                                panel = 'content',
                                                poi,
                                                display,
                                                hasDateTime = false,
                                                background = true,
                                                onDisplayChange,
                                                onDisplayValueChange,
                                                onStyleChange,
                                            }) => {
    const selectedStyle = display?.style
    const displaySettings = normalizePOIDisplaySettings(display)
    const fontFamily = displaySettings.fontFamily ?? POI_DISPLAY_DEFAULT_FONT_FAMILY
    const fontSize = displaySettings.fontSize ?? POI_DISPLAY_DEFAULT_FONT_SIZE
    const stickAngle = displaySettings.stickAngle ?? POI_DISPLAY_DEFAULT_STICK_ANGLE
    const stickLength = displaySettings.stickLength ?? POI_DISPLAY_DEFAULT_STICK_LENGTH
    const stickPosition = displaySettings.stickPosition ?? POI_DISPLAY_DEFAULT_STICK_POSITION
    const stickHorizontalPosition = displaySettings.stickHorizontalPosition ?? POI_DISPLAY_DEFAULT_STICK_HORIZONTAL_POSITION
    const style = selectedStyle ?? displaySettings.style ?? POI_DISPLAY_DEFAULT_STYLE

    /** Store font family values in display form while keeping select option values URL-safe. */
    const handleFontFamilyChange = event => onDisplayValueChange(
        'fontFamily',
        event.target.value.replace(/_/g, ' '),
    )

    return (
        <section className="map-poi-display-settings" aria-label={`POI ${panel} settings for ${poi}`}>
            {panel === 'content' ? (
                <>
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
                </>
            ) : (
                <>
                    <section className="map-poi-display-group" aria-label="Typography">
                        <h3>{'Typography'}</h3>
                        <div className="map-poi-display-font-style-row">
                            <WaSelect
                                className="map-poi-display-font-family"
                                appearance="filled"
                                size="s"
                                label="Typeface"
                                label-at-start
                                value={fontFamily.replace(/\s/g, '_')}
                                onChange={handleFontFamilyChange}
                            >
                                <WaIcon slot="start" variant="regular" name="font"/>
                                {WIDGET_FONT_FAMILIES.map(font => (
                                    <WaOption key={font} value={font.replace(/\s/g, '_')}>
                                        <span style={{fontFamily: font === 'System' ? WIDGET_SYSTEM_FONT_STACK : font}}>{font}</span>
                                    </WaOption>
                                ))}
                            </WaSelect>
                            <WaButtonGroup className="map-poi-display-font-style" size="s" aria-label="Text style">
                                <WaButton
                                    size="s"
                                    variant={displaySettings.bold ? 'brand' : 'default'}
                                    aria-label="Bold"
                                    title="Bold"
                                    onClick={() => onDisplayValueChange('bold', !displaySettings.bold)}
                                >
                                    <WaIcon variant="regular" name="bold"/>
                                </WaButton>
                                <WaButton
                                    size="s"
                                    variant={displaySettings.italic ? 'brand' : 'default'}
                                    aria-label="Italic"
                                    title="Italic"
                                    onClick={() => onDisplayValueChange('italic', !displaySettings.italic)}
                                >
                                    <WaIcon variant="regular" name="italic"/>
                                </WaButton>
                            </WaButtonGroup>
                        </div>
                        <WaNumberInput
                            className="map-poi-display-font-size half-width"
                            appearance="filled"
                            size="s"
                            type="number"
                            label="Size"
                            label-at-start
                            min="8"
                            max="48"
                            step="1"
                            value={fontSize}
                            onInput={event => onDisplayValueChange('fontSize', event.target.value)}
                        />
                    </section>
                    <WaDivider/>
                    <section className="map-poi-display-group" aria-label="Appearance">
                        <h3>{'Appearance'}</h3>
                        <WaSelect
                            className="map-poi-display-style"
                            appearance="filled"
                            size="s"
                            label="Style"
                            label-at-start
                            value={style}
                            onChange={event => onDisplayValueChange('style', event.target.value)}
                        >
                            {POI_DISPLAY_STYLES.map(styleId => (
                                <WaOption key={styleId} value={styleId}>{POI_DISPLAY_STYLE_LABELS[styleId]}</WaOption>
                            ))}
                        </WaSelect>
                        <div className="map-poi-display-controls">
                            <WaSwitch
                                className="map-poi-style-switch"
                                size="xs"
                                label-at-start
                                checked={background}
                                onChange={event => onStyleChange('background', event)}
                            >
                                {'Background'}
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
                    <WaDivider/>
                    <section className="map-poi-display-group" aria-label="Stick">
                        <h3>{'Stick'}</h3>
                        <WaSelect
                            className="map-poi-display-stick-position"
                            appearance="filled"
                            size="s"
                            label="Position"
                            label-at-start
                            value={stickPosition}
                            onChange={event => onDisplayValueChange('stickPosition', event.target.value)}
                        >
                            <WaOption value="above">{'Above'}</WaOption>
                            <WaOption value="below">{'Below'}</WaOption>
                        </WaSelect>
                        <WaSelect
                            className="map-poi-display-stick-horizontal-position"
                            appearance="filled"
                            size="s"
                            label="Horizontal anchor"
                            label-at-start
                            value={`${stickHorizontalPosition}`}
                            onChange={event => onDisplayValueChange('stickHorizontalPosition', event.target.value)}
                        >
                            {[20, 50, 80].map(position => (
                                <WaOption key={position} value={`${position}`}>{`${position}%`}</WaOption>
                            ))}
                        </WaSelect>
                        <WaSelect
                            className="map-poi-display-stick-angle"
                            appearance="filled"
                            size="s"
                            label="Angle"
                            label-at-start
                            value={stickAngle}
                            onChange={event => onDisplayValueChange('stickAngle', event.target.value)}
                        >
                            <WaOption value="-45">{'-45°'}</WaOption>
                            <WaOption value="vertical">{'Vertical'}</WaOption>
                            <WaOption value="45">{'45°'}</WaOption>
                            <WaOption value="random">{'Random'}</WaOption>
                        </WaSelect>
                        <WaSlider
                            className="map-poi-display-stick-length"
                            label="Length"
                            label-at-start
                            min="0"
                            max={POI_DISPLAY_STICK_LENGTH_MAX}
                            step="1"
                            value={stickLength}
                            valueFormatter={value => `${value} px`}
                            withTooltip
                            onInput={event => onDisplayValueChange('stickLength', event.target.value)}
                        />
                    </section>
                </>
            )}
        </section>
    )
})

MapPOIDisplaySettings.displayName = 'MapPOIDisplaySettings'
