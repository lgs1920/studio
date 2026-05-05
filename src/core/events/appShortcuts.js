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

import { CURRENT_MAP_POINT, CURRENT_POI, SCENE_MODE_2D, VIDEO_CROP_ZONE, WANDER_DRAWER } from '@Core/constants'
import { hasActiveAppShortcutBlocker } from '@Core/events/shortcutBlockers'
import { MapTarget } from '@Core/MapTarget'
import { getOrbitSettings, setOrbitStoreSettings } from '@Core/OrbitSettings'
import { Cartesian2, Cartographic, Math as CesiumMath } from 'cesium'

const MAP_POINT_PRECISION = 6
const APP_SHORTCUT_TARGET = () => globalThis.window ?? globalThis.document
const MIN_MAP_TARGET_HEIGHT = -12000
const WIDGET_MOVE_STEP = 2
const WIDGET_FAST_MOVE_STEP = 20
const WIDGET_SCALE_STEP = 0.01
const WIDGET_FAST_SCALE_STEP = 0.1
const WIDGET_SHORTCUT_EDITABLE_SELECTOR = [
    'input',
    'textarea',
    'select',
    'wa-input',
    'wa-textarea',
    'wa-select',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[role="textbox"]',
].join(',')

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const isWidgetShortcutEditableTarget = target => {
    const ElementClass = globalThis.Element
    return ElementClass && target instanceof ElementClass && Boolean(target.closest(WIDGET_SHORTCUT_EDITABLE_SELECTOR))
}

const mapTargetHeight = value => {
    const height = finiteNumber(value)
    return height !== null && height >= MIN_MAP_TARGET_HEIGHT ? height : null
}

const normalizedFocusPoint = point => {
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)
    const pointHeight = mapTargetHeight(point?.height)
    const simulatedHeight = mapTargetHeight(point?.simulatedHeight)
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

const explicitTargetOf = target => target?.element ? target : null

const resolveCurrentPoiId = () => {
    const pois = lgs.stores.main.components.pois
    const current = pois?.current
    const poiId = typeof current === 'string' ? current : (current?.slug ?? current?.id)
    return poiId && pois?.list?.has(poiId) ? poiId : null
}

const resolveCurrentPoiTarget = () => {
    const poiId = resolveCurrentPoiId()
    const poi = poiId ? lgs.stores.main.components.pois.list.get(poiId) : null

    if (!poi) {
        return null
    }

    return {
        ...poi,
        element: CURRENT_POI,
        slug:    poi.slug ?? poi.id ?? poiId,
    }
}

const buildMapPointId = ({longitude, latitude}) => {
    return `${CURRENT_MAP_POINT}:${longitude.toFixed(MAP_POINT_PRECISION)}:${latitude.toFixed(MAP_POINT_PRECISION)}`
}

const resolveMapCenterTarget = () => {
    const canvas = lgs.canvas ?? lgs.viewer?.canvas
    const scene = lgs.scene ?? lgs.viewer?.scene
    const camera = lgs.camera ?? lgs.viewer?.camera

    if (!canvas || !scene || !camera) {
        return null
    }

    const center = new Cartesian2(
        Math.round(canvas.clientWidth / 2),
        Math.round(canvas.clientHeight / 2),
    )
    const pickRay = camera.getPickRay?.(center)
    const globe = scene.globe
    let cartesian = pickRay ? globe?.pick?.(pickRay, scene) : null

    if (!cartesian) {
        cartesian = camera.pickEllipsoid?.(center, globe?.ellipsoid)
    }
    if (!cartesian) {
        return null
    }

    const cartographic = Cartographic.fromCartesian(cartesian)
    if (!cartographic) {
        return null
    }

    const longitude = CesiumMath.toDegrees(cartographic.longitude)
    const latitude = CesiumMath.toDegrees(cartographic.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
    }

    const height = __.ui.sceneManager?.noRelief?.() ? 0 : (mapTargetHeight(cartographic.height) ?? 0)
    const target = new MapTarget(CURRENT_MAP_POINT, {
        height,
        id: buildMapPointId({longitude, latitude}),
        latitude,
        longitude,
    })
    target.simulatedHeight = height
    target.title = 'Map center'
    return target
}

const resolvePanoramaFocus = () => {
    const sceneTarget = __.ui.sceneManager?.target
    const explicitSceneTarget = normalizedFocusPoint(explicitTargetOf(sceneTarget))
    const currentPoiTarget = normalizedFocusPoint(resolveCurrentPoiTarget())
    const centerTarget = resolveMapCenterTarget()
    const cameraTarget = lgs.stores.main.components.camera.target
    const rotateTarget = lgs.stores.ui.mainUI.rotate.target
    const panoramaTarget = lgs.stores.ui.mainUI.panorama.target

    return [
        currentPoiTarget,
        centerTarget,
        explicitSceneTarget,
        panoramaTarget,
        rotateTarget,
        cameraTarget,
    ]
        .map(normalizedFocusPoint)
        .find(Boolean) ?? null
}

