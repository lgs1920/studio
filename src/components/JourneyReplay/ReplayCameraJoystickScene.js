/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayCameraJoystickScene.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-29
 * Last modified: 2026-11-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight,
    EquirectangularReflectionMapping, ExtrudeGeometry, HemisphereLight, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
    MeshStandardMaterial, NoToneMapping, PCFSoftShadowMap, Path, PerspectiveCamera, RingGeometry, Scene, Shape, ShapeGeometry,
    SRGBColorSpace, WebGLRenderer,
} from 'three'

const DISH_RADIUS = 0.70
const GRIP_RING_INNER_RADIUS = DISH_RADIUS - 0.036
const GRIP_RING_OUTER_RADIUS = 0.788
const CROWN_INNER_RADIUS = 0.818
const CROWN_OUTER_RADIUS = 0.99
const CROWN_RADIUS = (CROWN_INNER_RADIUS + CROWN_OUTER_RADIUS) / 2
const CROWN_RECESS = 0.041
const ENGRAVING_DEPTH = 0.042
const GRIP_ENGRAVING_DEPTH = 0.052
const CROWN_EDGE_BEVEL_SIZE = 0.0025
const CROWN_EDGE_BEVEL_THICKNESS = 0.0025
const DOME_RECESS = CROWN_RECESS + 0.06
const DOME_HEIGHT = 0.19
const DOME_SPHERE_RADIUS = (DISH_RADIUS ** 2 + DOME_HEIGHT ** 2) / (2 * DOME_HEIGHT)
const DOME_EDGE_HEIGHT = Math.sqrt(DOME_SPHERE_RADIUS ** 2 - DISH_RADIUS ** 2)
const DOME_TRAVEL = 0.40
const CONTACT_SHADOW_INSET = 0.037
const CONTACT_SHADOW_OUTSET = 0.1
const CONTACT_WALL_WIDTH = 0.014
const MAP_EDGE_GLINT_OFFSET = CONTACT_SHADOW_OUTSET - 0.013
const KEY_LIGHT_X = -2.2
const KEY_LIGHT_Y = 2.8
const KEY_LIGHT_HORIZONTAL_LENGTH = Math.hypot(KEY_LIGHT_X, KEY_LIGHT_Y)
const REFLECTION_FRAME_INTERVAL_MS = 100
const ON_MAP_FALLBACK = 'var(--lgs-on-map-dark-color, var(--lgs-dark-color, var(--wa-color-brand, #273d35)))'

/** Flip sampled map imagery on both axes to match a convex mirrored surface. */
export const setJoystickMapReflectionTransform = (context, size) => context.setTransform(-1, 0, 0, -1, size, size)

/** Return how directly the edge faces the key light in the dial plane. */
const keyLightAlignment = (x, y, radius) => (x * KEY_LIGHT_X + y * KEY_LIGHT_Y)
    / (radius * KEY_LIGHT_HORIZONTAL_LENGTH)

/** Match the ball's on-map brightness at a point on its surface. */
const getDomeShade = (x, y) => 1.14 - 0.28 * Math.hypot(x, y) / DISH_RADIUS

/** Return the spherical cap height above the edge of the large on-map ball. */
const getDomeHeight = (x, y) => Math.sqrt(DOME_SPHERE_RADIUS ** 2 - x ** 2 - y ** 2) - DOME_EDGE_HEIGHT

