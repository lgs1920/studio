/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderDrawer.jsx
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
import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import PanelActions from '@Components/PanelsActions'
import WaDrawer     from '@Components/WaDrawerNonModal'
import { WANDER_DRAWER } from '@Core/constants'
import {
    WANDER_SCOPE_ALL_TRACKS, WANDER_SCOPE_CURRENT_TRACK, WANDER_SCOPE_VISIBLE_TRACKS,
} from '@Core/ui/wander/WanderPathSampler'
import {
    clampWanderNumber, ensureWanderSettings, WANDER_LABEL, normalizeWanderProgressionStyle,
    WANDER_PROGRESSION_BORDER_MAX_WIDTH, WANDER_PROGRESSION_BORDER_MIN_WIDTH, WANDER_PROGRESSION_FILL_MAX_WIDTH,
    WANDER_PROGRESSION_FILL_MIN_WIDTH,
} from '@Core/ui/wander/WanderProgressionStyle'
import { km, UnitUtils } from '@Utils/UnitUtils'
import {
    WaButton, WaColorPicker, WaDivider, WaIcon, WaInput, WaNumberInput, WaOption, WaSelect, WaSlider, WaSwitch, WaTab,
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

const formatDistanceKm = value => (UnitUtils.convert(value ?? 0).to(km) ?? 0).toFixed(1)

const WanderStyleField = ({label, children}) => (
    <div className="wander-style-field">
        <span className="wander-style-label">{label}</span>
        {children}
    </div>
)

const mergeProgressionStyle = (current, updates) => normalizeWanderProgressionStyle({
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

const WanderColorField = ({label, color, opacity, swatches, onColorInput, onOpacityInput}) => (
    <WanderStyleField label={label}>
        <div className="wander-color-control">
            <WaColorPicker
                className="wander-color-picker"
                size="small"
                aria-label={label}
                value={color}
                swatches={swatches}
                onInput={onColorInput}
            />
            <WaSlider
                className="wander-opacity-slider"
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
    </WanderStyleField>
)

const WanderWidthField = ({label, unit = 'm', value, min, max, step, onInput}) => (
    <WanderStyleField label={`${label} (${unit})`}>
        <WaNumberInput
            className="wander-width-input"
            size="small"
            appearance="filled"
            min={min}
            max={max}
            step={step}
            value={value}
            onInput={onInput}
        />
    </WanderStyleField>
)

const WanderProgressionGroup = ({
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
    <section className="wander-style-subsection">
        <h4 className="wander-style-subtitle">{title}</h4>
        <div className="wander-style-control-group">
            <WanderColorField
                label="Color"
                color={color}
                opacity={opacity}
                swatches={swatches}
                onColorInput={onColorInput}
                onOpacityInput={onOpacityInput}
            />
            <div className="wander-style-field-grid is-single">
                <WanderWidthField
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

export const WanderDrawer = memo(() => {
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)
    ensureWanderSettings()
    const wanderState = useSnapshot(lgs.stores.ui.mainUI.wander)
    const wanderSettings = useSnapshot(lgs.settings.ui.wander)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const journeySlug = lgs.theJourney?.slug
    const hasJourney = Boolean(journeySlug)
    const coveredDistance = wanderState.sample?.distanceFromStart
        ?? (wanderState.totalDistance ?? 0) * (wanderState.progress ?? 0)
    const progressPercent = ((wanderState.progress ?? 0) * 100).toFixed(1)
    const progression = normalizeWanderProgressionStyle(wanderSettings.progression)
    const fillColor = toOpaqueColorValue(progression.fill.color)
    const borderColor = toOpaqueColorValue(progression.border.color)
    const fillOpacity = progression.fill.opacity
    const borderOpacity = progression.border.opacity
    const fillWidth = progression.fill.width
    const borderWidth = progression.border.width

    useEffect(() => {
        lgs.stores.ui.mainUI.wander.journeySlug = journeySlug
        lgs.stores.ui.mainUI.wander.duration = wanderSettings.duration
        lgs.stores.ui.mainUI.wander.direction = wanderSettings.direction
        lgs.stores.ui.mainUI.wander.loop = wanderSettings.loop
        lgs.stores.ui.mainUI.wander.scope = wanderSettings.scope
        lgs.stores.ui.mainUI.wander.progression = normalizeWanderProgressionStyle(wanderSettings.progression)
    }, [
        wanderSettings.direction,
        wanderSettings.duration,
        wanderSettings.loop,
        wanderSettings.progression,
        wanderSettings.scope,
        journeySlug,
    ])

    const refreshWander = useCallback(() => {
        __.ui.wander?.refresh?.()
        lgs.scene?.requestRender?.()
    }, [])

    const updateProgression = useCallback((updates) => {
        const nextProgression = mergeProgressionStyle(lgs.settings.ui.wander.progression, updates)
        lgs.settings.ui.wander.progression = nextProgression
        lgs.stores.ui.mainUI.wander.progression = nextProgression
        refreshWander()
    }, [refreshWander])

    const updateDuration = useCallback((event) => {
        const duration = clampDuration(event.target.value)
        lgs.settings.ui.wander.duration = duration
        lgs.stores.ui.mainUI.wander.duration = duration
    }, [])

    const updateScope = useCallback((event) => {
        lgs.settings.ui.wander.scope = event.target.value
        lgs.stores.ui.mainUI.wander.scope = event.target.value
    }, [])

    const updateDirection = useCallback((event) => {
        const direction = Number(event.target.value) < 0 ? -1 : 1
        lgs.settings.ui.wander.direction = direction
        lgs.stores.ui.mainUI.wander.direction = direction
    }, [])

    const updateLoop = useCallback((event) => {
        lgs.settings.ui.wander.loop = event.target.checked
        lgs.stores.ui.mainUI.wander.loop = event.target.checked
    }, [])

    const updateFillColor = useCallback((event) => {
        updateProgression({fill: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateProgression])

    const updateFillOpacity = useCallback((event) => {
        updateProgression({fill: {opacity: clampWanderNumber(event.target.value, progression.fill.opacity, 0, 1)}})
    }, [progression.fill.opacity, updateProgression])

    const updateFillWidth = useCallback((event) => {
        updateProgression({
                              fill: {
                                  width: clampWanderNumber(
                                      event.target.value,
                                      progression.fill.width,
                                      WANDER_PROGRESSION_FILL_MIN_WIDTH,
                                      WANDER_PROGRESSION_FILL_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.fill.width, updateProgression])

    const updateBorderColor = useCallback((event) => {
        updateProgression({border: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateProgression])

    const updateBorderOpacity = useCallback((event) => {
        updateProgression({border: {opacity: clampWanderNumber(event.target.value, progression.border.opacity, 0, 1)}})
    }, [progression.border.opacity, updateProgression])

    const updateBorderWidth = useCallback((event) => {
        updateProgression({
                              border: {
                                  width: clampWanderNumber(
                                      event.target.value,
                                      progression.border.width,
                                      WANDER_PROGRESSION_BORDER_MIN_WIDTH,
                                      WANDER_PROGRESSION_BORDER_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.border.width, updateProgression])

    const start = useCallback(() => {
        __.ui.wander?.start()
    }, [])

    const pause = useCallback(() => {
        __.ui.wander?.pause()
    }, [])

    const resume = useCallback(() => {
        __.ui.wander?.resume()
    }, [])

    const stop = useCallback(() => {
        __.ui.wander?.stop()
    }, [])

    const handleRequestClose = useCallback((event) => {
        if (event.target.tagName !== 'WA-DRAWER') {
            event.preventDefault()
            return
        }
        __.ui.drawerManager.close()
    }, [])

    const closeDrawer = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(WANDER_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawerOpen === WANDER_DRAWER &&
                <WaDrawer
                    id={WANDER_DRAWER}
                    open={true}
                    onWaAfterHide={handleRequestClose}
                    onSlAfterHide={closeDrawer}
                    placement={drawerPlacement}
                    className="wander-drawer"
                >
                    <span slot="label" className="wander-drawer-title">
                        <WaIcon name="person-walking" variant="regular"/>
                        {WANDER_LABEL}
                    </span>
                    <PanelActions/>

                    <div className="wander-drawer-content">
                        {!hasJourney ? (
                            <p className="wander-empty-state">{`Import or select a journey to use ${WANDER_LABEL}.`}</p>
                        ) : (
                             <WaTabGroup className="wander-tabs">
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
                                         <div className="wander-tab-panel">
                                             <div className="wander-fieldset">
                                                 <WaInput
                                                     label="Duration"
                                                     size="small"
                                                     type="number"
                                                     min="1"
                                                     value={wanderSettings.duration}
                                                     onInput={updateDuration}
                                                     withoutSpinButtons
                                                 >
                                                     <span slot="end">{'s'}</span>
                                                 </WaInput>

                                                 <WaSelect label="Scope" size="small" value={wanderSettings.scope}
                                                           onChange={updateScope}>
                                                     <WaOption value={WANDER_SCOPE_VISIBLE_TRACKS}>{'Visible tracks'}</WaOption>
                                                     <WaOption value={WANDER_SCOPE_CURRENT_TRACK}>{'Current track'}</WaOption>
                                                     <WaOption value={WANDER_SCOPE_ALL_TRACKS}>{'All tracks'}</WaOption>
                                                 </WaSelect>

                                                 <WaSelect label="Direction" size="small" value={String(wanderSettings.direction)}
                                                           onChange={updateDirection}>
                                                     <WaOption value="1">{'Forward'}</WaOption>
                                                     <WaOption value="-1">{'Reverse'}</WaOption>
                                                 </WaSelect>

                                                 <WaSwitch size="xsmall" label-at-start checked={wanderSettings.loop}
                                                           onInput={updateLoop}>
                                                     {'Loop'}
                                                 </WaSwitch>
                                             </div>

                                             <div className="wander-status">
                                                 <span>{'Progress'}</span>
                                                 <strong>{`${formatDistanceKm(coveredDistance)}/${formatDistanceKm(wanderState.totalDistance)} km (${progressPercent}%)`}</strong>
                                             </div>

                                             <div className="wander-actions">
                                                 {!wanderState.playing && !wanderState.paused &&
                                                     <WaButton variant="brand" appearance="filled" onClick={start}>
                                                         <WaIcon slot="start" name="play" variant="regular"/>
                                                         {'Start'}
                                                     </WaButton>
                                                 }
                                                 {wanderState.playing &&
                                                     <WaButton variant="brand" appearance="outlined" onClick={pause}>
                                                         <WaIcon slot="start" name="pause" variant="regular"/>
                                                         {'Pause'}
                                                     </WaButton>
                                                 }
                                                 {wanderState.paused &&
                                                     <WaButton variant="brand" appearance="filled" onClick={resume}>
                                                         <WaIcon slot="start" name="play" variant="regular"/>
                                                         {'Resume'}
                                                     </WaButton>
                                                 }
                                                 {(wanderState.active || wanderState.paused) &&
                                                     <WaButton variant="neutral" appearance="outlined" onClick={stop}>
                                                         <WaIcon slot="start" name="stop" variant="regular"/>
                                                         {'Stop'}
                                                     </WaButton>
                                                 }
                                             </div>
                                         </div>
                                     </LGSScrollbars>
                                 </WaTabPanel>

                                 <WaTabPanel name="edit">
                                     <LGSScrollbars>
                                         <div className="wander-tab-panel">
                                             <section className="wander-progression-section">
                                                 <h3>{'Progression'}</h3>
                                                 <WanderProgressionGroup
                                                     title="Fill"
                                                     color={fillColor}
                                                     opacity={fillOpacity}
                                                     width={fillWidth}
                                                     widthMin={WANDER_PROGRESSION_FILL_MIN_WIDTH}
                                                     widthMax={WANDER_PROGRESSION_FILL_MAX_WIDTH}
                                                     swatches={swatches}
                                                     onColorInput={updateFillColor}
                                                     onOpacityInput={updateFillOpacity}
                                                     onWidthInput={updateFillWidth}
                                                 />
                                                 <WaDivider/>
                                                 <WanderProgressionGroup
                                                     title="Border"
                                                     color={borderColor}
                                                     opacity={borderOpacity}
                                                     width={borderWidth}
                                                     widthMin={WANDER_PROGRESSION_BORDER_MIN_WIDTH}
                                                     widthMax={WANDER_PROGRESSION_BORDER_MAX_WIDTH}
                                                     swatches={swatches}
                                                     onColorInput={updateBorderColor}
                                                     onOpacityInput={updateBorderOpacity}
                                                     onWidthInput={updateBorderWidth}
                                                 />
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