const currentCameraOrbitOptions = () => {
    const position = lgs.stores.main.components.camera.position ?? {}
    return {
        heading: finiteNumber(position.heading) ?? lgs.settings.camera.heading,
        pitch:   finiteNumber(position.pitch) ?? lgs.settings.camera.pitch,
        roll:    finiteNumber(position.roll) ?? lgs.settings.camera.roll,
        range:   finiteNumber(position.range) ?? lgs.settings.camera.range,
    }
}

const isScene2D = () => Number(lgs.settings.scene.mode.value) === Number(SCENE_MODE_2D.value)

const toggleJourneyToolbar = () => {
    const toolbar = lgs.settings.ui.journeyToolbar
    toolbar.usage = true
    toolbar.show = true
    return true
}

const openJourneyImporter = () => {
    const mainUI = lgs.stores.ui.mainUI
    mainUI.callForActions.active = false
    mainUI.journeyLoader.visible = true
    return true
}

const openWanderManagement = () => {
    lgs.stores.ui.mainUI.callForActions.active = false
    __.ui.drawerManager?.open?.(WANDER_DRAWER)
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

    return (async () => {
        const poiId = resolveCurrentPoiId()
        if (poiId) {
            return __.ui.poiManager.rotateAroundPOI(poiId)
        }

        await __.ui.cameraManager.updatePositionInformation?.()
        const sceneTarget = explicitTargetOf(__.ui.sceneManager?.target)
        const centerTarget = normalizedFocusPoint(resolveMapCenterTarget())
        const target = centerTarget
            ?? normalizedFocusPoint(sceneTarget)
            ?? normalizedFocusPoint(lgs.stores.ui.mainUI.rotate.target)
            ?? normalizedFocusPoint(lgs.stores.main.components.camera.target)

        if (!target) {
            console.warn('Cannot start map rotation without a valid target', {sceneTarget})
            return false
        }

        const settingsTarget = centerTarget ? target : (sceneTarget ?? target)
        const rotationSettings = getOrbitSettings(settingsTarget, 'rotation')
        setOrbitStoreSettings(rotate, rotationSettings)
        await __.ui.sceneManager.focus(target, {
            direction:  rotationSettings.direction,
            flyingTime: 0,
            ...currentCameraOrbitOptions(),
            infinite:   true,
            rotate:     true,
            rpm:        rotationSettings.rpm,
            target,
        })
        return true
    })()
}

