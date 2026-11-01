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
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    normalizePOIDisplaySettings,
    POI_DISPLAY_DEFAULT_FONT_FAMILY,
    POI_DISPLAY_DEFAULT_FONT_SIZE,
    POI_DISPLAY_DEFAULT_WIDGET_ROTATION,
    POI_DISPLAY_WIDGET_ROTATION_MAX,
    POI_DISPLAY_WIDGET_ROTATION_MIN,
    POI_DISPLAY_WIDGET_ROTATION_STEP,
    POI_DISPLAY_DEFAULT_STICK_ANGLE,
    POI_DISPLAY_DEFAULT_STICK_HORIZONTAL_POSITION,
    POI_DISPLAY_DEFAULT_STICK_LENGTH,
    POI_DISPLAY_DEFAULT_STICK_POSITION,
    POI_DISPLAY_STICK_ANCHOR_POSITIONS,
    POI_DISPLAY_DEFAULT_STYLE,
    POI_DISPLAY_BORDER_STYLES,
    POI_DISPLAY_BORDER_RADIUS_STYLES,
    POI_DISPLAY_BORDER_RADII,
    POI_DISPLAY_BORDER_WIDTH_MAX,
    POI_DISPLAY_BORDER_WIDTH_MIN,
    POI_DISPLAY_BORDER_WIDTH_STEP,
    POI_DISPLAY_DEFAULT_BORDER_RADIUS,
    getPOIDefaultBorderWidth,
    POI_DISPLAY_STYLES,
    POI_DISPLAY_STYLE_LABELS,
    POI_DISPLAY_MAX_WIDTH,
    POI_DISPLAY_MIN_WIDTH,
    POI_DISPLAY_STICK_LENGTH_MAX,
    POI_DISPLAY_WIDTH_STEP,
}                                    from '@Core/POIDisplaySettings'
import {WIDGET_FONT_FAMILIES, WIDGET_SYSTEM_FONT_STACK} from '@Core/constants'
import {RotationElement}              from '@Components/MainUI/widgets/editor/elements/RotationElement'
import {
    WaButton, WaButtonGroup, WaDivider, WaIcon, WaNumberInput, WaOption, WaSelect, WaSlider, WaSwitch,
    WaTooltip,
}                                    from '@awesome.me/webawesome/dist/react'
import { Fragment, memo, useId }     from 'react'

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