/** Build the large rounded on-map ball with a spherical cap profile. */
export const createJoystickDomeGeometry = () => {
    const radialSteps = 36
    const radialSegments = 128
    const positions = [0, 0, DOME_HEIGHT]
    const indices = []

    for (let step = 1; step <= radialSteps; step++) {
        const ringRadius = DISH_RADIUS * step / radialSteps
        const surfaceHeight = Math.sqrt(DOME_SPHERE_RADIUS ** 2 - ringRadius ** 2) - DOME_EDGE_HEIGHT
        for (let segment = 0; segment < radialSegments; segment++) {
            const angle = segment * Math.PI * 2 / radialSegments
            positions.push(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, surfaceHeight)
        }
    }

    for (let segment = 0; segment < radialSegments; segment++) {
        const next = (segment + 1) % radialSegments
        indices.push(0, 1 + segment, 1 + next)
    }

    for (let step = 0; step < radialSteps - 1; step++) {
        const innerStart = 1 + step * radialSegments
        const outerStart = innerStart + radialSegments
        for (let segment = 0; segment < radialSegments; segment++) {
            const next = (segment + 1) % radialSegments
            const inner = innerStart + segment
            const innerNext = innerStart + next
            const outer = outerStart + segment
            const outerNext = outerStart + next
            indices.push(inner, outer, outerNext, inner, outerNext, innerNext)
        }
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(positions.length), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(positions.length / 3 * 2), 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    geometry.computeVertexNormals()
    setJoystickDomeTilt(geometry, 0, 0)
    return geometry
}

/** Preserve the contact shadow and catch light where the map starts to slope into the recess. */
export const createJoystickContactRingGeometry = () => {
    const geometry = new RingGeometry(CROWN_OUTER_RADIUS - CONTACT_SHADOW_INSET,
        CROWN_OUTER_RADIUS + CONTACT_SHADOW_OUTSET, 256, 24)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 4)

    for (let index = 0; index < positions.count; index++) {
        const x = positions.getX(index)
        const y = positions.getY(index)
        const radius = Math.hypot(x, y)
        const distance = radius - CROWN_OUTER_RADIUS
        const fade = Math.max(0, 1 - Math.abs(distance) / (distance < 0 ? CONTACT_SHADOW_INSET : CONTACT_SHADOW_OUTSET))
        const farSide = (1 + (y - 0.34 * x) / (1.06 * radius)) / 2
        const lightSide = keyLightAlignment(x, y, radius)
        const innerLight = Math.max(0, -lightSide) ** 2
        const wallShade = distance < 0 ? 1 - Math.min(1, innerLight * 1.6) : 1
        const shadow = fade ** 0.78 * (0.21 + 0.36 * farSide) * wallShade
        const wallHeight = Math.min(1, Math.max(0, distance / CONTACT_WALL_WIDTH)) * 0.075
        const mapGlint = 0.19 * Math.max(0, 1 - Math.abs(distance - MAP_EDGE_GLINT_OFFSET) / 0.011) ** 1.4
            * Math.max(0, lightSide) ** 4
        const innerBounce = 0.11 * Math.max(0, 1 - Math.abs(distance + 0.022) / 0.017)
        const innerGlint = 0.25 * Math.max(0, 1 - Math.abs(distance + 0.020) / 0.009) ** 2
        const glint = mapGlint + innerLight * (innerBounce + innerGlint)
        // Composite the small reflected highlight over the existing, unmodified shadow.
        const opacity = glint + shadow * (1 - glint)
        const brightness = opacity > 0 ? 0.78 * glint / opacity : 0
        positions.setZ(index, -CROWN_RECESS + 0.002 + wallHeight)
        colors.set([brightness, brightness, brightness, opacity], index * 4)
    }

    geometry.setAttribute('color', new BufferAttribute(colors, 4))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

/** Build a rectangular engraving aligned with the radius of a ring. */
const createRadialMark = (angle, radius, length, width) => {
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const mark = new Shape()
    mark.moveTo((radius - length) * cosine + width * sine, (radius - length) * sine - width * cosine)
    mark.lineTo((radius - length) * cosine - width * sine, (radius - length) * sine + width * cosine)
    mark.lineTo((radius + length) * cosine - width * sine, (radius + length) * sine + width * cosine)
    mark.lineTo((radius + length) * cosine + width * sine, (radius + length) * sine - width * cosine)
    mark.closePath()
    return mark
}

/** Define the outlines shared by the compass openings and their floors. */
const createCompassMarks = () => {
    const north = new Shape()
    north.moveTo(-0.064, CROWN_RADIUS - 0.041)
    north.lineTo(0, CROWN_RADIUS + 0.067)
    north.lineTo(0.064, CROWN_RADIUS - 0.041)
    north.closePath()
    const marks = [north]
    for (let index = 1; index < 8; index++) {
        const angle = Math.PI / 2 - index * Math.PI / 4
        const cardinal = index % 2 === 0
        marks.push(createRadialMark(angle, CROWN_RADIUS, cardinal ? 0.061 : 0.046, cardinal ? 0.027 : 0.021))
    }
    return marks
}

/** Give the grip repeated engravings with the same finish as the compass marks. */
export const createGripMarks = () => {
    const radius = (GRIP_RING_INNER_RADIUS + GRIP_RING_OUTER_RADIUS) / 2
    return Array.from({length: 32}, (_, index) => createRadialMark(index * Math.PI / 16, radius, 0.043, 0.012))
}

/** Cut recessed markings into a flat ring and use the same reflection coordinates on both crowns. */
const createEngravedRingGeometry = (innerRadius, outerRadius, marks, depth, bevel = null) => {
    const outline = new Shape()
    outline.absarc(0, 0, outerRadius, 0, Math.PI * 2, false)
    const center = new Path()
    center.absarc(0, 0, innerRadius, 0, Math.PI * 2, true)
    outline.holes.push(center, ...marks)
    const geometry = new ExtrudeGeometry(outline, {
        depth, bevelEnabled: Boolean(bevel), bevelSegments: 2,
        bevelSize: bevel?.size ?? 0, bevelThickness: bevel?.thickness ?? 0,
        curveSegments: 96,
    })
    geometry.translate(0, 0, -depth)
    const positions = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    for (let index = 0; index < positions.count; index++) {
        uv.setXY(index, 0.5 + 0.35 * positions.getX(index) / CROWN_OUTER_RADIUS,
            0.5 + 0.35 * positions.getY(index) / CROWN_OUTER_RADIUS)
    }
    return geometry
}

/** Build the inner rotating grip. */
export const createJoystickGripRingGeometry = (marks = createGripMarks()) =>
    createEngravedRingGeometry(GRIP_RING_INNER_RADIUS, GRIP_RING_OUTER_RADIUS, marks, GRIP_ENGRAVING_DEPTH)

/** Build the outer compass. */
export const createJoystickCrownGeometry = (marks = createCompassMarks()) =>
    createEngravedRingGeometry(CROWN_INNER_RADIUS, CROWN_OUTER_RADIUS, marks, ENGRAVING_DEPTH, {
        size: CROWN_EDGE_BEVEL_SIZE, thickness: CROWN_EDGE_BEVEL_THICKNESS,
    })

/** Add a recessed, shaded channel between the grip ring and the outer compass. */
export const createJoystickCrownSeparationGeometry = () => {
    const geometry = new RingGeometry(GRIP_RING_OUTER_RADIUS, CROWN_INNER_RADIUS, 192, 4)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 4)
    for (let index = 0; index < positions.count; index++) {
        const radius = Math.hypot(positions.getX(index), positions.getY(index))
        const progress = Math.min(1, Math.max(0,
            (radius - GRIP_RING_OUTER_RADIUS) / (CROWN_INNER_RADIUS - GRIP_RING_OUTER_RADIUS)))
        const shadow = 0.48 * Math.sin(Math.PI * progress) ** 1.5
        const highlight = 0.16 * Math.max(0, 1 - Math.abs(progress - 0.78) / 0.12)
        const alpha = Math.max(shadow, highlight)
        const brightness = alpha > 0 ? 0.52 * highlight / alpha : 0
        colors.set([brightness, brightness, brightness, alpha], index * 4)
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 4))
    return geometry
}

