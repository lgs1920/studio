/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditContent.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-02-25
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOICategorySelector } from '@Components/MainUI/MapPOI/MapPOICategorySelector'
import { MapPOIDisplaySettings }  from '@Components/MainUI/MapPOI/MapPOIDisplaySettings'
import { MapPOIEditPreview }      from '@Components/MainUI/MapPOI/MapPOIEditPreview'
import { usePOIPresentationClipboard } from '@Components/MainUI/MapPOI/poiPresentationClipboard'
import {
    getPOIEditorPanelName, getPOIEditorTabFromPanelName, poiEditorTabSessionStore, setPOIEditorActiveTab,
}                                 from '@Components/MainUI/MapPOI/poiEditorTabSessionStore'
import { LGSScrollbars }          from '@Components/MainUI/LGSScrollbars'
import { DateTimeDisplay }        from '@Components/DateTimeDisplay'
import { MapPOIEditMenu }         from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import {
    NO_ASSOCIATED_JOURNEY_LABEL, usePOIJourneyAssociation,
}                                 from '@Components/MainUI/MapPOI/usePOIJourneyAssociation'
import { JourneySelector }        from '@Editor/journey/JourneySelector'
import {
    COORDINATE_INPUT_ERROR_DURATION_MS, COORDINATE_INPUT_NORMALIZE_DELAY_MS,
}                                 from '@Core/constants'
import { normalizePOIDisplaySettings } from '@Core/POIDisplaySettings'
import { UI_ACTIONS, UI_ICONS } from '@Core/ui/metadata/uiActionCatalog'

import {hasVisibleColorAlpha} from '@Utils/ColorUtils'
import { UIToast } from '@Utils/UIToast'
import {
    ELEVATION_UNITS, UnitUtils,
}                  from '@Utils/UnitUtils'
import {
    WaButton, WaColorPicker, WaCopyButton, WaDivider, WaIcon, WaInput, WaSwitch, WaTab, WaTabGroup,
    WaTabPanel, WaTextarea, WaTooltip,
}                  from '@awesome.me/webawesome/dist/react'
import classNames  from 'classnames'
import parse       from 'html-react-parser'
import {
    memo, useCallback, useEffect, useMemo, useRef, useState,
}                  from 'react'
import {
    useSnapshot,
    proxy,
}                  from 'valtio'

const EMPTY_POI_PROXY = proxy({})

/**
 * Edit content for a POI using only its ID to ensure instant reactivity with Valtio.
 * Manages altitude simulation states and styling.
 *
 * @param {Object} props
 * @param {string} props.poi - The ID of the POI to edit
 * @returns {JSX.Element|null}
 */
