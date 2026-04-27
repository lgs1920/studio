/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPointContextMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_MAP_POINT, POI_STANDARD_TYPE, POIS_EDITOR_DRAWER, ROTATION_ICON } from '@Core/constants'
import { MapPOI }                                                                  from '@Core/MapPOI'
import { getOrbitSettings, setOrbitStoreSettings }                                 from '@Core/OrbitSettings'
import { ELEVATION_UNITS, UnitUtils }                                              from '@Utils/UnitUtils'
import { UIToast }                                                                 from '@Utils/UIToast'
import {
    WaButton, WaDivider, WaIcon,
}                                                                                  from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useMemo }                                                    from 'react'
import { useSnapshot }                                                             from 'valtio'

const DEFAULT_POI_TITLE = 'Point Of Interest'

export const MapPointContextMenu = ({target, menuRef}) => {
    const toolbars = useSnapshot(lgs.settings.ui.toolbars)
    const rotateState = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const panoramaState = useSnapshot(lgs.stores.ui.mainUI.panorama)
    const coordinateSystem = lgs.settings.coordinateSystem.current
    const unitSystem = lgs.settings.unitSystem.current

    const hideMenu = useCallback(() => __.ui.contextMenu.hide(), [])
    const openEditDrawer = useCallback((poiId) => {
        if (!poiId) {
            return
        }

        lgs.stores.main.components.pois.current = poiId
        __.ui.drawerManager.open(POIS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: poiId,
            tab:    null,
        })
    }, [])

    const createPOI = useCallback(async () => {
        if (!target) {
            return
        }

        const poi = new MapPOI({
                                   bgColor:         lgs.colors.poiDefaultBackground,
                                   category:        POI_STANDARD_TYPE,
                                   color:           lgs.colors.poiDefault,
                                   description:     '',
                                   height:          null,
                                   latitude:        target.latitude,
                                   longitude:       target.longitude,
                                   simulatedHeight: target.simulatedHeight ?? target.height ?? 0,
                                   title:           DEFAULT_POI_TITLE,
                                   type:            POI_STANDARD_TYPE,
                               })

        const createdPoi = await __.ui.poiManager.add(poi)
        if (!createdPoi) {
            UIToast.warning({
                                caption: 'POI not created !',
                                text:    'This location is too close to an existing POI!',
                            })
            return
        }

        const canEditFromToast = lgs.stores.ui.drawers.open !== POIS_EDITOR_DRAWER
        UIToast.success({
                            caption: 'POI created.',
                            text:    (
                                         <div className="toast-action-stack">
                                             <div>{createdPoi.title}</div>
                                             {canEditFromToast && (
                                                 <WaButton
                                                     className="toast-action-button"
                                                     appearance="filled"
                                                     size="small"
                                                     variant="brand"
                                                     onClick={() => openEditDrawer(createdPoi.id)}
                                                 >
                                                     <WaIcon slot="start" name="location-pen"
                                                             variant="regular"/>{'Edit'}
                                                 </WaButton>
                                             )}
                                         </div>
                                     ),
                        })
        hideMenu()
    }, [hideMenu, openEditDrawer, target])

    const copyCoordinates = useCallback(() => {
        if (!target) {
            return
        }

        __.ui.poiManager.copyCoordinatesToClipboard(target).then(() => {
            UIToast.success({
                                caption: 'Map point',
                                text:    'Coordinates copied to clipboard<br/>Format: latitude, longitude',
                            })
            hideMenu()
        })
    }, [hideMenu, target])

    const rotateAroundPoint = useCallback(async () => {
        if (!target) {
            return
        }

        const rotationSettings = getOrbitSettings(target, 'rotation')
        setOrbitStoreSettings(lgs.stores.ui.mainUI.rotate, rotationSettings)

        await __.ui.sceneManager.focus(target, {
            direction:  rotationSettings.direction,
            flyingTime: 0,
            heading:    lgs.stores.main.components.camera.position.heading,
            infinite:   true,
            pitch:      lgs.stores.main.components.camera.position.pitch,
            range:      lgs.stores.main.components.camera.position.range,
            roll:       lgs.stores.main.components.camera.position.roll,
            rotate:     true,
            rpm:        rotationSettings.rpm,
            target,
        })
        hideMenu()
    }, [hideMenu, target])

    const startPanoramic = useCallback(async () => {
        if (!target) {
            return
        }

        if (__.ui.cameraManager.isRotating()) {
            await __.ui.poiManager.stopRotationAndSync()
        }

        const panorama = lgs.stores.ui.mainUI.panorama
        const panoramaSettings = getOrbitSettings(target, 'panorama')
        panorama.target = target
        panorama.heading = lgs.stores.main.components.camera.position.heading ?? 0
        panorama.pitch = Number.isFinite(panorama.pitch) ? panorama.pitch : -12
        panorama.heightOffset = Number.isFinite(panorama.heightOffset) ? panorama.heightOffset : 1000
        setOrbitStoreSettings(panorama, panoramaSettings)
        panorama.active = true
        hideMenu()
    }, [hideMenu, target])

    const stopRotation = useCallback(async () => {
        await __.ui.poiManager.stopRotationAndSync()
        hideMenu()
    }, [hideMenu])

    const isPointRotating = target
        && rotateState.running
        && rotateState.target?.element === CURRENT_MAP_POINT
        && rotateState.target?.slug === target.slug

    const isPointPanoramic = target
        && panoramaState.active
        && panoramaState.target?.element === CURRENT_MAP_POINT
        && panoramaState.target?.slug === target.slug

    const latitudeLabel = useMemo(
        () => target ? __.convert(target.latitude).to(coordinateSystem) : '',
        [coordinateSystem, target],
    )
    const longitudeLabel = useMemo(
        () => target ? __.convert(target.longitude).to(coordinateSystem) : '',
        [coordinateSystem, target],
    )
    const simulatedAltitude = useMemo(() => {
        if (!target) {
            return ''
        }

        const meters = target.simulatedHeight ?? target.height ?? 0
        const value = UnitUtils.convert(meters).to(ELEVATION_UNITS[unitSystem])
        return `${Math.round(value)} ${ELEVATION_UNITS[unitSystem]}`
    }, [target, unitSystem])

    if (!target) {
        return null
    }

    return (
        <div
            ref={menuRef}
            className="lgs-context-menu map-point-context-menu poi-on-map-menu lgs-card wa-theme-lgs1920-on-map"
            style={{'--lgs-on-map-ui-opacity': toolbars.opacity}}
            onContextMenu={(event) => event.preventDefault()}
        >
            <div className="map-point-context-menu-summary">
                <div className="map-point-context-menu-title">{'Map point'}</div>
                <div className="map-point-context-menu-row">
                    <span>{'Latitude'}</span>
                    <strong>{latitudeLabel}</strong>
                </div>
                <div className="map-point-context-menu-row">
                    <span>{'Longitude'}</span>
                    <strong>{longitudeLabel}</strong>
                </div>
                <div className="map-point-context-menu-row">
                    <span>{'Simulated Alt.'}</span>
                    <strong>{simulatedAltitude}</strong>
                </div>
                <WaDivider/>
            </div>

            <ul>
                <li onClick={copyCoordinates}>
                    <WaIcon name="copy" variant="regular"/>{'Copy Coords'}
                </li>
                <li onClick={createPOI}>
                    <WaIcon name="location-dot" variant="regular"/>{'Create POI'}
                </li>
                {isPointRotating || isPointPanoramic ? (
                    <li onClick={stopRotation}>
                        <WaIcon name={ROTATION_ICON} animation="spin" variant="regular"/>
                        {isPointPanoramic ? 'Stop Panorama' : 'Stop Rotation'}
                    </li>
                ) : (
                     <>
                         <li onClick={rotateAroundPoint}>
                             <WaIcon name={ROTATION_ICON} variant="regular"/>{'Rotate Around'}
                         </li>
                         <li onClick={startPanoramic}>
                             <WaIcon name="panorama" variant="regular"/>{'Panoramic'}
                         </li>
                     </>
                 )}
            </ul>
        </div>
    )
}