/** Create the opaque backing that prevents the map from showing through the crown channel. */
export const createJoystickCrownSeparationBaseMaterial = surfaceColor =>
    new MeshBasicMaterial({color: surfaceColor.clone().multiplyScalar(0.48)})

/** Create the shared, mostly opaque finish for the outer crown and inner grip ring. */
export const createJoystickCrownMaterial = (surfaceColor, highlightColor) =>
    new MeshStandardMaterial({
        color: surfaceColor.clone().lerp(highlightColor, 0.12),
        roughness: 0.76, metalness: 0.08, transparent: true, opacity: 0.9,
    })

/** Create the lightly matte, reflective finish for the joystick ball. */
export const createJoystickDomeMaterial = (color, reflectionTexture) =>
    new MeshPhysicalMaterial({
        color, roughness: 0.66, metalness: 0.12, vertexColors: true,
        envMap: reflectionTexture, envMapIntensity: 0.28, clearcoat: 0.1, clearcoatRoughness: 0.58,
    })

/** Add a subtle shadow directly over the bright lower-right edge of the outer crown. */
export const createJoystickCrownEdgeShadeGeometry = () =>
    new RingGeometry(CROWN_OUTER_RADIUS - 0.022, CROWN_OUTER_RADIUS, 48, 1, Math.PI * 1.5, Math.PI * 0.5)

/** Add a soft seam shadow with a lighter floor under the lower-right reflection. */
export const createDomeSeamGeometry = () => {
    const geometry = new RingGeometry(GRIP_RING_INNER_RADIUS - 0.025, GRIP_RING_INNER_RADIUS + 0.036, 192, 12)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 4)
    for (let index = 0; index < positions.count; index++) {
        const x = positions.getX(index)
        const y = positions.getY(index)
        const radius = Math.hypot(x, y)
        const distance = radius - GRIP_RING_INNER_RADIUS
        const fade = Math.max(0, 1 - Math.abs(distance) / (distance < 0 ? 0.025 : 0.036))
        const directionalShade = 0.36 + 0.22 * (y / radius + 1) / 2
        const innerLight = Math.max(0, -keyLightAlignment(x, y, radius)) ** 2
        const shadow = fade ** 1.4 * directionalShade * Math.max(0.20, 1 - innerLight * 1.6)
        colors.set([0, 0, 0, shadow], index * 4)
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 4))
    return geometry
}