export const MapPOIEditContent = memo(({poi}) => {
                                          const tooltipIdPrefix = `map-poi-edit-${String(poi).replace(/[^\w-]/g, '-')}`
                                          const coordinateSystemSettings = useSnapshot(lgs.settings.coordinateSystem)
                                          const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
                                          const coordinateSystem = coordinateSystemSettings.current
                                          const swatchesList = lgs.settings.getSwatches.list
                                          const elevationUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[0]

                                          /** @type {Object} Fresh proxy reference for direct mutations */
                                          const $point = lgs.stores.main.components.pois.list.get(poi)
                                          const point = useSnapshot($point ?? EMPTY_POI_PROXY)
                                          const journeyAssociation = usePOIJourneyAssociation(point)
                                          const updateEditedPOI = useCallback((updates, options = {}) => (
                                              __.ui.poiManager.updatePOI(poi, updates, {...options, markAsEdited: true})
                                          ), [poi])
                                          const {canPaste, copy: copyPresentation, paste: pastePresentation} = usePOIPresentationClipboard(poi)
                                          const _colorPickerShift = useRef({})
                                          const textBorderColorsLinked = point.textBorderColorsLinked === true

                                          /**
                                           * Persist a changed display flag while retaining the other POI choices.
                                           *
                                           * @param {string} field - Display field key.
                                           * @param {Event} event - Web Awesome control change event.
                                           * @returns {void}
                                           */
                                          const handleDisplayChange = useCallback((field, event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              const currentPoint = lgs.stores.main.components.pois.list.get(poi)
                                              if (!currentPoint) {
                                                  return
                                              }

                                              const currentDisplay = normalizePOIDisplaySettings(currentPoint.display)
                                              const value = field === 'maxWidth'
                                                  ? Number(event.target.value)
                                                  : event.target.checked
                                              const nextDisplay = normalizePOIDisplaySettings({
                                                  ...currentDisplay,
                                                  [field]: value,
                                              })

                                              void updateEditedPOI({display: nextDisplay}, {
                                                  immediate: field !== 'maxWidth',
                                              })
                                                  .catch(error => console.error(`[MapPOIEditContent] Failed to save ${field}:`, error))
                                          }, [poi, updateEditedPOI])

                                          /**
                                           * Persist one or more typography or connector values with the POI display settings.
                                           * @param {string|Object} field - Display field name or atomic field update.
                                           * @param {*} value - Value supplied when updating one display field.
                                           * @returns {void}
                                           */
                                          const handleDisplayValueChange = useCallback((field, value) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              const currentPoint = lgs.stores.main.components.pois.list.get(poi)
                                              if (!currentPoint) {
                                                  return
                                              }

                                              const currentDisplay = normalizePOIDisplaySettings(currentPoint.display)
                                              const changedValues = typeof field === 'object' && field !== null
                                                  ? field
                                                  : {[field]: value}
                                              const nextDisplay = normalizePOIDisplaySettings({
                                                  ...currentDisplay,
                                                  ...changedValues,
                                              })
                                              void updateEditedPOI({display: nextDisplay})
                                                  .catch(error => console.error(`[MapPOIEditContent] Failed to save ${Object.keys(changedValues).join(', ')}:`, error))
                                          }, [poi, updateEditedPOI])

                                          /**
                                           * Persist a changed POI shape or background setting immediately.
                                           *
                                           * @param {string} field - POI style property.
                                           * @param {Event} event - Web Awesome switch change event.
                                           * @returns {void}
                                           */
                                          const handleStyleChange = useCallback((field, event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              void updateEditedPOI({[field]: event.target.checked}, {immediate: true})
                                                  .catch(error => console.error(`[MapPOIEditContent] Failed to save ${field}:`, error))
                                          }, [poi, updateEditedPOI])

                                          /** Persist the Replay animation preference with the rest of this POI. */
                                          const handleReplayAnimationChange = useCallback((event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              const currentPoint = lgs.stores.main.components.pois.list.get(poi)
                                              if (!currentPoint) {
                                                  return
                                              }

                                              const currentReplaySettings = currentPoint.replay
                                                  && typeof currentPoint.replay === 'object'
                                                  ? currentPoint.replay
                                                  : {}
                                              void updateEditedPOI({
                                                  replay: {
                                                      ...currentReplaySettings,
                                                      animated: event.target.checked === true,
                                                  },
                                              }, {immediate: true})
                                                  .catch(error => console.error('[MapPOIEditContent] Failed to save Replay animation preference:', error))
                                          }, [poi, updateEditedPOI])

                                          const handlePastePresentation = useCallback(() => {
                                              void pastePresentation()
                                                  .catch(error => console.error('[MapPOIEditContent] Failed to paste POI style:', error))
                                          }, [pastePresentation])

                                          if (!point.id) {
                                              return null
                                          }

                                          const {
                                                    id,
                                                    title       = '',
                                                    description = '',
                                                    latitude,
                                                    longitude,
                                                    location,
                                                    height,
                                                    simulatedHeight,
                                                    color,
                                                    bgColor,
                                                    borderColor,
                                                    background = true,
                                                    time,
                                                    visible     = true,
                                                } = point
                                          const currentTextColor = color ?? lgs.colors.poiDefault
                                          const currentBorderColor = borderColor ?? color ?? lgs.colors.poiDefault
                                          const colorLinkAction = textBorderColorsLinked
                                              ? UI_ACTIONS.unlinkPOITextAndBorderColors
                                              : UI_ACTIONS.linkPOITextAndBorderColors
                                          const currentBackgroundColor = bgColor ?? lgs.colors.poiDefaultBackground
                                          const canSwapColors = background
                                              && hasVisibleColorAlpha(currentBackgroundColor)
                                              && hasVisibleColorAlpha(currentBorderColor)

                                          const [coordinateDraft, setCoordinateDraft] = useState({
                                                                                                     latitude:  UnitUtils.formatCoordinate(latitude, coordinateSystem),
                                                                                                     longitude: UnitUtils.formatCoordinate(longitude, coordinateSystem),
                                                                                                 })
                                          const [coordinateError, setCoordinateError] = useState({
                                                                                                     latitude:  false,
                                                                                                     longitude: false,
                                                                                                 })
                                          const {activeTab: sharedActiveTab} = useSnapshot(poiEditorTabSessionStore)
                                          const activeTab = getPOIEditorPanelName(id, sharedActiveTab)

                                          /** @type {[boolean, function]} Tracks if the altitude is currently simulated */
                                          const [simulated, setSimulated] = useState(height == null || height === simulatedHeight)

                                          const normalizeTimeouts = useRef({
                                                                               latitude:  null,
                                                                               longitude: null,
                                                                           })
                                          const errorTimeouts = useRef({
                                                                           latitude:  null,
                                                                           longitude: null,
                                                                       })

                                          const showCoordinateError = useCallback((key) => {
                                              setCoordinateError((prev) => ({...prev, [key]: true}))
                                              if (errorTimeouts.current[key]) {
                                                  clearTimeout(errorTimeouts.current[key])
                                              }
                                              errorTimeouts.current[key] = setTimeout(() => {
                                                  setCoordinateError((prev) => ({...prev, [key]: false}))
                                                  errorTimeouts.current[key] = null
                                              }, COORDINATE_INPUT_ERROR_DURATION_MS)
                                          }, [])

                                          /**
                                           * Compute formatted coordinates string for clipboard.
                                           * Uses snapped values to ensure the UI re-renders when the store updates.
                                           */
                                          const formattedCoordinates = useMemo(() => {
                                              const lat = UnitUtils.formatCoordinate(point.latitude, lgs.settings.coordinateSystem.current)
                                              const lng = UnitUtils.formatCoordinate(point.longitude, lgs.settings.coordinateSystem.current)
                                              return `${lat}, ${lng}`
                                          }, [point.latitude, point.longitude, coordinateSystem])

                                          /**
                                           * Updates altitude and toggles simulation status immediately
                                           */
                                          const handleChangeAltitude = useCallback(async (event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              const rawValue = event?.target?.value
                                              const normalizedValue = `${rawValue ?? ''}`.trim().replace(',', '.')
                                              if (!normalizedValue) {
                                                  return
                                              }

                                              const parsedValue = Number.parseFloat(normalizedValue)
                                              if (!Number.isFinite(parsedValue)) {
                                                  return
                                              }

                                              const meters = UnitUtils.revert(parsedValue, elevationUnit)

                                              setSimulated(meters === point.simulatedHeight)

                                              await updateEditedPOI({height: meters}, {immediate: true})
                                          }, [poi, elevationUnit, point.simulatedHeight, updateEditedPOI])

                                          /**
                                           * Capture Shift only when a color picker's popup opens.
                                           * @param {string} field - The swatch being opened.
                                           * @param {Event} event - The color picker trigger event.
                                           * @returns {void}
                                           */
                                          const captureColorPickerShift = useCallback((field, event) => {
                                              if (event.currentTarget?.open !== true) {
                                                  _colorPickerShift.current[field] = event.shiftKey === true
                                              }
                                          }, [])

                                          /**
                                           * Apply a selected color while preventing event bubbling.
                                           * @param {'text'|'colour'|'border'} field - The swatch being changed.
                                           * @param {Event} event - The Web Awesome color change event.
                                           * @returns {Promise<void>}
                                           */
                                          const handleChangeColor = useCallback(async (field, event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              event.stopPropagation()
                                              event.preventDefault()

                                              const update = {}
                                              const selectedColor = event.target.value
                                              const currentPoint = lgs.stores.main.components.pois.list.get(poi)
                                              const shiftLinked = _colorPickerShift.current[field] === true
                                              if (field === 'text') {
                                                  update.color = selectedColor
                                                  if (textBorderColorsLinked || shiftLinked) {
                                                      update.borderColor = selectedColor
                                                  }
                                                  else if (currentPoint?.borderColor == null) {
                                                      update.borderColor = currentBorderColor
                                                  }
                                              }
                                              else if (field === 'colour' && shiftLinked) {
                                                  update.bgColor = selectedColor
                                                  update.borderColor = selectedColor
                                                  if (textBorderColorsLinked) {
                                                      update.color = selectedColor
                                                  }
                                              }
                                              else if (field === 'colour') {
                                                  update.bgColor = selectedColor
                                                  if (currentPoint?.borderColor == null) {
                                                      update.borderColor = currentBorderColor
                                                  }
                                              }
                                              else if (textBorderColorsLinked || shiftLinked) {
                                                  update.color = selectedColor
                                                  update.borderColor = selectedColor
                                              }
                                              else if (field === 'border') {
                                                  update.borderColor = selectedColor
                                              }

                                              if (Object.keys(update).length > 0) {
                                                  await updateEditedPOI(update)
                                              }
                                          }, [poi, currentBorderColor, textBorderColorsLinked, updateEditedPOI])

                                          /** Reverse the background with the border and keep the linked Text color in sync. */
                                          const handleSwapColors = async () => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              const currentPoint = lgs.stores.main.components.pois.list.get(poi)
                                              if (!currentPoint) {
                                                  return
                                              }

                                              const backgroundColor = currentPoint.bgColor ?? lgs.colors.poiDefaultBackground
                                              const borderColor = currentPoint.borderColor
                                                  ?? currentPoint.color
                                                  ?? lgs.colors.poiDefault
                                              if (currentPoint.background === false
                                                  || !hasVisibleColorAlpha(backgroundColor)
                                                  || !hasVisibleColorAlpha(borderColor)) {
                                                  return
                                              }

                                              const updates = {
                                                  bgColor:     borderColor,
                                                  borderColor: backgroundColor,
                                              }

                                              if (textBorderColorsLinked) {
                                                  updates.color = backgroundColor
                                              }

                                              await updateEditedPOI(updates)
                                          }

                                          /** Toggle the persisted Text and Border link, aligning Text to Border when linking. */
                                          const handleToggleTextBorderLink = async () => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              if (textBorderColorsLinked) {
                                                  await updateEditedPOI({textBorderColorsLinked: false})
                                                  return
                                              }

                                              const currentPoint = lgs.stores.main.components.pois.list.get(poi)
                                              if (!currentPoint) {
                                                  return
                                              }

                                              const borderColor = currentPoint.borderColor
                                                  ?? currentPoint.color
                                                  ?? lgs.colors.poiDefault
                                              try {
                                                  await updateEditedPOI({
                                                      color:                   borderColor,
                                                      borderColor,
                                                      textBorderColorsLinked: true,
                                                  })
                                              }
                                              catch (error) {
                                                  console.error('[MapPOIEditContent] Failed to link Text and Border colors:', error)
                                              }
                                          }

                                          /**
                                           * Creates a handler for coordinate changes.
                                           * Updates the store on every input to keep the copy button in sync.
                                           */
                                          const makeCoordHandler = useCallback((key) => async (event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              const rawValue = event.target.value
                                              if (normalizeTimeouts.current[key]) {
                                                  clearTimeout(normalizeTimeouts.current[key])
                                                  normalizeTimeouts.current[key] = null
                                              }

                                              const parsedInput = UnitUtils.parseCoordinateInput(rawValue, key === 'latitude')
                                              if (!parsedInput.accepted) {
                                                  showCoordinateError(key)
                                                  return
                                              }

                                              setCoordinateError((prev) => ({...prev, [key]: false}))
                                              setCoordinateDraft((prev) => ({...prev, [key]: rawValue}))

                                              if (!parsedInput.completeValid) {
                                                  return
                                              }

                                              const val = parsedInput.decimalValue
                                              if (!Number.isFinite(val)) {
                                                  return
                                              }

                                              if (parsedInput.typedFormat && parsedInput.typedFormat !== coordinateSystem) {
                                                  normalizeTimeouts.current[key] = setTimeout(() => {
                                                      setCoordinateDraft((prev) => ({
                                                          ...prev,
                                                          [key]: UnitUtils.formatCoordinate(val, coordinateSystem),
                                                      }))
                                                      normalizeTimeouts.current[key] = null
                                                  }, COORDINATE_INPUT_NORMALIZE_DELAY_MS)
                                              }

                                              const currentValue = key === 'latitude' ? latitude : longitude
                                              if (val !== currentValue) {
                                                  await updateEditedPOI({[key]: val})
                                              }
                                          }, [poi, latitude, longitude, coordinateSystem, showCoordinateError, updateEditedPOI])

                                          const handleChangeLatitude = makeCoordHandler('latitude')
                                          const handleChangeLongitude = makeCoordHandler('longitude')

                                          const handleChangeTitle = useCallback(async (event) => {
                                              if (!window.isOK) {
                                                  return
                                              }
                                              if (event.target.tagName.toLowerCase() === 'wa-input') {
                                                  await updateEditedPOI({title: event.target.value})
                                              }
                                          }, [poi, updateEditedPOI])

                                          const previousTitleRef = useRef(title)

                                          /** Keep the selected tab controlled without resetting it during POI updates. */
                                          const handleTabShow = useCallback((event) => {
                                              const panelName = event?.detail?.name
                                              if (panelName) {
                                                  const tab = getPOIEditorTabFromPanelName(id, panelName)
                                                  if (tab) {
                                                      setPOIEditorActiveTab(tab)
                                                  }
                                              }
                                          }, [id])

                                          const handleTitleFocus = useCallback(() => {
                                              previousTitleRef.current = title
                                          }, [title])

                                          const handleTitleBlur = useCallback(async (event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              if (event.target.tagName.toLowerCase() !== 'wa-input') {
                                                  return
                                              }

                                              const nextTitle = `${event.target.value ?? ''}`.trim()
                                              if (nextTitle.length > 0) {
                                                  return
                                              }

                                              const fallbackTitle = previousTitleRef.current ?? ''
                                              await updateEditedPOI({title: fallbackTitle})
                                          }, [poi, updateEditedPOI])

                                          const handleChangeDescription = useCallback(async (event) => {
                                              if (window.isOK) {
                                                  await updateEditedPOI({description: event.target.value})
                                              }
                                          }, [poi, updateEditedPOI])

                                          const handleCopySuccess = useCallback(() => {
                                              UIToast.success({
                                                                  caption: title ?? 'POI', text: 'Coordinates copied<br/>Format: latitude, longitude',
                                                              })
                                          }, [title])

                                          const handleResetAltitude = useCallback(async (event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              event?.stopPropagation()
                                              event?.preventDefault()

                                              if (!Number.isFinite(simulatedHeight)) {
                                                  return
                                              }

                                              setSimulated(true)
                                              await updateEditedPOI({height: simulatedHeight}, {immediate: true})
                                          }, [poi, simulatedHeight, updateEditedPOI])

                                          const swatches = useMemo(() => swatchesList.join(';'), [swatchesList])

                                          useEffect(() => {
                                              setSimulated(height == null || height === simulatedHeight)
                                          }, [height, simulatedHeight])

                                          useEffect(() => {
                                              setCoordinateDraft((prev) => ({
                                                  latitude:  normalizeTimeouts.current.latitude ? prev.latitude : UnitUtils.formatCoordinate(latitude, coordinateSystem),
                                                  longitude: normalizeTimeouts.current.longitude ? prev.longitude : UnitUtils.formatCoordinate(longitude, coordinateSystem),
                                              }))
                                          }, [latitude, longitude, coordinateSystem])

                                          useEffect(() => {
                                              return () => {
                                                  Object.values(normalizeTimeouts.current).forEach(timeoutId => {
                                                      if (timeoutId) {
                                                          clearTimeout(timeoutId)
                                                      }
                                                  })
                                                  Object.values(errorTimeouts.current).forEach(timeoutId => {
                                                      if (timeoutId) {
                                                          clearTimeout(timeoutId)
                                                      }
                                                  })
                                              }
                                          }, [])

                                          useEffect(() => {
                                              let cancelled = false

                                              const handleFocusOnOpen = async () => {
                                                  if (__.ui.drawerManager.consumeSuppressFocusOnOpen?.(id)) {
                                                      return
                                                  }

                                                  if (!lgs.settings.ui.poi.focusOnEdit || !$point) {
                                                      return
                                                  }

                                                  if (__.ui.cameraManager.isRotating()) {
                                                      await __.ui.poiManager.stopRotationAndSync()
                                                  }
                                                  if (cancelled) {
                                                      return
                                                  }

                                                  await __.ui.poiManager.focusPOI(id, {flyingTime: 2})
                                              }

                                              if (__.ui.poiManager?.ensurePOILocation) {
                                                  void __.ui.poiManager.ensurePOILocation(id)
                                              }
                                              handleFocusOnOpen()

                                              return () => {
                                                  cancelled = true
                                              }
                                          }, [id])


                                          /** Dynamic altitude row with conditional labeling and styling */
                                          const altitudeInput = useMemo(() => (
                                              <div className="map-poi-edit-row-coordinates">
                                                  <div className="map-poi-edit-item label-on-left">
                                                      {simulated ? 'Simulated alt.' : 'Altitude'}
                                                  </div>
                                                  <WaInput appearance="filled"
                                                      className={classNames('map-poi-edit-item', 'map-poi', {
                                                          'map-poi-edit-warning-altitude': simulated,
                                                      })}
                                                      size="s"
                                                      withoutSpinButtons
                                                      inputMode="numeric"
                                                      value={Math.round(UnitUtils.convert(height ?? simulatedHeight ?? 0).to(elevationUnit))}
                                                      onInput={handleChangeAltitude}
                                                      disabled={!visible}
                                                  >
                                                      <span slot="end">{parse(elevationUnit)}</span>
                                                  </WaInput>
                                                  {visible && (simulated ? (
                                                      <>
                                                          <WaTooltip
                                                              for={`simulated-altitude-help-${id}`}>{'Enter the real altitude to replace the simulated value.'}</WaTooltip>
                                                          <WaIcon id={`simulated-altitude-help-${id}`} {...UI_ICONS.info}
                                                                  style={{marginLeft: '4px'}}/>
                                                      </>
                                                  ) : (
                                                                   <>
                                                                       <WaTooltip
                                                                           for={`simulated-altitude-reset-${id}`}>{'Reset to simulated altitude'}</WaTooltip>
                                                                       <WaButton
                                                                           appearance="plain"
                                                                           variant="brand"
                                                                           id={`simulated-altitude-reset-${id}`}
                                                                           size="s"
                                                                           onClick={handleResetAltitude}
                                                                           disabled={!Number.isFinite(simulatedHeight)}
                                                                       >
                                                                           <WaIcon {...UI_ACTIONS.reset.icon}/>
                                                                       </WaButton>
                                                                   </>
                                                               ))}
                                              </div>
                                          ), [simulated, height, visible, simulatedHeight, elevationUnit, handleChangeAltitude, handleResetAltitude, id])

                                          return (
                                              <>
                                                  <WaDivider/>

                                                  <div className="map-poi-edit-wrapper" id={`edit-map-poi-content-${id}`}>
                                                      <div className="map-poi-edit-toolbar">
                                                          <div className="map-poi-edit-swatches">
                                                              <div className={classNames('map-poi-edit-color-link-group', {
                                                                  'is-linked': textBorderColorsLinked,
                                                              })}>
                                                                  <WaColorPicker
                                                                      id={`map-poi-text-${id}`}
                                                                      className="wa-visually-hidden-label"
                                                                      label="Text"
                                                                      size="s"
                                                                      value={currentTextColor}
                                                                      swatches={swatches}
                                                                      onClickCapture={event => captureColorPickerShift('text', event)}
                                                                      onChange={event => handleChangeColor('text', event)}
                                                                      disabled={!visible}
                                                                      noFormatToggle
                                                                  />
                                                                  <WaTooltip for={`map-poi-text-${id}`} placement="top">
                                                                      Text
                                                                  </WaTooltip>
                                                                  <WaButton
                                                                      id={`${tooltipIdPrefix}-link-text-border-colors`}
                                                                      className="square-button small map-poi-edit-color-link"
                                                                      size="xs"
                                                                      variant="brand"
                                                                      appearance="plain"
                                                                      aria-label={colorLinkAction.label}
                                                                      aria-pressed={textBorderColorsLinked}
                                                                      disabled={!visible}
                                                                      onClick={handleToggleTextBorderLink}
                                                                  >
                                                                      <WaIcon {...colorLinkAction.icon} label=""/>
                                                                  </WaButton>
                                                                  <WaTooltip for={`${tooltipIdPrefix}-link-text-border-colors`} placement="top">
                                                                      {colorLinkAction.label}
                                                                  </WaTooltip>
                                                                  <WaColorPicker
                                                                      id={`map-poi-border-${id}`}
                                                                      className="wa-visually-hidden-label"
                                                                      label="Border"
                                                                      size="s"
                                                                      value={currentBorderColor}
                                                                      swatches={swatches}
                                                                      onClickCapture={event => captureColorPickerShift('border', event)}
                                                                      onChange={event => handleChangeColor('border', event)}
                                                                      disabled={!visible}
                                                                      noFormatToggle
                                                                  />
                                                                  <WaTooltip for={`map-poi-border-${id}`} placement="top">
                                                                      Border
                                                                  </WaTooltip>
                                                              </div>
                                                              {canSwapColors && (
                                                                  <WaButton
                                                                      id={`${tooltipIdPrefix}-swap-colors`}
                                                                      className="square-button small map-poi-edit-color-swap"
                                                                      size="s"
                                                                      appearance="plain"
                                                                      aria-label={UI_ACTIONS.reversePOIColors.label}
                                                                      disabled={!visible}
                                                                      onClick={handleSwapColors}
                                                                  >
                                                                      <WaIcon size="s" {...UI_ACTIONS.reversePOIColors.icon} label=""/>
                                                                  </WaButton>
                                                              )}
                                                              {canSwapColors && (
                                                                  <WaTooltip for={`${tooltipIdPrefix}-swap-colors`} placement="top">
                                                                      {UI_ACTIONS.reversePOIColors.label}
                                                                  </WaTooltip>
                                                              )}
                                                              <WaColorPicker
                                                                  id={`map-poi-bg-${id}`}
                                                                  className="wa-visually-hidden-label"
                                                                  label="Background"
                                                                  size="s"
                                                                  value={bgColor ?? lgs.colors.poiDefaultBackground}
                                                                  swatches={swatches}
                                                                  onClickCapture={event => captureColorPickerShift('colour', event)}
                                                                  onChange={event => handleChangeColor('colour', event)}
                                                                  disabled={!visible || !background}
                                                                  noFormatToggle
                                                              />
                                                              <WaTooltip for={`map-poi-bg-${id}`} placement="top">
                                                                  Background
                                                              </WaTooltip>
                                                          </div>
                                                          <MapPOIEditMenu poiId={id}/>
                                                      </div>

                                                      <MapPOIEditPreview poi={id}/>
                                                      <div className="map-poi-display-controls map-poi-replay-actions-row">
                                                          <WaSwitch
                                                              className="map-poi-style-switch map-poi-replay-switch"
                                                              size="xs"
                                                              label-at-start
                                                              width-auto
                                                              checked={point.replay?.animated !== false}
                                                              disabled={!visible}
                                                              onInput={handleReplayAnimationChange}
                                                          >
                                                              {'Animate during Replay'}
                                                          </WaSwitch>
                                                          <div className="map-poi-replay-style-actions">
                                                              <WaButton
                                                                  id={`${tooltipIdPrefix}-copy-style`}
                                                                  size="s"
                                                                  appearance="plain"
                                                                  variant="brand"
                                                                  aria-label={UI_ACTIONS.copyPOIStyle.label}
                                                                  onClick={copyPresentation}
                                                              >
                                                                  <WaIcon size="s" {...UI_ACTIONS.copyPOIStyle.icon} label=""/>
                                                              </WaButton>
                                                              <WaTooltip for={`${tooltipIdPrefix}-copy-style`} placement="top">
                                                                  {UI_ACTIONS.copyPOIStyle.label}
                                                              </WaTooltip>
                                                              <WaButton
                                                                  id={`${tooltipIdPrefix}-paste-style`}
                                                                  size="s"
                                                                  appearance="plain"
                                                                  variant="brand"
                                                                  aria-label={UI_ACTIONS.pastePOIStyle.label}
                                                                  disabled={!canPaste}
                                                                  onClick={handlePastePresentation}
                                                              >
                                                                  <WaIcon size="s" {...UI_ACTIONS.pastePOIStyle.icon} label=""/>
                                                              </WaButton>
                                                              <WaTooltip for={`${tooltipIdPrefix}-paste-style`} placement="top">
                                                                  {UI_ACTIONS.pastePOIStyle.label}
                                                              </WaTooltip>
                                                          </div>
                                                      </div>

                                                      <WaTabGroup
                                                          className="map-poi-edit-tabs"
                                                          data-ui-state-persist="false"
                                                          active={activeTab}
                                                          onWaTabShow={handleTabShow}
                                                      >
                                                          <WaTab slot="nav" panel={`poi-edit-${id}`} active={sharedActiveTab === 'details'}>
                                                              <WaIcon size="s" {...UI_ACTIONS.poiDetails.icon}/>{UI_ACTIONS.poiDetails.label}
                                                          </WaTab>
                                                          <WaTab slot="nav" panel={`poi-content-${id}`} active={sharedActiveTab === 'content'}>
                                                              <WaIcon size="s" name="rectangle-list" variant="regular"/>{'Content'}
                                                          </WaTab>
                                                          <WaTab slot="nav" panel={`poi-style-${id}`} active={sharedActiveTab === 'decoration'}>
                                                              <WaIcon size="s" name="paintbrush-pencil" variant="regular"/>{'Decoration'}
                                                          </WaTab>
                                                          <WaTabPanel name={`poi-edit-${id}`} active={sharedActiveTab === 'details'}>
                                                              <div className="map-poi-edit-tab-scroll-area">
                                                                  <LGSScrollbars>
                                                                      <div className="edit-map-poi-wrapper map-poi-edit-tab-scroll-content">
                                                                      <MapPOICategorySelector point={point} disabled={!visible}/>
                                                                      <WaInput appearance="filled"
                                                                          size="s"
                                                                          value={title}
                                                                          onInput={handleChangeTitle}
                                                                          onFocus={handleTitleFocus}
                                                                          onBlur={handleTitleBlur}
                                                                          className="edit-title-map-poi-input"
                                                                          label="Title"
                                                                          label-at-start
                                                                          readOnly={!visible}
                                                                      />

                                                                      {journeyAssociation.canAssociate && (
                                                                          <JourneySelector
                                                                              label="Journey"
                                                                              value={journeyAssociation.selectedJourneySlug}
                                                                              size="s"
                                                                              className="map-poi-journey-selector"
                                                                              onChange={journeyAssociation.handleChangeJourney}
                                                                              disabled={!visible}
                                                                              journeys={journeyAssociation.journeys}
                                                                              allowEmptyOption
                                                                              emptyLabel={NO_ASSOCIATED_JOURNEY_LABEL}
                                                                              hint={journeyAssociation.hint}
                                                                              syncEditorSelection={false}
                                                                          />
                                                                      )}
                                                                      <WaTextarea appearance="filled"
                                                                          value={description}
                                                                          onInput={handleChangeDescription}
                                                                          className="edit-title-map-poi-input"
                                                                          label="Description"
                                                                          label-at-start
                                                                          disabled={!visible}
                                                                      />
                                                                      {location && (
                                                                          <>
                                                                              <div className="map-poi-location" id={`${tooltipIdPrefix}-location`}>
                                                                                  <WaIcon {...UI_ICONS.location}/>
                                                                                  <span>{location}</span>
                                                                              </div>
                                                                              <WaTooltip for={`${tooltipIdPrefix}-location`}>{location}</WaTooltip>
                                                                          </>
                                                                      )}
                                                                      {time && (
                                                                          <div className="poi-time">
                                                                              <DateTimeDisplay
                                                                                  value={time}
                                                                                  timeZone={point.timeZone}
                                                                                  longitude={point.longitude}
                                                                                  latitude={point.latitude}
                                                                                  leading={<WaIcon name="clock" variant="regular"/>}
                                                                              />
                                                                          </div>
                                                                      )}
                                                                      <div className="map-poi-edit-row-coordinates">
                                                                          <WaInput appearance="filled"
                                                                              className={classNames({'map-poi-edit-warning-coordinate': coordinateError.latitude})}
                                                                              size="s"
                                                                              inputMode="decimal"
                                                                              withoutSpinButtons
                                                                              value={coordinateDraft.latitude}
                                                                              onInput={handleChangeLatitude}
                                                                              label="Latitude"
                                                                              label-at-start
                                                                              disabled={!visible}
                                                                          />
                                                                          <WaInput appearance="filled"
                                                                              className={classNames({'map-poi-edit-warning-coordinate': coordinateError.longitude})}
                                                                              size="s"
                                                                              inputMode="decimal"
                                                                              withoutSpinButtons
                                                                              value={coordinateDraft.longitude}
                                                                              onInput={handleChangeLongitude}
                                                                              label="Longitude"
                                                                              label-at-start
                                                                              disabled={!visible}
                                                                          />
                                                                          <WaCopyButton
                                                                              variant="brand"
                                                                              appearance="plain"
                                                                              value={formattedCoordinates}
                                                                              size="s"
                                                                              onWaCopy={handleCopySuccess}
                                                                              disabled={!visible}
                                                                          />
                                                                      </div>
                                                                      {altitudeInput}
                                                                      </div>
                                                                  </LGSScrollbars>
                                                              </div>
                                                          </WaTabPanel>
                                                          <WaTabPanel name={`poi-content-${id}`} active={sharedActiveTab === 'content'} onClick={event => event.stopPropagation()}>
                                                              <div className="map-poi-edit-tab-scroll-area">
                                                                  <LGSScrollbars>
                                                                      <div className="map-poi-edit-tab-scroll-content">
                                                                          <MapPOIDisplaySettings
                                                                              panel="content"
                                                                              poi={id}
                                                                              display={point.display}
                                                                              hasDateTime={Boolean(time)}
                                                                              background={background}
                                                                              onDisplayChange={handleDisplayChange}
                                                                              onDisplayValueChange={handleDisplayValueChange}
                                                                              onStyleChange={handleStyleChange}
                                                                          />
                                                                      </div>
                                                                  </LGSScrollbars>
                                                              </div>
                                                          </WaTabPanel>
                                                          <WaTabPanel name={`poi-style-${id}`} active={sharedActiveTab === 'decoration'} onClick={event => event.stopPropagation()}>
                                                              <div className="map-poi-edit-tab-scroll-area">
                                                                  <LGSScrollbars>
                                                                      <div className="map-poi-edit-tab-scroll-content">
                                                                          <MapPOIDisplaySettings
                                                                              panel="decoration"
                                                                              poi={id}
                                                                              display={point.display}
                                                                              hasDateTime={Boolean(time)}
                                                                              background={background}
                                                                              onDisplayChange={handleDisplayChange}
                                                                              onDisplayValueChange={handleDisplayValueChange}
                                                                              onStyleChange={handleStyleChange}
                                                                          />
                                                                      </div>
                                                                  </LGSScrollbars>
                                                              </div>
                                                          </WaTabPanel>
                                                      </WaTabGroup>
                                                  </div>
                                              </>
                                          )
                                      },
                                      (prev, next) => prev.poi === next.poi,
)
