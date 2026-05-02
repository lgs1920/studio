/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: appShortcuts.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-05-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_POI, VIDEO_CROP_ZONE } from '@Core/constants'
import { getOrbitSettings, setOrbitStoreSettings } from '@Core/OrbitSettings'

const FOCUS_TARGET = 'target'

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const normalizedFocusPoint = point => {
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)
    const pointHeight = finiteNumber(point?.height)
    const simulatedHeight = finiteNumber(point?.simulatedHeight)
    const height = simulatedHeight ?? pointHeight

    if ([longitude, latitude, height].some(value => value === null)) {
        return null
    }

    const normalizedPoint = {
        ...point,
        longitude,
        latitude,
        height: pointHeight ?? height,
    }

    if (simulatedHeight !== null) {
        normalizedPoint.simulatedHeight = simulatedHeight
    }
    else {
        delete normalizedPoint.simulatedHeight
    }

    return normalizedPoint
}

const resolveFocusPoint = () => {
    const sceneTarget = __.ui.sceneManager?.target
    const cameraTarget = lgs.stores.main.components.camera.target
    const rotateTarget = lgs.stores.ui.mainUI.rotate.target
    const panoramaTarget = lgs.stores.ui.mainUI.panorama.target

    return [sceneTarget, cameraTarget, rotateTarget, panoramaTarget]
        .map(normalizedFocusPoint)
        .find(Boolean) ?? null
}

const toggleJourneyToolbar = () => {
    const toolbar = lgs.settings.ui.journeyToolbar
    toolbar.usage = true
    toolbar.show = true
    return true
}

const resolveRecorderToolbarPosition = () => ({
    left:     window.innerWidth / 2,
    top:      window.innerHeight / 2,
    attachTo: 'bottom',
})

const launchVideoRecording = () => {
    const video = lgs.stores.ui.video

    if (video.recording || video.preRecording || video.snapshot || video.finalizing) {
        return false
    }

    if (!video.editing) {
        video.editing = true
        lgs.stores.ui.mainUI.callForActions.active = false
        __.ui.drawerManager?.close?.()
        return true
    }

    return __.ui.widgetManager.syncCropDimensionsFromElement(VIDEO_CROP_ZONE, true, 'before-recording')
        .then(() => {
            const toolbarPosition = resolveRecorderToolbarPosition()
            Object.assign(video, {
                editing:      false,
                finalizing:   false,
                paused:       false,
                position:     toolbarPosition,
                preRecording: true,
                recording:    false,
                toolbarPosition,
            })
            __.ui.widgetManager.windowResizing = false
            __.ui.drawerManager?.close?.()
            return true
        })
}

const setPoiAnimated = async (target, animated) => {
    if (target?.element !== CURRENT_POI) {
        return
    }

    const poiId = target.slug ?? target.id
    if (!poiId) {
        return
    }

    const poi = lgs.stores.main.components.pois.list.get(poiId)
    if (poi?.animated !== animated) {
        await __.ui.poiManager.updatePOI(poiId, {animated})
    }
}

const toggleRotation = () => {
    const rotate = lgs.stores.ui.mainUI.rotate
    const panorama = lgs.stores.ui.mainUI.panorama

    if (panorama.active || rotate.running) {
        return __.ui.poiManager.stopRotationAndSync().then(() => true)
    }

    const focusPoint = resolveFocusPoint()
    if (!focusPoint) {
        console.warn('Cannot start map rotation without a valid target')
        return false
    }

    return (async () => {
        const rotationSettings = getOrbitSettings(focusPoint, 'rotation')
        setOrbitStoreSettings(rotate, rotationSettings)
        await __.ui.sceneManager.focus(focusPoint, {
            direction:  rotationSettings.direction,
            ...lgs.stores.main.components.camera.position,
            infinite:   true,
            rotate:     true,
            flyingTime: 0,
            rpm:        rotationSettings.rpm,
            target:     focusPoint.element ? focusPoint : FOCUS_TARGET,
        })
        await setPoiAnimated(focusPoint, true)
        return true
    })()
}

const togglePanorama = () => {
    const panorama = lgs.stores.ui.mainUI.panorama

    if (panorama.active) {
        return __.ui.poiManager.stopRotationAndSync().then(() => true)
    }

    const focusPoint = resolveFocusPoint()
    if (!focusPoint) {
        console.warn('Cannot start panorama without a valid target')
        return false
    }

    return (async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.poiManager.stopRotationAndSync()
        }

        const storedPanorama = {
            ...(focusPoint.panorama ?? {}),
            ...getOrbitSettings(focusPoint, 'panorama'),
        }

        panorama.target = focusPoint
        panorama.heading = lgs.stores.main.components.camera.position.heading ?? 0
        panorama.pitch = storedPanorama.pitch ?? panorama.pitch ?? -12
        panorama.heightOffset = storedPanorama.heightOffset ?? panorama.heightOffset ?? 1000
        setOrbitStoreSettings(panorama, storedPanorama)
        panorama.active = true
        await setPoiAnimated(focusPoint, true)
        return true
    })()
}

const removeSelectedWidget = () => {
    const widgetId = lgs.stores.ui.widget.current?.id
    if (!__.ui.widgetManager.canRemoveWidget(widgetId)) {
        return false
    }

    return __.ui.widgetManager.removeWidget(widgetId).then(() => true)
}

const editSelectedWidget = () => {
    const widgetId = lgs.stores.ui.widget.current?.id
    if (!__.ui.widgetManager.canEditWidget(widgetId)) {
        return false
    }

    return __.ui.widgetManager.editWidget(widgetId)
}

