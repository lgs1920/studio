/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughDrawer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter from '@Components/DrawerFooter'
import { FlythroughProgressBar } from '@Components/Flythrough/FlythroughProgressBar'
import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import PanelActions from '@Components/PanelsActions'
import WaDrawer     from '@Components/WaDrawerNonModal'
import { FLYTHROUGH_DRAWER } from '@Core/constants'
import {
    FLYTHROUGH_SCOPE_ALL_TRACKS, FLYTHROUGH_SCOPE_CURRENT_TRACK, FLYTHROUGH_SCOPE_VISIBLE_TRACKS,
} from '@Core/ui/flythrough/FlythroughPathSampler'
import {
    clampFlythroughNumber, ensureFlythroughSettings, FLYTHROUGH_LABEL, normalizeFlythroughProfileInfo,
    normalizeFlythroughProgressionStyle,
    FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH, FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH, FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH,
    FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH,
} from '@Core/ui/flythrough/FlythroughProgressionStyle'
import {
    WaCard, WaColorPicker, WaDivider, WaIcon, WaInput, WaNumberInput, WaOption, WaSelect, WaSlider, WaSwitch, WaTab,
    WaTabGroup, WaTabPanel,
} from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }          from 'colord'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { createPortal }      from 'react-dom'
import { useSnapshot }       from 'valtio'
import './style.css'

const clampDuration = value => {
    const duration = Number(value)
    return Number.isFinite(duration) && duration > 0 ? duration : 60
}

const toOpaqueColorValue = value => {
    const color = colord(value ?? '#ffffff')
    return color.isValid() ? color.alpha(1).toHex() : '#ffffff'
}

const FlythroughStyleField = ({label, children}) => (
    <div className="flythrough-style-field">
        <span className="flythrough-style-label">{label}</span>
        {children}
    </div>
)

const mergeProgressionStyle = (current, updates) => normalizeFlythroughProgressionStyle({
    ...current,
    ...updates,
    fill:   {
        ...(current?.fill ?? {}),
        ...(updates?.fill ?? {}),
    },
    border: {
        ...(current?.border ?? {}),
        ...(updates?.border ?? {}),
    },
})

const mergeProfileInfo = (current, updates) => normalizeFlythroughProfileInfo({
    ...current,
    ...updates,
})

const FlythroughColorField = ({label, color, opacity, swatches, onColorInput, onOpacityInput}) => (
    <FlythroughStyleField label={label}>
        <div className="flythrough-color-control">
            <WaColorPicker
                className="flythrough-color-picker"
                size="small"
                aria-label={label}
                value={color}
                swatches={swatches}
                onInput={onColorInput}
            />
            <WaSlider
                className="flythrough-opacity-slider"
                size="small"
                label="Opacity"
                min="0"
                max="1"
                step="0.05"
                label-at-start
                width-auto
                withTooltip
                placement="top"
                value={opacity}
                valueFormatter={v => `${Math.floor(v * 100)}%`}
                onInput={onOpacityInput}
            />
        </div>
    </FlythroughStyleField>
)

const FlythroughWidthField = ({label, unit = 'm', value, min, max, step, onInput}) => (
    <FlythroughStyleField label={`${label} (${unit})`}>
        <WaNumberInput
            className="flythrough-width-input"
            size="small"
            appearance="filled"
            min={min}
            max={max}
            step={step}
            value={value}
            onInput={onInput}
        />
    </FlythroughStyleField>
)

const FlythroughProgressionGroup = ({
                                    title,
                                    color,
                                    opacity,
                                    width,
                                    widthMin,
                                    widthMax,
                                    swatches,
                                    onColorInput,
                                    onOpacityInput,
                                    onWidthInput,
                                }) => (
    <section className="flythrough-style-subsection">
        <h4 className="flythrough-style-subtitle">{title}</h4>
        <div className="flythrough-style-control-group">
            <FlythroughColorField
                label="Color"
                color={color}
                opacity={opacity}
                swatches={swatches}
                onColorInput={onColorInput}
                onOpacityInput={onOpacityInput}
            />
            <div className="flythrough-style-field-grid is-single">
                <FlythroughWidthField
                    label="Width"
                    value={width}
                    min={widthMin}
                    max={widthMax}
                    step="0.5"
                    onInput={onWidthInput}
                />
            </div>
        </div>
    </section>
)