/** Resolve a CSS color expression to an RGB value understood by Three.js. */
const readCssColor = (element, expression) => {
    const swatch = element.ownerDocument.createElement('span')
    swatch.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
    swatch.style.backgroundColor = expression
    element.appendChild(swatch)
    const cssColor = getComputedStyle(swatch).backgroundColor
    swatch.remove()
    const oklab = cssColor.match(/^oklab\(\s*([+-]?[\d.]+)%?\s+([+-]?[\d.]+)%?\s+([+-]?[\d.]+)%?/i)
    if (!oklab) return new Color().setStyle(cssColor, SRGBColorSpace)

    const channel = (value, scale) => Number(value.replace('%', '')) * (value.endsWith('%') ? scale : 1)
    const lightness = channel(oklab[1], 0.01)
    const a = channel(oklab[2], 0.004)
    const b = channel(oklab[3], 0.004)
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
    return new Color(
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    )
}

/** Resolve an on-map CSS color token to an RGB value understood by Three.js. */
const getOnMapColor = (element, token, fallback) => readCssColor(element, `var(${token}, ${fallback})`)

/** Reduce chroma without changing the color's relative luminance. */
const muteJoystickColor = (color, amount) => {
    const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
    return color.setRGB(
        color.r + (luminance - color.r) * amount,
        color.g + (luminance - color.g) * amount,
        color.b + (luminance - color.b) * amount,
    )
}

/** Read a muted version of the themed on-map surface. */
const getOnMapSurfaceColor = element => muteJoystickColor(
    getOnMapColor(element, '--lgs-card-on-map-bg-color', ON_MAP_FALLBACK), 0.42,
)

/** Keep the engravings legible against the translucent crown in either theme. */
const getCompassMarkColor = (element, surfaceColor) => surfaceColor.clone().lerp(
    getOnMapColor(element, '--lgs-on-map-text-color', 'var(--lgs-text-on-color)'), 0.26,
)

/** Blend and slightly darken the dome material tint. */
const getOnMapDomeColor = element => {
    const surfaceColor = getOnMapSurfaceColor(element)
    const brandColor = getOnMapColor(element, '--wa-color-brand', ON_MAP_FALLBACK)
    const seasonColor = getOnMapColor(element, '--lgs-season-accent-color', 'var(--wa-color-green-60, #67a50d)')
    return muteJoystickColor(surfaceColor.lerp(brandColor, 0.28).lerp(seasonColor, 0.22), 0.53).multiplyScalar(0.9)
}

/** Roll the surface finish around the smooth dome. */
export const setJoystickDomeTilt = (geometry, x, y) => {
    const positions = geometry.getAttribute('position')
    const colors = geometry.getAttribute('color')
    const uv = geometry.getAttribute('uv')
    const travel = Math.hypot(x, y)
    const travelX = travel ? x / travel : 0
    const travelY = travel ? y / travel : 0
    const sinTilt = Math.min(1, travel / DOME_SPHERE_RADIUS)
    const cosTilt = Math.sqrt(1 - sinTilt ** 2)
    const tiltFill = 0.11 * Math.min(1, travel / DOME_TRAVEL) ** 2
    for (let index = 0; index < positions.count; index++) {
        const vertexX = positions.getX(index)
        const vertexY = positions.getY(index)
        const baseHeight = getDomeHeight(vertexX, vertexY)
        // Sample the surface in its rotating frame while keeping the silhouette fixed.
        const alongTilt = vertexX * travelX + vertexY * travelY
        const localShift = alongTilt * (cosTilt - 1) - (baseHeight + DOME_EDGE_HEIGHT) * sinTilt
        const materialX = vertexX + travelX * localShift
        const materialY = vertexY + travelY * localShift
        const satinBand = (materialX - 0.55 * materialY + 0.10) / 0.19
        const finishShade = 0.96 + 0.09 * Math.exp(-(satinBand ** 2))
        const edgeWeight = (vertexX ** 2 + vertexY ** 2) / DISH_RADIUS ** 2
        const shade = getDomeShade(vertexX, vertexY) * finishShade + tiltFill * edgeWeight
        colors.setXYZ(index, shade, shade, shade)

        // Keep the live map mostly view-aligned while its glint shifts with the turn.
        const reflectedX = (vertexX + travelX * localShift * 0.55) / DISH_RADIUS
        const reflectedY = (vertexY + travelY * localShift * 0.55) / DISH_RADIUS
        const warp = 0.35 + 0.15 * (reflectedX ** 2 + reflectedY ** 2)
        uv.setXY(index, 0.5 + (reflectedX + 0.18 * reflectedY) * warp, 0.5 + 0.84 * reflectedY * warp)
    }
    colors.needsUpdate = true
    uv.needsUpdate = true
}

/** Create a brighter light from the on-map surface hue rather than a separate accent hue. */
const getOnMapHighlightColor = element => {
    const color = getOnMapSurfaceColor(element)
    return color.multiplyScalar(1 / Math.max(color.r, color.g, color.b, 0.001))
}

/** Create a small theme-derived reflection map for the joystick's polished surfaces. */
const createOnMapReflectionTexture = element => {
    const canvas = element.ownerDocument.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The joystick reflection canvas is unavailable')

    const texture = new CanvasTexture(canvas)
    texture.mapping = EquirectangularReflectionMapping
    texture.colorSpace = SRGBColorSpace
    const mapSample = element.ownerDocument.createElement('canvas')
    mapSample.width = 256
    mapSample.height = 256
    const sampleContext = mapSample.getContext('2d')
    const mapTexture = new CanvasTexture(mapSample)
    mapTexture.colorSpace = SRGBColorSpace

    /** Paint broad surface-colored bands that read as reflected map light on metal. */
    const update = (surfaceColor, highlightColor) => {
        const shadowColor = surfaceColor.clone().multiplyScalar(0.08)
        const reflectedColor = surfaceColor.clone().lerp(highlightColor, 0.48)
        const base = context.createLinearGradient(0, 0, 0, canvas.height)
        base.addColorStop(0, highlightColor.clone().multiplyScalar(0.32).getStyle(SRGBColorSpace))
        base.addColorStop(0.2, shadowColor.getStyle(SRGBColorSpace))
        base.addColorStop(0.58, surfaceColor.clone().multiplyScalar(0.2).getStyle(SRGBColorSpace))
        base.addColorStop(1, reflectedColor.clone().multiplyScalar(0.44).getStyle(SRGBColorSpace))
        context.fillStyle = base
        context.fillRect(0, 0, canvas.width, canvas.height)

        const band = context.createLinearGradient(0, 0, canvas.width, 0)
        band.addColorStop(0, shadowColor.getStyle(SRGBColorSpace))
        band.addColorStop(0.28, reflectedColor.getStyle(SRGBColorSpace))
        band.addColorStop(0.5, highlightColor.clone().multiplyScalar(0.64).getStyle(SRGBColorSpace))
        band.addColorStop(0.72, reflectedColor.getStyle(SRGBColorSpace))
        band.addColorStop(1, shadowColor.getStyle(SRGBColorSpace))
        context.globalAlpha = 0.38
        context.fillStyle = band
        context.fillRect(0, 38, canvas.width, 34)
        context.globalAlpha = 1
        texture.needsUpdate = true
        texture.needsPMREMUpdate = true
    }

    /** Copy the rendered Cesium frame while its drawing buffer is still available. */
    const captureMap = source => {
        if (!sampleContext || !source?.width || !source?.height) return false
        try {
            const size = mapSample.width
            const crop = Math.min(source.width, source.height) * 0.86
            sampleContext.clearRect(0, 0, size, size)
            setJoystickMapReflectionTransform(sampleContext, size)
            sampleContext.filter = 'saturate(0.34) contrast(1.12)'
            sampleContext.drawImage(source, (source.width - crop) / 2, (source.height - crop) / 2,
                crop, crop, 0, 0, size, size)
            sampleContext.filter = 'none'
            sampleContext.resetTransform()
            // Reading one pixel detects a canvas the browser will not allow Three.js to upload.
            if (!sampleContext.getImageData(size / 2, size / 2, 1, 1).data[3]) return false
            const mask = sampleContext.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
            mask.addColorStop(0, 'rgba(0, 0, 0, 0.50)')
            mask.addColorStop(0.55, 'black')
            mask.addColorStop(1, 'transparent')
            sampleContext.globalCompositeOperation = 'destination-in'
            sampleContext.fillStyle = mask
            sampleContext.fillRect(0, 0, size, size)
            const glint = sampleContext.createLinearGradient(0, size, size, 0)
            glint.addColorStop(0, 'rgba(0, 0, 0, 0.14)')
            glint.addColorStop(0.30, 'rgba(0, 0, 0, 0.29)')
            glint.addColorStop(0.62, 'black')
            glint.addColorStop(1, 'rgba(0, 0, 0, 0.18)')
            sampleContext.fillStyle = glint
            sampleContext.fillRect(0, 0, size, size)
            sampleContext.globalCompositeOperation = 'source-over'
            mapTexture.needsUpdate = true
            return true
        }
        catch {
            // Reset a tainted buffer so a later readable frame can be sampled.
            mapSample.width = 256
            return false
        }
    }

    return {texture, mapTexture, update, captureMap}
}

/** Render the large domed surface and its compass crown. */
export const createReplayCameraJoystickScene = ({canvas, padElement, mapScene, onContextLost, onContextRestored}) => {
    const renderer = new WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'})
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
    renderer.setClearColor(0, 0)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = NoToneMapping
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFSoftShadowMap

    const scene = new Scene()
    const camera = new PerspectiveCamera(32, 1, 0.1, 10)
    camera.position.set(0, -1.25, 4.2)
    camera.lookAt(0, 0, 0.1)
    const surfaceColor = getOnMapSurfaceColor(padElement)
    const domeColor = getOnMapDomeColor(padElement)
    const highlightColor = getOnMapHighlightColor(padElement)
    const shadowColor = surfaceColor.clone().multiplyScalar(0.65)
    const reflection = createOnMapReflectionTexture(padElement)
    reflection.update(surfaceColor, highlightColor)
    const hemisphereLight = new HemisphereLight(highlightColor, shadowColor, 0.72)
    const ambientLight = new AmbientLight(highlightColor, 0.38)
    scene.add(hemisphereLight, ambientLight)

    const keyLight = new DirectionalLight(highlightColor, 1.52)
    keyLight.position.set(KEY_LIGHT_X, KEY_LIGHT_Y, 3)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(512, 512)
    keyLight.shadow.camera.left = -1.5
    keyLight.shadow.camera.right = 1.5
    keyLight.shadow.camera.top = 1.5
    keyLight.shadow.camera.bottom = -1.5
    keyLight.shadow.camera.near = 0.1
    keyLight.shadow.camera.far = 8
    keyLight.shadow.camera.updateProjectionMatrix()
    keyLight.shadow.bias = -0.0005
    keyLight.shadow.intensity = 0.55
    scene.add(keyLight)
    const fillLight = new DirectionalLight(shadowColor, 0.25)
    fillLight.position.set(2, -1.5, 2.5)
    scene.add(fillLight)
    const domeGeometry = createJoystickDomeGeometry()
    const compassMarks = createCompassMarks()
    const crownGeometry = createJoystickCrownGeometry(compassMarks)
    const crownEdgeShadeGeometry = createJoystickCrownEdgeShadeGeometry()
    const crownSeparationGeometry = createJoystickCrownSeparationGeometry()
    const gripMarks = createGripMarks()
    const gripRingGeometry = createJoystickGripRingGeometry(gripMarks)
    const engravingFloorGeometry = new ShapeGeometry(compassMarks)
    const gripFloorGeometry = new ShapeGeometry(gripMarks)
    const contactRingGeometry = createJoystickContactRingGeometry()
    const domeSeamGeometry = createDomeSeamGeometry()
    const domeMaterial = createJoystickDomeMaterial(domeColor, reflection.texture)
    const crownMaterial = createJoystickCrownMaterial(surfaceColor, highlightColor)
    const engravingWallMaterial = new MeshStandardMaterial({color: surfaceColor.clone().multiplyScalar(0.47), roughness: 0.85})
    const engravingFloorMaterial = new MeshStandardMaterial({color: getCompassMarkColor(padElement, surfaceColor), roughness: 0.9})
    const contactRingMaterial = new MeshBasicMaterial({vertexColors: true, transparent: true, depthWrite: false})
    const dome = new Mesh(domeGeometry, domeMaterial)
    const mapMaterial = new MeshBasicMaterial({
        map: reflection.mapTexture, blending: AdditiveBlending, transparent: true, opacity: 0.40, depthWrite: false,
    })
    const mapReflection = new Mesh(domeGeometry, mapMaterial)
    mapReflection.visible = false
    mapReflection.renderOrder = 1
    const crownReflectionMaterial = new MeshBasicMaterial({
        map: reflection.mapTexture, blending: AdditiveBlending, transparent: true, opacity: 0.13, depthWrite: false,
    })
    const crownReflection = new Mesh(crownGeometry, crownReflectionMaterial)
    crownReflection.visible = false
    crownReflection.renderOrder = 1
    const crown = new Mesh(crownGeometry, [crownMaterial, engravingWallMaterial])
    const crownSeparationBaseMaterial = createJoystickCrownSeparationBaseMaterial(surfaceColor)
    const crownSeparationBase = new Mesh(crownSeparationGeometry, crownSeparationBaseMaterial)
    crownSeparationBase.position.z = -CROWN_RECESS - 0.0035
    crownSeparationBase.renderOrder = 1
    const crownSeparation = new Mesh(crownSeparationGeometry, new MeshBasicMaterial({
        vertexColors: true, transparent: true, depthWrite: false,
    }))
    crownSeparation.position.z = -CROWN_RECESS - 0.003
    crownSeparation.renderOrder = 2
    const crownEdgeShade = new Mesh(crownEdgeShadeGeometry, new MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false,
    }))
    crownEdgeShade.position.z = -CROWN_RECESS + 0.0005
    crownEdgeShade.renderOrder = 3
    const gripRing = new Mesh(gripRingGeometry, [crownMaterial, engravingWallMaterial])
    const gripReflection = new Mesh(gripRingGeometry, crownReflectionMaterial)
    gripRing.position.z = -CROWN_RECESS
    gripRing.receiveShadow = true
    gripReflection.position.z = -CROWN_RECESS
    gripReflection.visible = false
    gripReflection.renderOrder = 1
    const engravingFloor = new Mesh(engravingFloorGeometry, engravingFloorMaterial)
    const gripFloor = new Mesh(gripFloorGeometry, engravingFloorMaterial)
    crown.position.z = -CROWN_RECESS - CROWN_EDGE_BEVEL_THICKNESS
    crownReflection.position.z = -CROWN_RECESS - CROWN_EDGE_BEVEL_THICKNESS
    engravingFloor.position.z = -CROWN_RECESS - ENGRAVING_DEPTH
    engravingFloor.receiveShadow = true
    gripFloor.position.z = -CROWN_RECESS - GRIP_ENGRAVING_DEPTH
    gripFloor.receiveShadow = true
    crown.receiveShadow = true
    const contactRing = new Mesh(contactRingGeometry, contactRingMaterial)
    const domeSeam = new Mesh(domeSeamGeometry, contactRingMaterial)
    domeSeam.position.z = -CROWN_RECESS + 0.002
    domeSeam.renderOrder = 2
    dome.position.z = -DOME_RECESS
    mapReflection.position.z = -DOME_RECESS
    dome.castShadow = true
    dome.receiveShadow = true
    contactRing.renderOrder = 2
    scene.add(dome, mapReflection, gripRing, gripReflection, crown, crownReflection,
        crownSeparationBase, crownSeparation, crownEdgeShade, engravingFloor, gripFloor, domeSeam, contactRing)

    let disposed = false
    let contextLost = false

    /** Repaint only a live WebGL context; the scene has no autonomous animation loop. */
    const render = () => {
        if (disposed || contextLost) return
        renderer.render(scene, camera)
    }

    /** Follow CSS theme changes applied after the replay control has mounted. */
    const updateOnMapColor = () => {
        if (disposed) return
        const surfaceColor = getOnMapSurfaceColor(padElement)
        const domeColor = getOnMapDomeColor(padElement)
        const highlightColor = getOnMapHighlightColor(padElement)
        const shadowColor = surfaceColor.clone().multiplyScalar(0.65)
        domeMaterial.color.copy(domeColor)
        crownMaterial.color.copy(surfaceColor).lerp(highlightColor, 0.12)
        engravingWallMaterial.color.copy(surfaceColor).multiplyScalar(0.47)
        engravingFloorMaterial.color.copy(getCompassMarkColor(padElement, surfaceColor))
        reflection.update(surfaceColor, highlightColor)
        hemisphereLight.color.copy(highlightColor)
        hemisphereLight.groundColor.copy(shadowColor)
        ambientLight.color.copy(highlightColor)
        keyLight.color.copy(highlightColor)
        fillLight.color.copy(shadowColor)
        render()
    }

    let reflectionPending = true
    let mapMoving = false
    let lastReflectionTime = -Infinity
    /** Start sampling the rendered map during navigation. */
    const removeMapMoveStart = mapScene?.camera?.moveStart?.addEventListener(() => { mapMoving = true })
    /** Capture the final pose even if the last moving frame was recently sampled. */
    const removeMapMoveEnd = mapScene?.camera?.moveEnd?.addEventListener(() => {
        mapMoving = false
        reflectionPending = true
    })
    /** Share one bounded map snapshot between the dome and crown on Cesium frames. */
    const removeMapPostRender = mapScene?.postRender?.addEventListener(() => {
        if (disposed || contextLost) return
        const now = performance.now()
        if (!reflectionPending && (!mapMoving || now - lastReflectionTime < REFLECTION_FRAME_INTERVAL_MS)) return
        reflectionPending = false
        lastReflectionTime = now
        const wasVisible = mapReflection.visible
        mapReflection.visible = reflection.captureMap(mapScene.canvas)
        crownReflection.visible = mapReflection.visible
        gripReflection.visible = mapReflection.visible
        if (wasVisible || mapReflection.visible) render()
    })

    /** Match the widget size while keeping its framebuffer bounded. */
    const resize = () => {
        if (disposed) return
        // Use the unprojected layout so the 3D renderer is not squeezed a second time.
        const width = Math.max(1, padElement.clientWidth || 112)
        const height = Math.max(1, padElement.clientHeight || 112)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height, false)
        render()
    }

    /** Retain the DOM input fallback while a GPU context is unavailable. */
    const loseContext = event => {
        event.preventDefault()
        contextLost = true
        onContextLost?.()
    }

    /** Repaint the current dome position after Three.js restores its context. */
    const restoreContext = () => {
        contextLost = false
        render()
        onContextRestored?.()
    }

    canvas.addEventListener('webglcontextlost', loseContext)
    canvas.addEventListener('webglcontextrestored', restoreContext)
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    const themeObserver = typeof MutationObserver === 'function' ? new MutationObserver(updateOnMapColor) : null
    resizeObserver?.observe(padElement)
    themeObserver?.observe(padElement.ownerDocument.documentElement, {attributes: true, attributeFilter: ['class', 'data-season-theme', 'style']})
    themeObserver?.observe(padElement.ownerDocument.body, {attributes: true, attributeFilter: ['class', 'data-on-map-theme', 'style']})
    themeObserver?.observe(padElement, {attributes: true, attributeFilter: ['class', 'style']})
    window.addEventListener('resize', resize)

    /** Release every geometry, material, observer, listener, and GPU context owned by this scene. */
    const dispose = () => {
        if (disposed) return
        disposed = true
        removeMapMoveStart?.()
        removeMapMoveEnd?.()
        removeMapPostRender?.()
        resizeObserver?.disconnect()
        themeObserver?.disconnect()
        window.removeEventListener('resize', resize)
        canvas.removeEventListener('webglcontextlost', loseContext)
        canvas.removeEventListener('webglcontextrestored', restoreContext)
        domeGeometry.dispose()
        crownGeometry.dispose()
        crownEdgeShadeGeometry.dispose()
        crownSeparationGeometry.dispose()
        gripRingGeometry.dispose()
        engravingFloorGeometry.dispose()
        gripFloorGeometry.dispose()
        contactRingGeometry.dispose()
        domeSeamGeometry.dispose()
        domeMaterial.dispose()
        mapMaterial.dispose()
        crownMaterial.dispose()
        crownEdgeShade.material.dispose()
        crownSeparationBaseMaterial.dispose()
        crownSeparation.material.dispose()
        crownReflectionMaterial.dispose()
        engravingWallMaterial.dispose()
        engravingFloorMaterial.dispose()
        contactRingMaterial.dispose()
        keyLight.shadow.dispose()
        reflection.texture.dispose()
        reflection.mapTexture.dispose()
        renderer.dispose()
    }

    try {
        resize()
        mapScene?.requestRender?.()
    }
    catch (error) {
        dispose()
        throw error
    }

    return {
        /** Turn the grip and update the compass without rebuilding geometry. */
        setCrownAngle: angle => {
            if (disposed) return
            crown.rotation.z = -angle
            gripRing.rotation.z = -angle
            gripReflection.rotation.z = -angle
            crownReflection.rotation.z = -angle
            engravingFloor.rotation.z = -angle
            gripFloor.rotation.z = -angle
            render()
        },
        /** Roll the dome finish in the direction of the input. */
        setPosition: next => {
            if (disposed) return
            const x = next.x * DOME_TRAVEL
            const y = -next.y * DOME_TRAVEL
            setJoystickDomeTilt(domeGeometry, x, y)
            render()
        },
        dispose,
    }
}