/** Card edges selectable as POI stick anchors. */
const STICK_ANCHOR_SIDES = Object.freeze([
    {value: 'above', label: 'Top', className: 'top'},
    {value: 'right', label: 'Right', className: 'right'},
    {value: 'below', label: 'Bottom', className: 'bottom'},
    {value: 'left', label: 'Left', className: 'left'},
])

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
 * @param {Function} props.onDisplayValueChange - Callback for changed typography or stick settings.
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
    const rawTooltipId = useId()
    const anchorTooltipIdPrefix = `map-poi-display-${rawTooltipId.replace(/:/g, '')}`
    const selectedStyle = display?.style
    const displaySettings = normalizePOIDisplaySettings(display)
    const fontFamily = displaySettings.fontFamily ?? POI_DISPLAY_DEFAULT_FONT_FAMILY
    const fontSize = displaySettings.fontSize ?? POI_DISPLAY_DEFAULT_FONT_SIZE
    const widgetRotation = displaySettings.widgetRotation ?? POI_DISPLAY_DEFAULT_WIDGET_ROTATION
    const stickAngle = displaySettings.stickAngle ?? POI_DISPLAY_DEFAULT_STICK_ANGLE
    const stickLength = displaySettings.stickLength ?? POI_DISPLAY_DEFAULT_STICK_LENGTH
    const stickPosition = displaySettings.stickPosition ?? POI_DISPLAY_DEFAULT_STICK_POSITION
    const stickHorizontalPosition = displaySettings.stickHorizontalPosition ?? POI_DISPLAY_DEFAULT_STICK_HORIZONTAL_POSITION
    const style = selectedStyle ?? displaySettings.style ?? POI_DISPLAY_DEFAULT_STYLE
    const borderWidth = displaySettings.borderWidth ?? getPOIDefaultBorderWidth(style)
    const borderRadius = displaySettings.borderRadius ?? POI_DISPLAY_DEFAULT_BORDER_RADIUS
    const borderRadiusPosition = Math.max(0, POI_DISPLAY_BORDER_RADII.indexOf(borderRadius))
    const hasBorder = POI_DISPLAY_BORDER_STYLES.includes(style)
    const hasBorderRadius = POI_DISPLAY_BORDER_RADIUS_STYLES.includes(style)
    const horizontalStick = stickPosition === 'left' || stickPosition === 'right'

    /** Store font family values in display form while keeping select option values URL-safe. */
    const handleFontFamilyChange = event => onDisplayValueChange(
        'fontFamily',
        event.target.value.replace(/_/g, ' '),
    )

    /**
     * Persist a selected card-edge anchor as one atomic display update.
     * @param {string} side - Selected edge of the POI card.
     * @param {number} position - Anchor percentage along the selected edge.
     * @returns {void}
     */
    const handleStickAnchorChange = (side, position) => {
        const changes = {
            stickPosition: side,
            stickHorizontalPosition: position,
        }
        const sideAnchor = side === 'left' || side === 'right'
        if (sideAnchor && !horizontalStick && stickAngle === 'random') {
            changes.stickAngle = 'straight'
        }
        onDisplayValueChange(changes)
    }

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
                        <div className="map-poi-display-font-style-row">
                            <span className="map-poi-display-font-style-label">{'Text style'}</span>
                            <WaButtonGroup className="map-poi-display-font-style" size="s" label="Text style">
                                <WaButton
                                    id={`${anchorTooltipIdPrefix}-bold`}
                                    size="xs"
                                    variant={displaySettings.bold ? 'brand' : 'default'}
                                    aria-label="Bold"
                                    onClick={() => onDisplayValueChange('bold', !displaySettings.bold)}
                                >
                                    <WaIcon variant="regular" name="bold"/>
                                </WaButton>
                                <WaButton
                                    id={`${anchorTooltipIdPrefix}-italic`}
                                    size="xs"
                                    variant={displaySettings.italic ? 'brand' : 'default'}
                                    aria-label="Italic"
                                    onClick={() => onDisplayValueChange('italic', !displaySettings.italic)}
                                >
                                    <WaIcon variant="regular" name="italic"/>
                                </WaButton>
                            </WaButtonGroup>
                        </div>
                        <WaTooltip for={`${anchorTooltipIdPrefix}-bold`}>{'Bold'}</WaTooltip>
                        <WaTooltip for={`${anchorTooltipIdPrefix}-italic`}>{'Italic'}</WaTooltip>
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
                    <WaDivider className="map-poi-display-decoration-divider"/>
                    <section className="map-poi-display-group" aria-label="Appearance">
                        <WaSelect
                            className="map-poi-display-style"
                            appearance="filled"
                            size="s"
                            label="Style"
                            label-at-start
                            value={style}
                            onChange={event => {
                                const nextStyle = event.target.value
                                onDisplayValueChange('style', nextStyle)
                                if (nextStyle === 'label') {
                                    onStyleChange('background', {target: {checked: false}})
                                }
                            }}
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
                                checked={style === 'label' ? false : background}
                                disabled={style === 'label'}
                                onChange={event => onStyleChange('background', event)}
                            >
                                {'Background'}
                            </WaSwitch>
                        </div>
                        <WaSlider
                            className="map-poi-display-width-slider"
                            size="s"
                            label="Width"
                            label-at-start
                            placement="top"
                            min={POI_DISPLAY_MIN_WIDTH}
                            max={POI_DISPLAY_MAX_WIDTH}
                            step={POI_DISPLAY_WIDTH_STEP}
                            value={displaySettings.maxWidth}
                            valueFormatter={value => `${value} px`}
                            withTooltip
                            onInput={event => onDisplayChange('maxWidth', event)}
                        />
                        <div className="map-poi-display-rotation-row">
                            <RotationElement
                                localRotation={widgetRotation}
                                applyRotation={rotation => onDisplayValueChange('widgetRotation', rotation)}
                                showNumberInput={false}
                                min={POI_DISPLAY_WIDGET_ROTATION_MIN}
                                max={POI_DISPLAY_WIDGET_ROTATION_MAX}
                                step={POI_DISPLAY_WIDGET_ROTATION_STEP}
                                label="Rotation"
                                showResetButton
                                labelClassName="map-poi-display-rotation-label"
                            />
                        </div>
                        {hasBorder && (
                            <>
                                <WaDivider className="map-poi-display-decoration-divider"/>
                                <WaSlider
                                    className="map-poi-display-border-width"
                                    size="s"
                                    label="Border"
                                    label-at-start
                                    placement="top"
                                    min={POI_DISPLAY_BORDER_WIDTH_MIN}
                                    max={POI_DISPLAY_BORDER_WIDTH_MAX}
                                    step={POI_DISPLAY_BORDER_WIDTH_STEP}
                                    value={borderWidth}
                                    valueFormatter={value => `${value} px`}
                                    withMarkers
                                    withTooltip
                                    onInput={event => onDisplayValueChange('borderWidth', Number(event.target.value))}
                                >
                                    <span slot="reference">{`${POI_DISPLAY_BORDER_WIDTH_MIN} px`}</span>
                                    <span slot="reference">{`${POI_DISPLAY_BORDER_WIDTH_MAX} px`}</span>
                                </WaSlider>
                                {hasBorderRadius && (
                                    <WaSlider
                                        className="map-poi-display-border-radius"
                                        size="s"
                                        label="Radius"
                                        label-at-start
                                        placement="top"
                                        min={0}
                                        max={POI_DISPLAY_BORDER_RADII.length - 1}
                                        step={1}
                                        value={borderRadiusPosition}
                                        valueFormatter={value => {
                                            const radius = POI_DISPLAY_BORDER_RADII[Math.round(value)]
                                            return radius ? `${radius[0].toUpperCase()}${radius.slice(1)}` : 'Small'
                                        }}
                                        withMarkers
                                        withTooltip
                                        onInput={event => onDisplayValueChange(
                                            'borderRadius',
                                            POI_DISPLAY_BORDER_RADII[Number(event.target.value)] ?? POI_DISPLAY_DEFAULT_BORDER_RADIUS,
                                        )}
                                    >
                                        <span slot="reference">
                                            <WaIcon name="eye-slash" variant="regular" size="s" aria-hidden="true"/>
                                        </span>
                                        {POI_DISPLAY_BORDER_RADII.slice(1).map(radius => (
                                            <span key={radius} slot="reference">
                                                {radius[0].toUpperCase()}
                                            </span>
                                        ))}
                                    </WaSlider>
                                )}
                            </>
                        )}
                    </section>
                    <WaDivider className="map-poi-display-decoration-divider"/>
                    <section className="map-poi-display-group" aria-label="Stick">
                        <div className="map-poi-display-stick-anchor-layout">
                            <h4 className="map-poi-display-stick-anchor-label">{'Anchor'}</h4>
                            <div className="map-poi-display-stick-anchor-picker" role="group" aria-label="Anchor">
                                <div className="map-poi-display-stick-anchor-card" aria-hidden="true"/>
                                {STICK_ANCHOR_SIDES.flatMap(side => POI_DISPLAY_STICK_ANCHOR_POSITIONS.map(position => {
                                    const selected = stickPosition === side.value && stickHorizontalPosition === position
                                    const alongHorizontalEdge = 35 + position * 0.62
                                    const alongVerticalEdge = 12 + position * 0.76
                                    const coordinates = side.value === 'above'
                                        ? {left: alongHorizontalEdge, top: 12}
                                        : side.value === 'right'
                                            ? {left: 97, top: alongVerticalEdge}
                                            : side.value === 'below'
                                                ? {left: alongHorizontalEdge, top: 88}
                                                : {left: 35, top: alongVerticalEdge}
                                    const buttonId = `${anchorTooltipIdPrefix}-${side.value}-${position}`
                                    const label = `${side.label} ${position}%`
                                    return (
                                        <Fragment key={`${side.value}-${position}`}>
                                        <WaButton
                                            id={buttonId}
                                            className={`map-poi-display-stick-anchor-point map-poi-display-stick-anchor-point--${side.className}-${position} ${selected ? 'map-poi-display-stick-anchor-point--selected' : 'map-poi-display-stick-anchor-point--unselected'}`}
                                            style={{
                                                left: `${coordinates.left}%`,
                                                top: `${coordinates.top}%`
                                            }}
                                            size="xs"
                                            variant={selected ? 'brand' : 'neutral'}
                                            appearance={selected ? 'accent' : 'filled-outlined'}
                                            aria-label={label}
                                            aria-pressed={selected}
                                            onClick={() => handleStickAnchorChange(side.value, position)}
                                        />
                                        <WaTooltip for={buttonId} placement="top">{label}</WaTooltip>
                                        </Fragment>
                                    )
                                }))}
                            </div>
                        </div>
                        <WaSelect
                            key={horizontalStick ? 'horizontal-stick-angle' : 'vertical-stick-angle'}
                            className="map-poi-display-stick-angle"
                            appearance="filled"
                            size="s"
                            label="Angle"
                            label-at-start
                            value={stickAngle}
                            onChange={event => onDisplayValueChange('stickAngle', event.target.value)}
                        >
                            <WaOption value="-45">{'-45°'}</WaOption>
                            <WaOption value="-30">{'-30°'}</WaOption>
                            <WaOption value="straight">{horizontalStick ? 'Horizontal' : 'Vertical'}</WaOption>
                            <WaOption value="30">{'+30°'}</WaOption>
                            <WaOption value="45">{'+45°'}</WaOption>
                            <WaOption value="random">{'Random'}</WaOption>
                        </WaSelect>
                        <WaSlider
                            className="map-poi-display-stick-length"
                            size="s"
                            label="Length"
                            label-at-start
                            placement="top"
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
