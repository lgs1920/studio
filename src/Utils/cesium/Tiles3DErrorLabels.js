/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Tiles3DErrorLabels.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-13
 * Last modified on: 2026-07-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Cartesian2, Cartesian3, Color, HorizontalOrigin, LabelStyle, NearFarScalar, VerticalOrigin } from 'cesium'

const ERROR_LABEL_PREFIX = 'tiles3d-error-label'
const DEFAULT_ERROR_LABEL = '3D Tiles server error'
const DEFAULT_LABEL_HEIGHT = 120
const DANGER_BACKGROUND_TOKEN = '--wa-color-danger-fill-normal'
const DANGER_TEXT_TOKEN = '--wa-color-danger-on-normal'
const GUTTER_XS_TOKEN = '--lgs-gutter-xs'
const DEFAULT_DANGER_BACKGROUND = new Color(0.62, 0.05, 0.04, 0.86)
const DEFAULT_DANGER_TEXT = Color.WHITE
const DEFAULT_GUTTER_XS = 5
const LABEL_FONT = '14px sans-serif'
const WEB_MERCATOR_EARTH_CIRCUMFERENCE = 40075016.68557849

const safeId = value => `${value ?? 'unknown'}`.replace(/[^a-zA-Z0-9_-]/g, '-')

const hashText = value => {
    let hash = 0
    const text = `${value ?? ''}`
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
    }
    return Math.abs(hash).toString(36)
}

const cssColorToCesiumColor = (value, fallback) => {
    const color = `${value ?? ''}`.trim()
    if (!color) {
        return Color.clone(fallback)
    }

    try {
        return Color.fromCssColorString(color) ?? Color.clone(fallback)
    }
    catch {
        return Color.clone(fallback)
    }
}

export const themeColor = (token, fallback) => {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
        return Color.clone(fallback)
    }

    return cssColorToCesiumColor(getComputedStyle(document.documentElement).getPropertyValue(token), fallback)
}

const cssLengthToPixels = (value, fallback = DEFAULT_GUTTER_XS) => {
    const text = `${value ?? ''}`.trim()
    const numericValue = Number.parseFloat(text)
    if (!Number.isFinite(numericValue)) {
        return fallback
    }

    if (text.endsWith('rem')) {
        const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
        return numericValue * (Number.isFinite(rootFontSize) ? rootFontSize : 16)
    }
    if (text.endsWith('em')) {
        const fontSize = Number.parseFloat(getComputedStyle(document.body ?? document.documentElement).fontSize)
        return numericValue * (Number.isFinite(fontSize) ? fontSize : 16)
    }
    return numericValue
}

export const themePixels = (token, fallback = DEFAULT_GUTTER_XS) => {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
        return fallback
    }

    return cssLengthToPixels(getComputedStyle(document.documentElement).getPropertyValue(token), fallback)
}

const roundedRect = (context, x, y, width, height, radius) => {
    const safeRadius = Math.min(radius, width / 2, height / 2)
    context.beginPath()
    context.moveTo(x + safeRadius, y)
    context.arcTo(x + width, y, x + width, y + height, safeRadius)
    context.arcTo(x + width, y + height, x, y + height, safeRadius)
    context.arcTo(x, y + height, x, y, safeRadius)
    context.arcTo(x, y, x + width, y, safeRadius)
    context.closePath()
}

export const createRoundedLabelImage = ({text, backgroundColor, fillColor, padding, radius}) => {
    if (typeof document === 'undefined') {
        return null
    }

    const canvas = document.createElement('canvas')
    const context = canvas.getContext?.('2d')
    if (!context) {
        return null
    }

    const fontSize = 14
    context.font = LABEL_FONT
    const textWidth = Math.ceil(context.measureText(text).width)
    const width = Math.ceil(textWidth + padding * 2)
    const height = Math.ceil(fontSize + padding * 2)

    canvas.width = width
    canvas.height = height
    context.font = LABEL_FONT
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    roundedRect(context, 0, 0, width, height, radius)
    context.fillStyle = backgroundColor.toCssColorString()
    context.fill()
    context.fillStyle = fillColor.toCssColorString()
    context.fillText(text, width / 2, height / 2)

    return canvas.toDataURL('image/png')
}