export const SHORTCUTS_CATALOG = [
    {
        action:      'Show journey toolbar',
        description: 'Makes the journey toolbar available on the map.',
        id:          'journey-toolbar-show',
        keys:        ['Alt+Shift+J'],
        scope:       'App',
    },
    {
        action:      'Video recording',
        description: 'Opens video setup, then starts recording when setup is already open.',
        id:          'video-recording',
        keys:        ['Alt+Shift+V'],
        scope:       'App',
    },
    {
        action:      'Toggle rotation',
        description: 'Starts or stops map rotation around the current target.',
        id:          'rotation-toggle',
        keys:        ['Alt+Shift+R'],
        scope:       'App',
    },
    {
        action:      'Toggle panorama',
        description: 'Starts or stops panorama mode around the current target.',
        id:          'panorama-toggle',
        keys:        ['Alt+Shift+P'],
        scope:       'App',
    },
    {
        action:      'Edit selected widget',
        description: 'Opens the editor for the selected widget.',
        id:          'widget-edit',
        keys:        ['Enter'],
        scope:       'Selected widget',
    },
    {
        action:      'Remove selected widget',
        description: 'Deletes the selected removable widget.',
        id:          'widget-remove',
        keys:        ['Delete', 'Backspace'],
        scope:       'Selected widget',
    },
    {
        action:      'Adjust angle',
        description: 'Drag on the globe while rotation mode is active.',
        id:          'rotation-angle',
        keys:        ['Left drag'],
        platform:    'macOS / Windows / Linux',
        reference:   true,
        scope:       'Rotation mode',
    },
    {
        action:      'Adjust distance',
        description: 'Move the camera closer to or farther from the active target.',
        id:          'rotation-distance-macos',
        keys:        ['Trackpad scroll'],
        platform:    'macOS',
        reference:   true,
        scope:       'Rotation mode',
    },
    {
        action:      'Adjust distance',
        description: 'Move the camera closer to or farther from the active target.',
        id:          'rotation-distance-windows-linux',
        keys:        ['Wheel'],
        platform:    'Windows / Linux',
        reference:   true,
        scope:       'Rotation mode',
    },
    {
        action:      'Adjust angle',
        description: 'Drag on the globe while panorama mode is active.',
        id:          'panorama-angle',
        keys:        ['Left drag'],
        platform:    'macOS / Windows / Linux',
        reference:   true,
        scope:       'Panorama mode',
    },
    {
        action:      'Adjust height',
        description: 'Change the panorama camera altitude.',
        id:          'panorama-height-macos',
        keys:        ['Trackpad scroll', 'Option+Left drag', 'Shift+Left drag', 'Right drag'],
        platform:    'macOS',
        reference:   true,
        scope:       'Panorama mode',
    },
    {
        action:      'Adjust height',
        description: 'Change the panorama camera altitude.',
        id:          'panorama-height-windows-linux',
        keys:        ['Wheel', 'Alt+Left drag', 'Shift+Left drag', 'Right drag'],
        platform:    'Windows / Linux',
        reference:   true,
        scope:       'Panorama mode',
    },
    {
        action:      'Rotate or pan',
        description: 'Cesium default: rotate the camera in 3D, or pan the map in 2D.',
        id:          'cesium-rotate-pan',
        keys:        ['Left drag'],
        platform:    'macOS / Windows / Linux',
        reference:   true,
        scope:       'Cesium navigation',
    },
    {
        action:      'Zoom',
        description: 'Cesium default zoom controls.',
        id:          'cesium-zoom',
        keys:        ['Right drag', 'Wheel', 'Pinch'],
        platform:    'macOS / Windows / Linux',
        reference:   true,
        scope:       'Cesium navigation',
    },
    {
        action:      'Tilt or twist',
        description: 'Cesium default tilt controls in 3D and Columbus View, or twist in 2D.',
        id:          'cesium-tilt',
        keys:        ['Middle drag', 'Pinch', 'Ctrl+Left drag', 'Ctrl+Right drag'],
        platform:    'macOS / Windows / Linux',
        reference:   true,
        scope:       'Cesium navigation',
    },
    {
        action:      'Look around',
        description: 'Cesium default look control in 3D and Columbus View.',
        id:          'cesium-look',
        keys:        ['Shift+Left drag'],
        platform:    'macOS / Windows / Linux',
        reference:   true,
        scope:       'Cesium navigation',
    },
]

const SHORTCUT_ACTIONS = {
    'journey-toolbar-show': toggleJourneyToolbar,
    'video-recording':      launchVideoRecording,
    'rotation-toggle':      toggleRotation,
    'panorama-toggle':      togglePanorama,
    'widget-edit':          editSelectedWidget,
    'widget-remove':        removeSelectedWidget,
}

export const installAppShortcuts = (shortcutManager) => {
    if (!shortcutManager) {
        return []
    }

    return SHORTCUTS_CATALOG.filter(shortcut => SHORTCUT_ACTIONS[shortcut.id]).map(shortcut => {
        const action = SHORTCUT_ACTIONS[shortcut.id]

        return shortcutManager.addShortcut(document, shortcut.keys, async (event) => {
            try {
                const handled = action?.(event)
                if (!handled) {
                    return
                }
                event.preventDefault()
                event.stopPropagation()
                await handled
            }
            catch (error) {
                console.error(`Shortcut "${shortcut.id}" failed`, error)
            }
        }, {
            focusOnPointerDown: false,
            preventDefault:     false,
            stopPropagation:    false,
        })
    })
}