export const FlythroughDrawer = memo(() => {
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)
    ensureFlythroughSettings()
    const flythroughSettings = useSnapshot(lgs.settings.ui.flythrough)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const journeySlug = lgs.theJourney?.slug
    const hasJourney = Boolean(journeySlug)
    const progression = normalizeFlythroughProgressionStyle(flythroughSettings.progression)
    const fillColor = toOpaqueColorValue(progression.fill.color)
    const borderColor = toOpaqueColorValue(progression.border.color)
    const fillOpacity = progression.fill.opacity
    const borderOpacity = progression.border.opacity
    const fillWidth = progression.fill.width
    const borderWidth = progression.border.width
    const profileInfo = normalizeFlythroughProfileInfo(flythroughSettings.profileInfo)
    const profileInfoColor = toOpaqueColorValue(profileInfo.color)

    useEffect(() => {
        lgs.stores.ui.mainUI.flythrough.journeySlug = journeySlug
        lgs.stores.ui.mainUI.flythrough.duration = flythroughSettings.duration
        lgs.stores.ui.mainUI.flythrough.direction = flythroughSettings.direction
        lgs.stores.ui.mainUI.flythrough.loop = flythroughSettings.loop
        lgs.stores.ui.mainUI.flythrough.scope = flythroughSettings.scope
        lgs.stores.ui.mainUI.flythrough.progression = normalizeFlythroughProgressionStyle(flythroughSettings.progression)
        lgs.stores.ui.mainUI.flythrough.profileInfo = normalizeFlythroughProfileInfo(flythroughSettings.profileInfo)
    }, [
        flythroughSettings.direction,
        flythroughSettings.duration,
        flythroughSettings.loop,
        flythroughSettings.profileInfo,
        flythroughSettings.progression,
        flythroughSettings.scope,
        journeySlug,
    ])

    useEffect(() => {
        if (drawerOpen !== FLYTHROUGH_DRAWER || !hasJourney) {
            return
        }

        const flythroughRuntime = lgs.stores.ui.mainUI.flythrough
        flythroughRuntime.toolbarVisible = true
        if (!flythroughRuntime.active && !flythroughRuntime.playing && !flythroughRuntime.paused) {
            __.ui.flythrough?.configure?.({progress: flythroughRuntime.progress ?? 0})
        }
    }, [drawerOpen, flythroughSettings.direction, flythroughSettings.duration, flythroughSettings.loop, flythroughSettings.scope, hasJourney])

    const refreshFlythrough = useCallback(() => {
        __.ui.flythrough?.refresh?.()
        lgs.scene?.requestRender?.()
    }, [])

    const updateProgression = useCallback((updates) => {
        const nextProgression = mergeProgressionStyle(lgs.settings.ui.flythrough.progression, updates)
        lgs.settings.ui.flythrough.progression = nextProgression
        lgs.stores.ui.mainUI.flythrough.progression = nextProgression
        refreshFlythrough()
    }, [refreshFlythrough])

    const updateProfileInfo = useCallback((updates) => {
        const nextProfileInfo = mergeProfileInfo(lgs.settings.ui.flythrough.profileInfo, updates)
        lgs.settings.ui.flythrough.profileInfo = nextProfileInfo
        lgs.stores.ui.mainUI.flythrough.profileInfo = nextProfileInfo
    }, [])

    const updateDuration = useCallback((event) => {
        const duration = clampDuration(event.target.value)
        lgs.settings.ui.flythrough.duration = duration
        lgs.stores.ui.mainUI.flythrough.duration = duration
    }, [])

    const updateScope = useCallback((event) => {
        lgs.settings.ui.flythrough.scope = event.target.value
        lgs.stores.ui.mainUI.flythrough.scope = event.target.value
    }, [])

    const updateDirection = useCallback((event) => {
        const direction = Number(event.target.value) < 0 ? -1 : 1
        lgs.settings.ui.flythrough.direction = direction
        lgs.stores.ui.mainUI.flythrough.direction = direction
    }, [])

    const updateLoop = useCallback((event) => {
        lgs.settings.ui.flythrough.loop = event.target.checked
        lgs.stores.ui.mainUI.flythrough.loop = event.target.checked
    }, [])

    const updateFillColor = useCallback((event) => {
        updateProgression({fill: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateProgression])

    const updateFillOpacity = useCallback((event) => {
        updateProgression({fill: {opacity: clampFlythroughNumber(event.target.value, progression.fill.opacity, 0, 1)}})
    }, [progression.fill.opacity, updateProgression])

    const updateFillWidth = useCallback((event) => {
        updateProgression({
                              fill: {
                                  width: clampFlythroughNumber(
                                      event.target.value,
                                      progression.fill.width,
                                      FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH,
                                      FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.fill.width, updateProgression])

    const updateBorderColor = useCallback((event) => {
        updateProgression({border: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateProgression])

    const updateBorderOpacity = useCallback((event) => {
        updateProgression({border: {opacity: clampFlythroughNumber(event.target.value, progression.border.opacity, 0, 1)}})
    }, [progression.border.opacity, updateProgression])

    const updateBorderWidth = useCallback((event) => {
        updateProgression({
                              border: {
                                  width: clampFlythroughNumber(
                                      event.target.value,
                                      progression.border.width,
                                      FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH,
                                      FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.border.width, updateProgression])

    const updateProfileInfoColor = useCallback((event) => {
        updateProfileInfo({color: toOpaqueColorValue(event.target.value)})
    }, [updateProfileInfo])

    const handleRequestClose = useCallback((event) => {
        if (event.target.tagName !== 'WA-DRAWER') {
            event.preventDefault()
            return
        }
        __.ui.drawerManager.close()
    }, [])

    const closeDrawer = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(FLYTHROUGH_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawerOpen === FLYTHROUGH_DRAWER &&
                <WaDrawer
                    id={FLYTHROUGH_DRAWER}
                    open={true}
                    onWaAfterHide={handleRequestClose}
                    onSlAfterHide={closeDrawer}
                    placement={drawerPlacement}
                    className="flythrough-drawer"
                >
                    <span slot="label" className="flythrough-drawer-title">
                        <WaIcon name="person-walking" variant="regular"/>
                        {FLYTHROUGH_LABEL}
                    </span>
                    <PanelActions/>

                    <div className="flythrough-drawer-content">
                        {!hasJourney ? (
                            <p className="flythrough-empty-state">{`Import or select a journey to use ${FLYTHROUGH_LABEL}.`}</p>
                        ) : (
                             <WaTabGroup className="flythrough-tabs">
                                 <WaTab slot="nav" panel="runner">
                                     <WaIcon name="person-walking" variant="regular"/>
                                     {'Runner'}
                                 </WaTab>
                                 <WaTab slot="nav" panel="edit">
                                     <WaIcon name="paintbrush-pencil" variant="regular"/>
                                     {'Edit'}
                                 </WaTab>

                                 <WaTabPanel name="runner">
                                     <LGSScrollbars>
                                         <div className="flythrough-tab-panel">
                                             <div className="flythrough-fieldset">
                                                 <WaInput
                                                     label="Duration"
                                                     size="small"
                                                     type="number"
                                                     min="1"
                                                     value={flythroughSettings.duration}
                                                     onInput={updateDuration}
                                                     withoutSpinButtons
                                                 >
                                                     <span slot="end">{'s'}</span>
                                                 </WaInput>

                                                 <WaSelect label="Scope" size="small" value={flythroughSettings.scope}
                                                           onChange={updateScope}>
                                                     <WaOption value={FLYTHROUGH_SCOPE_VISIBLE_TRACKS}>{'Visible tracks'}</WaOption>
                                                     <WaOption value={FLYTHROUGH_SCOPE_CURRENT_TRACK}>{'Current track'}</WaOption>
                                                     <WaOption value={FLYTHROUGH_SCOPE_ALL_TRACKS}>{'All tracks'}</WaOption>
                                                 </WaSelect>

                                                 <WaSelect label="Direction" size="small" value={String(flythroughSettings.direction)}
                                                           onChange={updateDirection}>
                                                     <WaOption value="1">{'Forward'}</WaOption>
                                                     <WaOption value="-1">{'Reverse'}</WaOption>
                                                 </WaSelect>

                                                 <WaSwitch size="xsmall" label-at-start checked={flythroughSettings.loop}
                                                           onInput={updateLoop}>
                                                     {'Loop'}
                                                 </WaSwitch>
                                             </div>

                                             <WaCard appearance="outlined" className="flythrough-progress-card-in-drawer">
                                                 <FlythroughProgressBar className="flythrough-progress-bar-in-drawer"/>
                                             </WaCard>
                                         </div>
                                     </LGSScrollbars>
                                 </WaTabPanel>

                                 <WaTabPanel name="edit">
                                     <LGSScrollbars>
                                         <div className="flythrough-tab-panel">
                                             <section className="flythrough-progression-section">
                                                 <h3>{'Progression'}</h3>
                                                 <FlythroughProgressionGroup
                                                     title="Fill"
                                                     color={fillColor}
                                                     opacity={fillOpacity}
                                                     width={fillWidth}
                                                     widthMin={FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH}
                                                     widthMax={FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH}
                                                     swatches={swatches}
                                                     onColorInput={updateFillColor}
                                                     onOpacityInput={updateFillOpacity}
                                                     onWidthInput={updateFillWidth}
                                                 />
                                                 <WaDivider/>
                                                 <FlythroughProgressionGroup
                                                     title="Border"
                                                     color={borderColor}
                                                     opacity={borderOpacity}
                                                     width={borderWidth}
                                                     widthMin={FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH}
                                                     widthMax={FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH}
                                                     swatches={swatches}
                                                     onColorInput={updateBorderColor}
                                                     onOpacityInput={updateBorderOpacity}
                                                     onWidthInput={updateBorderWidth}
                                                 />
                                                 <WaDivider/>
                                                 <section className="flythrough-style-subsection">
                                                     <h4 className="flythrough-style-subtitle">{'Profile info'}</h4>
                                                     <div className="flythrough-style-control-group">
                                                         <FlythroughStyleField label="Color">
                                                             <WaColorPicker
                                                                 className="flythrough-color-picker"
                                                                 size="small"
                                                                 aria-label="Profile info color"
                                                                 value={profileInfoColor}
                                                                 swatches={swatches}
                                                                 onInput={updateProfileInfoColor}
                                                             />
                                                         </FlythroughStyleField>
                                                     </div>
                                                 </section>
                                             </section>
                                         </div>
                                     </LGSScrollbars>
                                 </WaTabPanel>
                             </WaTabGroup>
                         )}
                    </div>
                    <DrawerFooter/>
                </WaDrawer>
            }
        </>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content
})
