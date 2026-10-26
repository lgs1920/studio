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
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOICategorySelector } from '@Components/MainUI/MapPOI/MapPOICategorySelector'
import { MapPOIDisplaySettings }  from '@Components/MainUI/MapPOI/MapPOIDisplaySettings'
import { DateTimeDisplay }        from '@Components/DateTimeDisplay'
import { MapPOIEditMenu }         from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import {
    NO_ASSOCIATED_JOURNEY_LABEL, usePOIJourneyAssociation,
}                                 from '@Components/MainUI/MapPOI/usePOIJourneyAssociation'
import { JourneySelector }        from '@Editor/journey/JourneySelector'
import {
    COORDINATE_INPUT_ERROR_DURATION_MS, COORDINATE_INPUT_NORMALIZE_DELAY_MS, POI_STANDARD_TYPE, POI_TMP_TYPE,
}                                 from '@Core/constants'
import { normalizePOIDisplaySettings } from '@Core/POIDisplaySettings'

import { UIToast } from '@Utils/UIToast'
import {
    ELEVATION_UNITS, UnitUtils,
}                  from '@Utils/UnitUtils'
import {
    WaButton, WaCallout, WaColorPicker, WaCopyButton, WaDivider, WaIcon, WaInput, WaSwitch, WaTab, WaTabGroup,
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
                                          const coordinateSystemSettings = useSnapshot(lgs.settings.coordinateSystem)
                                          const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
                                          const coordinateSystem = coordinateSystemSettings.current
                                          const swatchesList = lgs.settings.getSwatches.list
                                          const elevationUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[0]

                                          /** @type {Object} Fresh proxy reference for direct mutations */
                                          const $point = lgs.stores.main.components.pois.list.get(poi)
                                          const point = useSnapshot($point ?? EMPTY_POI_PROXY)
                                          const journeyAssociation = usePOIJourneyAssociation(point)

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

                                              void __.ui.poiManager.updatePOI(poi, {display: nextDisplay}, {
                                                  immediate: field !== 'maxWidth',
                                              })
                                                  .catch(error => console.error(`[MapPOIEditContent] Failed to save ${field}:`, error))
                                          }, [poi])

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

                                              void __.ui.poiManager.updatePOI(poi, {[field]: event.target.checked}, {immediate: true})
                                                  .catch(error => console.error(`[MapPOIEditContent] Failed to save ${field}:`, error))
                                          }, [poi])

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
                                              void __.ui.poiManager.updatePOI(poi, {
                                                  replay: {
                                                      ...currentReplaySettings,
                                                      animated: event.target.checked === true,
                                                  },
                                              }, {immediate: true})
                                                  .catch(error => console.error('[MapPOIEditContent] Failed to save Replay animation preference:', error))
                                          }, [poi])

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
                                                    pill = true,
                                                    noBackground = false,
                                                    time,
                                                    visible     = true,
                                                } = point

                                          const [coordinateDraft, setCoordinateDraft] = useState({
                                                                                                     latitude:  UnitUtils.formatCoordinate(latitude, coordinateSystem),
                                                                                                     longitude: UnitUtils.formatCoordinate(longitude, coordinateSystem),
                                                                                                 })
                                          const [coordinateError, setCoordinateError] = useState({
                                                                                                     latitude:  false,
                                                                                                     longitude: false,
                                                                                                 })
                                          const [activeTab, setActiveTab] = useState(`poi-edit-${id}`)

                                          /** @type {[boolean, function]} Tracks if the altitude is currently simulated */
                                          const [simulated, setSimulated] = useState(height == null || height === simulatedHeight)

                                          const _poiColor = useRef(null)
                                          const _poiBgColor = useRef(null)
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
                                              const lat = __.convert(point.latitude).to(lgs.settings.coordinateSystem.current)
                                              const lng = __.convert(point.longitude).to(lgs.settings.coordinateSystem.current)
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

                                              await __.ui.poiManager.updatePOI(poi, {height: meters}, {immediate: true})
                                          }, [poi, elevationUnit, point.simulatedHeight])

                                          /**
                                           * Handles color updates while preventing event bubbling
                                           */
                                          const handleChangeColor = useCallback(async (event) => {
                                              if (!window.isOK) {
                                                  return
                                              }

                                              event.stopPropagation()
                                              event.preventDefault()

                                              const update = {}
                                              if (event.target === _poiColor.current) {
                                                  update.color = event.target.value
                                              }
                                              if (event.target === _poiBgColor.current) {
                                                  update.bgColor = event.target.value
                                              }

                                              if (Object.keys(update).length > 0) {
                                                  await __.ui.poiManager.updatePOI(poi, update)
                                              }
                                          }, [poi])

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
                                                  await __.ui.poiManager.updatePOI(poi, {[key]: val})
                                              }
                                          }, [poi, latitude, longitude, coordinateSystem, showCoordinateError])

                                          const handleChangeLatitude = makeCoordHandler('latitude')
                                          const handleChangeLongitude = makeCoordHandler('longitude')

                                          const handleChangeTitle = useCallback(async (event) => {
                                              if (!window.isOK) {
                                                  return
                                              }
                                              if (event.target.tagName.toLowerCase() === 'wa-input') {
                                                  await __.ui.poiManager.updatePOI(poi, {title: event.target.value})
                                              }
                                          }, [poi])

                                          const previousTitleRef = useRef(title)

                                          /** Keep the selected tab controlled without resetting it during POI updates. */
                                          const handleTabShow = useCallback((event) => {
                                              const panelName = event?.detail?.name
                                              if (panelName) {
                                                  setActiveTab(panelName)
                                              }
                                          }, [])

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
                                              await __.ui.poiManager.updatePOI(poi, {title: fallbackTitle})
                                          }, [poi])

                                          const handleChangeDescription = useCallback(async (event) => {
                                              if (window.isOK) {
                                                  await __.ui.poiManager.updatePOI(poi, {description: event.target.value})
                                              }
                                          }, [poi])

                                          const handleCopySuccess = useCallback(() => {
                                              UIToast.success({
                                                                  caption: title ?? 'POI', text: 'Coordinates copied<br/>Format: latitude, longitude',
                                                              })
                                          }, [title])

                                          const handleAddToLibrary = useCallback(async () => {
                                              await __.ui.poiManager.updatePOI(poi, {type: POI_STANDARD_TYPE})
                                          }, [poi])

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
                                              await __.ui.poiManager.updatePOI(poi, {height: simulatedHeight}, {immediate: true})
                                          }, [poi, simulatedHeight])

                                          const swatches = useMemo(() => swatchesList.join(';'), [swatchesList])

                                          useEffect(() => {
                                              setSimulated(height == null || height === simulatedHeight)
                                          }, [height, simulatedHeight])

                                          useEffect(() => {
                                              setActiveTab(`poi-edit-${id}`)
                                          }, [id])

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
                                                          <WaIcon id={`simulated-altitude-help-${id}`} name="circle-info" variant="regular"
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
                                                                           <WaIcon name="arrow-rotate-left" variant="regular"/>
                                                                       </WaButton>
                                                                   </>
                                                               ))}
                                              </div>
                                          ), [simulated, height, visible, simulatedHeight, elevationUnit, handleChangeAltitude, handleResetAltitude, id])

                                          return (
                                              <>
                                                  <WaDivider/>

                                                  {point.type === POI_TMP_TYPE && (
                                                      <WaCallout variant="warning" className="edit-map-poi-warning" open>
                                                          <WaIcon slot="icon" variant="regular" name="location-exclamation"/>
                                                          <div>
                                                              {'This POI is temporary and won\'t be saved. Add it to the library to save it.'}
                                                              <WaButton size="s" slot="end" variant="warning"
                                                                        onClick={handleAddToLibrary}>
                                                                  <WaIcon slot="start" name="location-dot" variant="regular"/>{'Add it'}
                                                              </WaButton>
                                                          </div>
                                                      </WaCallout>)}

                                                  <div className="map-poi-edit-wrapper" id={`edit-map-poi-content-${id}`}>
                                                      <div className="map-poi-edit-toolbar">
                                                          <div className="map-poi-edit-swatches">
                                                              <WaTooltip for={`map-poi-bg-${id}`}>{'Background Color'}</WaTooltip>
                                                              <WaColorPicker
                                                                  id={`map-poi-bg-${id}`}
                                                                  size="s"
                                                                  value={bgColor ?? lgs.colors.poiDefaultBackground}
                                                                  swatches={swatches}
                                                                  onChange={handleChangeColor}
                                                                  disabled={!visible || noBackground}
                                                                  noFormatToggle
                                                                  ref={_poiBgColor}
                                                              />
                                                              <WaTooltip for={`map-poi-fg-${id}`}>{'Foreground Color'}</WaTooltip>
                                                              <WaColorPicker
                                                                  id={`map-poi-fg-${id}`}
                                                                  size="s"
                                                                  value={color ?? lgs.colors.poiDefault}
                                                                  swatches={swatches}
                                                                  onChange={handleChangeColor}
                                                                  disabled={!visible}
                                                                  noFormatToggle
                                                                  ref={_poiColor}
                                                              />
                                                          </div>
                                                          <MapPOIEditMenu poiId={id}/>
                                                      </div>

                                                      <WaTabGroup
                                                          className="map-poi-edit-tabs"
                                                          active={activeTab}
                                                          onWaTabShow={handleTabShow}
                                                      >
                                                          <WaTab slot="nav" panel={`poi-edit-${id}`}>
                                                              <WaIcon size="s" name="pen-to-square" variant="regular"/>{'Edit'}
                                                          </WaTab>
                                                          <WaTab slot="nav" panel={`poi-style-${id}`}>
                                                              <WaIcon size="s" name="paintbrush-pencil" variant="regular"/>{'Style'}
                                                          </WaTab>
                                                          <WaTabPanel name={`poi-edit-${id}`}>
                                                              <div className="edit-map-poi-wrapper">
                                                                  <div className="map-poi-replay-animation-row">
                                                                      <WaSwitch
                                                                          size="xs"
                                                                          label-at-start
                                                                          checked={point.replay?.animated !== false}
                                                                          disabled={!visible}
                                                                          onInput={handleReplayAnimationChange}
                                                                      >
                                                                          {'Animate during Replay'}
                                                                      </WaSwitch>
                                                                  </div>
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
                                                                      <div className="map-poi-location" title={location}>
                                                                          <WaIcon name="location-dot" variant="regular"/>
                                                                          <span>{location}</span>
                                                                      </div>
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
                                                          </WaTabPanel>
                                                          <WaTabPanel name={`poi-style-${id}`} onClick={event => event.stopPropagation()}>
                                                              <MapPOIDisplaySettings
                                                                  poi={id}
                                                                  display={point.display}
                                                                  hasDateTime={Boolean(time)}
                                                                  pill={pill}
                                                                  noBackground={noBackground}
                                                                  onDisplayChange={handleDisplayChange}
                                                                  onStyleChange={handleStyleChange}
                                                              />
                                                          </WaTabPanel>
                                                      </WaTabGroup>
                                                  </div>
                                              </>
                                          )
                                      },
                                      (prev, next) => prev.poi === next.poi,
)