const togglePanorama = () => {
    const panorama = lgs.stores.ui.mainUI.panorama

    if (panorama.active) {
        return __.ui.poiManager.stopRotationAndSync().then(() => true)
    }

    if (isScene2D()) {
        console.warn('Panorama mode is not available in 2D')
        return false
    }

    return (async () => {
        await __.ui.cameraManager.updatePositionInformation?.()
        const focusPoint = resolvePanoramaFocus()
        if (!focusPoint) {
            console.warn('Cannot start panorama without a valid target')
            return false
        }

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

const selectedWidgetContext = () => {
    const video = lgs.stores?.ui?.video

    if (video?.preRecording || video?.recording || video?.snapshot || video?.finalizing) {
        return null
    }

    const widgetId = lgs.stores.ui.widget.current?.id
    const element = widgetId ? __.ui.widgetManager.getElementById(widgetId) : null
    const config = widgetId ? __.ui.widgetManager.getWidgetConfig(widgetId) : null

    if (!widgetId || !element || !config) {
        return null
    }

    return {config, element, widgetId}
}

const widgetBoundsRect = config => (config.boundsContainer ?? config.container ?? lgs.canvas)?.getBoundingClientRect?.() ?? null

const syncCropperKeyboardMove = (config) => {
    if (!config.isCropper || !config.cropDimensions) {
        return
    }

    const width = Number(config.cropDimensions.width)
    const height = Number(config.cropDimensions.height)

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return
    }

    config.cropDimensions = {
        left: config.position.left,
        top:  config.position.top,
        width,
        height,
    }
    config.dimensions = {width, height}

    if (config.resizeFromCenter) {
        const containerRect = config.container?.getBoundingClientRect?.()
        if (containerRect?.width > 0 && containerRect?.height > 0) {
            config.centerRatio = {
                x: (config.position.left - containerRect.left + width / 2) / containerRect.width,
                y: (config.position.top - containerRect.top + height / 2) / containerRect.height,
            }
        }
    }

    __.ui.widgetManager.applyCropToOverlay(config)
    __.ui.widgetManager.dispatchCropUpdate(config, 'keyboard-move')
}

const persistWidgetKeyboardChange = async (widgetId, config) => {
    __.ui.widgetManager.setConfig(widgetId, config)
    __.ui.widgetManager.getMoveable(widgetId)?.current?.updateRect()
    __.ui.widgetManager.refreshEditorPreviewSnapshot(widgetId)
    lgs.stores.ui.widget.current = {
        ...(lgs.stores.ui.widget.current ?? {}),
        id: widgetId,
        keyboardUpdate: ((lgs.stores.ui.widget.current?.keyboardUpdate ?? 0) + 1),
    }

    if (config.persist) {
        await __.ui.widgetManager.saveWidgetPosition(widgetId, config)
    }
}

const moveSelectedWidget = async (dx, dy) => {
    const context = selectedWidgetContext()

    if (!context || context.config.draggable === false) {
        return false
    }

    const {config, element, widgetId} = context
    const position = config.position ?? {
        left: parseFloat(element.style.left || '0') || 0,
        top:  parseFloat(element.style.top || '0') || 0,
    }

    config.position = {
        left: position.left + dx,
        top:  position.top + dy,
    }

    const boundsRect = widgetBoundsRect(config)
    if (boundsRect) {
        config.position = __.ui.widgetManager.adaptPositionToContainer(config, boundsRect)
    }

    __.ui.widgetManager.applyPosition(element, config.position)
    syncCropperKeyboardMove(config)
    await persistWidgetKeyboardChange(widgetId, config)

    return true
}

const resizeSelectedWidget = async (factor) => {
    const context = selectedWidgetContext()

    if (!context || (!context.config.scalable && !context.config.contextMenu?.canReset)) {
        return false
    }

    const {config, element, widgetId} = context
    const currentScale = config.scale ?? {x: 1, y: 1}
    const nextScale = __.ui.widgetManager.clampScale({
        x: currentScale.x * (1 + factor),
        y: currentScale.y * (1 + factor),
    }, config)
    const boundsRect = widgetBoundsRect(config)

    config.scale = boundsRect ? __.ui.widgetManager.adaptScaleToContainer({
        ...config,
        scale: nextScale,
    }, boundsRect) : nextScale
    config.position = boundsRect ? __.ui.widgetManager.adaptPositionToContainer(config, boundsRect) : config.position

    __.ui.widgetManager.setScale(element, config.scale.x, config.scale.y)
    __.ui.widgetManager.applyPosition(element, config.position)
    await persistWidgetKeyboardChange(widgetId, config)

    return true
}

const isPlusKey = event => event.key === '+'
    || event.code === 'NumpadAdd'
    || event.key?.toLowerCase() === 'plus'
    || (event.code === 'Equal' && (event.ctrlKey || event.shiftKey))

const isMinusKey = event => event.key === '-'
    || event.code === 'Minus'
    || event.code === 'NumpadSubtract'
    || event.key?.toLowerCase() === 'minus'

const widgetKeyboardShortcutAction = event => {
    if (lgs.stores.ui.mainUI.panorama.active
        || lgs.stores.ui.mainUI.rotate.running
        || hasActiveAppShortcutBlocker()
        || isWidgetShortcutEditableTarget(event.target)
        || event.altKey
        || event.metaKey) {
        return null
    }

    const context = selectedWidgetContext()
    if (!context) {
        return null
    }

    const ctrl = event.ctrlKey
    const key = event.key
    const moveStep = ctrl ? WIDGET_FAST_MOVE_STEP : WIDGET_MOVE_STEP
    const scaleStep = ctrl ? WIDGET_FAST_SCALE_STEP : WIDGET_SCALE_STEP

    switch (key) {
        case 'ArrowUp':
            if (event.shiftKey || context.config.draggable === false) {
                return null
            }
            return () => moveSelectedWidget(0, -moveStep)
        case 'ArrowDown':
            if (event.shiftKey || context.config.draggable === false) {
                return null
            }
            return () => moveSelectedWidget(0, moveStep)
        case 'ArrowLeft':
            if (event.shiftKey || context.config.draggable === false) {
                return null
            }
            return () => moveSelectedWidget(-moveStep, 0)
        case 'ArrowRight':
            if (event.shiftKey || context.config.draggable === false) {
                return null
            }
            return () => moveSelectedWidget(moveStep, 0)
    }

    if (isPlusKey(event)) {
        if (!context.config.scalable && !context.config.contextMenu?.canReset) {
            return null
        }
        return () => resizeSelectedWidget(scaleStep)
    }

    if (isMinusKey(event)) {
        if (event.shiftKey || (!context.config.scalable && !context.config.contextMenu?.canReset)) {
            return null
        }
        return () => resizeSelectedWidget(-scaleStep)
    }

    return null
}

const installWidgetKeyboardShortcuts = () => {
    const target = APP_SHORTCUT_TARGET()

    if (!target?.addEventListener) {
        return () => {}
    }

    const listener = event => {
        const action = widgetKeyboardShortcutAction(event)

        if (!action) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()

        Promise.resolve(action()).catch(error => {
            console.error('Widget keyboard shortcut failed', error)
        })
    }

    target.addEventListener('keydown', listener, {capture: true})
    return () => target.removeEventListener('keydown', listener, {capture: true})
}

export const SHORTCUTS_CATALOG = [
    {
        action:      'Import journey',
        description: 'Opens the journey import dialog.',
        id:          'journey-import',
        keys:        ['Alt+Shift+I'],
        scope:       'App',
    },
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
        action:      'Show Wander controls',
        description: 'Opens the Wander management drawer.',
        id:          'wander-management-show',
        keys:        ['Alt+Shift+W'],
        scope:       'Wander mode',
    },
    {
        action:      'Toggle rotation',
        description: 'Starts or stops map rotation around the current target.',
        id:          'rotation-toggle',
        keys:        ['Alt+Shift+R', 'Alt+Shift+O'],
        scope:       'App',
    },
    {
        action:      'Toggle panorama',
        description: 'Starts or stops panorama mode around the current target.',
        id:          'panorama-toggle',
        keys:        ['Alt+Shift+P', 'Alt+Shift+N'],
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
        action:      'Resize selected widget',
        description: 'Increases or decreases the selected widget size by 1%.',
        id:          'widget-resize',
        keys:        ['Plus', 'Minus'],
        scope:       'Selected widget',
    },
    {
        action:      'Resize selected widget faster',
        description: 'Increases or decreases the selected widget size by 10%.',
        id:          'widget-resize-fast',
        keys:        ['Ctrl+Plus', 'Ctrl+Minus'],
        scope:       'Selected widget',
    },
    {
        action:      'Move selected widget',
        description: 'Moves the selected widget by 2 px.',
        id:          'widget-move',
        keys:        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
        scope:       'Selected widget',
    },
    {
        action:      'Move selected widget faster',
        description: 'Moves the selected widget by 20 px.',
        id:          'widget-move-fast',
        keys:        ['Ctrl+ArrowUp', 'Ctrl+ArrowDown', 'Ctrl+ArrowLeft', 'Ctrl+ArrowRight'],
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
        action:      'Adjust RPM',
        description: 'Increase or decrease rotation speed by 0.1 RPM.',
        id:          'rotation-rpm-keyboard',
        keys:        ['Plus', 'Minus'],
        reference:   true,
        scope:       'Rotation mode',
    },
    {
        action:      'Adjust direction',
        description: 'Set clockwise or counterclockwise rotation.',
        id:          'rotation-direction-keyboard',
        keys:        ['ArrowLeft', 'ArrowRight'],
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
        action:      'Adjust height',
        description: 'Change the panorama camera altitude by 2 m.',
        id:          'panorama-height-keyboard',
        keys:        ['ArrowUp', 'ArrowDown'],
        reference:   true,
        scope:       'Panorama mode',
    },
    {
        action:      'Adjust height faster',
        description: 'Change the panorama camera altitude by 10 m.',
        id:          'panorama-height-keyboard-fast',
        keys:        ['Ctrl+ArrowUp', 'Ctrl+ArrowDown'],
        reference:   true,
        scope:       'Panorama mode',
    },
    {
        action:      'Adjust RPM',
        description: 'Increase or decrease panorama speed by 0.1 RPM.',
        id:          'panorama-rpm-keyboard',
        keys:        ['Plus', 'Minus'],
        reference:   true,
        scope:       'Panorama mode',
    },
    {
        action:      'Adjust direction',
        description: 'Set clockwise or counterclockwise panorama rotation.',
        id:          'panorama-direction-keyboard',
        keys:        ['ArrowLeft', 'ArrowRight'],
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
    'journey-import':       openJourneyImporter,
    'journey-toolbar-show': toggleJourneyToolbar,
    'wander-management-show': openWanderManagement,
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

    const removers = SHORTCUTS_CATALOG.filter(shortcut => SHORTCUT_ACTIONS[shortcut.id]).map(shortcut => {
        const action = SHORTCUT_ACTIONS[shortcut.id]

        return shortcutManager.addShortcut(APP_SHORTCUT_TARGET(), shortcut.keys, async (event) => {
            if (hasActiveAppShortcutBlocker()) {
                return
            }

            event.preventDefault()
            event.stopPropagation()
            event.stopImmediatePropagation?.()

            try {
                const handled = action?.(event)
                if (!handled) {
                    return
                }
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

    removers.push(installWidgetKeyboardShortcuts())
    return removers
}