export const parseSlippyTileContentUrl = (url) => {
    const match = `${url ?? ''}`.match(/\/(\d+)\/(\d+)\/(\d+)\.(?:glb|b3dm|i3dm|cmpt)(?:[?#].*)?$/i)
    if (!match) {
        return null
    }

    const [, level, x, y] = match.map(Number)
    if (![level, x, y].every(Number.isInteger)) {
        return null
    }

    return {level, x, y}
}

export const slippyTileCenterToDegrees = ({level, x, y}) => {
    const tileCount = 2 ** level
    const longitude = ((x + 0.5) / tileCount) * 360 - 180
    const mercatorLatitude = Math.PI * (1 - 2 * ((y + 0.5) / tileCount))
    const latitude = Math.atan(Math.sinh(mercatorLatitude)) * 180 / Math.PI

    return {longitude, latitude}
}

export const cameraHeightToSlippyLevel = (height) => {
    const cameraHeight = Number(height)
    if (!Number.isFinite(cameraHeight) || cameraHeight <= 0) {
        return null
    }

    return Math.max(0, Math.floor(Math.log2(WEB_MERCATOR_EARTH_CIRCUMFERENCE / cameraHeight)))
}

export const slippyTileParent = (tile, targetLevel) => {
    const level = Math.min(tile.level, Math.max(0, Number.isInteger(targetLevel) ? targetLevel : tile.level))
    if (level === tile.level) {
        return tile
    }

    const scale = 2 ** (tile.level - level)
    return {
        level,
        x: Math.floor(tile.x / scale),
        y: Math.floor(tile.y / scale),
    }
}

const isSameTileBranch = (left, right) => {
    const sharedLevel = Math.min(left.level, right.level)
    const leftParent = slippyTileParent(left, sharedLevel)
    const rightParent = slippyTileParent(right, sharedLevel)

    return leftParent.x === rightParent.x && leftParent.y === rightParent.y
}

const parseErrorLabelTile = (entityId, layerId) => {
    const prefix = `${ERROR_LABEL_PREFIX}-${safeId(layerId)}-`
    const id = `${entityId ?? ''}`
    if (!id.startsWith(prefix)) {
        return null
    }

    const match = id.slice(prefix.length).match(/^(\d+)-(\d+)-(\d+)$/)
    if (!match) {
        return null
    }

    const [, level, x, y] = match.map(Number)
    return {level, x, y}
}

const removeOverlappingTileLabels = (viewer, layerId, tile) => {
    if (!viewer?.entities?.values || !tile) {
        return
    }

    const labels = [...viewer.entities.values].filter(entity => {
        const existingTile = parseErrorLabelTile(entity.id, layerId)
        return existingTile && isSameTileBranch(existingTile, tile)
    })
    labels.forEach(entity => viewer.entities.remove(entity))
}

export const aggregateSlippyTileForCamera = (tile, cameraHeight, {minLevel = 0, perTileMaxHeight} = {}) => {
    const height = Number(cameraHeight)
    const maxPerTileHeight = Number(perTileMaxHeight)
    if (Number.isFinite(height) && Number.isFinite(maxPerTileHeight) && height <= maxPerTileHeight) {
        return tile
    }

    const cameraLevel = cameraHeightToSlippyLevel(cameraHeight)
    const safeMinLevel = Number.isInteger(minLevel) ? minLevel : 0
    const preferredLevel = cameraLevel === null ? tile.level : cameraLevel
    const targetLevel = Math.max(safeMinLevel, Math.min(tile.level, preferredLevel))
    return slippyTileParent(tile, targetLevel)
}

export const tiles3DErrorLabelText = layer =>
    layer?.tiles3d?.errorLabel
    ?? (layer?.providerName ? `${layer.providerName} server error` : DEFAULT_ERROR_LABEL)

export const addTiles3DErrorLabel = ({viewer, layer, error}) => {
    if (!viewer?.entities) {
        return null
    }

    const tile = parseSlippyTileContentUrl(error?.url)
    const configuredPosition = layer?.tiles3d?.errorLabelPosition
    if (!tile && !configuredPosition) {
        return null
    }

    const aggregateByCamera = layer?.tiles3d?.errorLabelAggregateByCamera !== false
    const minLevel = Number(layer?.tiles3d?.errorLabelMinLevel ?? 0)
    const perTileMaxHeight = Number(layer?.tiles3d?.errorLabelPerTileMaxHeight)
    const labelTile = tile && aggregateByCamera
        ? aggregateSlippyTileForCamera(tile, viewer.camera?.positionCartographic?.height, {
            minLevel:         Number.isInteger(minLevel) ? minLevel : 0,
            perTileMaxHeight: Number.isFinite(perTileMaxHeight) ? perTileMaxHeight : undefined,
        })
        : tile
    const tilePosition = labelTile ? slippyTileCenterToDegrees(labelTile) : null
    const longitude = Number(tilePosition?.longitude ?? configuredPosition?.longitude)
    const latitude = Number(tilePosition?.latitude ?? configuredPosition?.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
    }

    const tileKey = labelTile ? `${labelTile.level}-${labelTile.x}-${labelTile.y}` : hashText(error?.url ?? error?.message)
    const id = `${ERROR_LABEL_PREFIX}-${safeId(layer?.id)}-${tileKey}`
    const existing = viewer.entities.getById?.(id)
    if (existing) {
        return existing
    }
    removeOverlappingTileLabels(viewer, layer?.id, labelTile)

    const text = tiles3DErrorLabelText(layer)
    const height = Number(layer?.tiles3d?.errorLabelHeight ?? configuredPosition?.height ?? DEFAULT_LABEL_HEIGHT)
    const backgroundColor = themeColor(DANGER_BACKGROUND_TOKEN, DEFAULT_DANGER_BACKGROUND)
    const fillColor = themeColor(DANGER_TEXT_TOKEN, DEFAULT_DANGER_TEXT)
    const gutterXs = themePixels(GUTTER_XS_TOKEN, DEFAULT_GUTTER_XS)
    const image = createRoundedLabelImage({
                                              text,
                                              backgroundColor,
                                              fillColor,
                                              padding: gutterXs,
                                              radius:  gutterXs,
                                          })
    let errorMarker
    if (image) {
        errorMarker = {
            billboard: {
                image,
                horizontalOrigin:        HorizontalOrigin.CENTER,
                verticalOrigin:          VerticalOrigin.CENTER,
                pixelOffset:             new Cartesian2(0, -24),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance:         new NearFarScalar(500, 1, 100000, 0.65),
            },
        }
    }
    else {
        errorMarker = {
            label: {
                text,
                font:                    LABEL_FONT,
                fillColor,
                outlineWidth:            0,
                style:                   LabelStyle.FILL,
                showBackground:          true,
                backgroundColor,
                backgroundPadding:       new Cartesian2(gutterXs, gutterXs),
                horizontalOrigin:        HorizontalOrigin.CENTER,
                verticalOrigin:          VerticalOrigin.CENTER,
                pixelOffset:             new Cartesian2(0, -24),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance:         new NearFarScalar(500, 1, 100000, 0.65),
            },
        }
    }

    const entity = viewer.entities.add({
                                           id,
                                           name:     `${layer?.name ?? layer?.id ?? '3D Tiles'} error`,
                                           position: Cartesian3.fromDegrees(longitude, latitude, Number.isFinite(height) ? height : DEFAULT_LABEL_HEIGHT),
                                           ...errorMarker,
                                       })
    viewer.scene?.requestRender?.()
    return entity
}

export const removeTiles3DErrorLabels = (viewer, layerId) => {
    if (!viewer?.entities?.values) {
        return 0
    }

    const prefix = `${ERROR_LABEL_PREFIX}-${safeId(layerId)}-`
    const labels = [...viewer.entities.values].filter(entity => `${entity.id}`.startsWith(prefix))
    labels.forEach(entity => viewer.entities.remove(entity))
    if (labels.length > 0) {
        viewer.scene?.requestRender?.()
    }
    return labels.length
}
