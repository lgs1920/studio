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
 * Last modified: 2026-10-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight,
    EquirectangularReflectionMapping, Group, HemisphereLight, Mesh, MeshPhysicalMaterial,
    MeshStandardMaterial, NoToneMapping, PCFSoftShadowMap, PerspectiveCamera, RingGeometry, Scene,
    SRGBColorSpace, WebGLRenderer,
} from 'three'

const CROWN_RADIUS = 1.02
const CROWN_TUBE_RADIUS = 0.09
const CROWN_INNER_RADIUS = CROWN_RADIUS - CROWN_TUBE_RADIUS
const CROWN_OUTER_RADIUS = CROWN_RADIUS + CROWN_TUBE_RADIUS
const CROWN_CONCAVITY_DEPTH = 0.035
const DISH_RADIUS = 0.88
const DOME_HEIGHT = 0.30
const DOME_SPHERE_RADIUS = (DISH_RADIUS ** 2 + DOME_HEIGHT ** 2) / (2 * DOME_HEIGHT)
const DOME_EDGE_HEIGHT = Math.sqrt(DOME_SPHERE_RADIUS ** 2 - DISH_RADIUS ** 2)
const CUVETTE_RADIUS = 0.30
const CUVETTE_DEPTH = 0.08
const CUVETTE_BRIGHTNESS_FACTOR = 0.6
const CUVETTE_TRAVEL = 0.464
const SEAT_RING_WIDTH = 0.18
const SEAT_RING_DEPTH = 0.045
const SEAT_RING_OUTER_FADE_START = 0.68
const SEAT_RING_HIGHLIGHT_STRENGTH = 0.56
const CONTACT_RING_WIDTH = 0.054
const CONTACT_RING_DEPTH = 0.01
const CONTACT_RING_ALPHA = 0.8
const ON_MAP_FALLBACK = 'var(--lgs-on-map-dark-color, var(--lgs-dark-color, var(--wa-color-brand, #273d35)))'

/** Match the ball's on-map brightness at a point on its surface. */
const getDomeShade = (x, y) => 1.14 - 0.28 * Math.hypot(x, y) / DISH_RADIUS

/** Return the spherical cap height above the edge of the large on-map ball. */
const getDomeHeight = (x, y) => Math.sqrt(DOME_SPHERE_RADIUS ** 2 - x ** 2 - y ** 2) - DOME_EDGE_HEIGHT

/** Build a concave on-map surface with real depth and smooth normals. */
const createConcaveGeometry = (radius, depth) => {
    const radialSteps = 32
    const radialSegments = 128
    const positions = [0, 0, -depth]
    const colors = [CUVETTE_BRIGHTNESS_FACTOR, CUVETTE_BRIGHTNESS_FACTOR, CUVETTE_BRIGHTNESS_FACTOR]
    const indices = []

    for (let step = 1; step <= radialSteps; step++) {
        const ringRadius = radius * step / radialSteps
        const progress = ringRadius / radius
        const roundedProgress = progress ** 3 * (progress * (progress * 6 - 15) + 10)
        const surfaceDepth = -depth * (1 - roundedProgress)
        for (let segment = 0; segment < radialSegments; segment++) {
            const angle = segment * Math.PI * 2 / radialSegments
            positions.push(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, surfaceDepth)
            colors.push(CUVETTE_BRIGHTNESS_FACTOR, CUVETTE_BRIGHTNESS_FACTOR, CUVETTE_BRIGHTNESS_FACTOR)
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
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

/** Build the large rounded on-map ball with a spherical cap profile. */
export const createJoystickDomeGeometry = () => {
    const radialSteps = 24
    const radialSegments = 128
    const positions = [0, 0, DOME_HEIGHT]
    const colors = [1.14, 1.14, 1.14]
    const indices = []

    for (let step = 1; step <= radialSteps; step++) {
        const ringRadius = DISH_RADIUS * step / radialSteps
        const surfaceHeight = Math.sqrt(DOME_SPHERE_RADIUS ** 2 - ringRadius ** 2) - DOME_EDGE_HEIGHT
        const reliefShade = 1.14 - 0.28 * ringRadius / DISH_RADIUS
        for (let segment = 0; segment < radialSegments; segment++) {
            const angle = segment * Math.PI * 2 / radialSegments
            positions.push(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, surfaceHeight)
            colors.push(reliefShade, reliefShade, reliefShade)
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
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

/** Create a transparent seat with broad directional shadows and highlights. */
const createJoystickSeatGeometry = () => {
    const innerRadius = DISH_RADIUS
    const outerRadius = innerRadius + SEAT_RING_WIDTH
    const geometry = new RingGeometry(innerRadius, outerRadius, 256, 16)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 4)

    for (let index = 0; index < positions.count; index++) {
        const radius = Math.hypot(positions.getX(index), positions.getY(index))
        const progress = (radius - innerRadius) / SEAT_RING_WIDTH
        const groove = Math.sin(progress * Math.PI)
        const lightDirection = Math.atan2(positions.getY(index), positions.getX(index))
        const lightAlignment = Math.cos(lightDirection - Math.atan2(2.8, -2.2))
        const lightFacing = Math.max(0, lightAlignment)
        const shadowFacing = Math.max(0, -lightAlignment)
        const outerFadeProgress = Math.max(0, Math.min(1,
            (progress - SEAT_RING_OUTER_FADE_START) / (1 - SEAT_RING_OUTER_FADE_START)))
        const outerFade = 1 - outerFadeProgress ** 2 * (3 - 2 * outerFadeProgress)
        const highlight = lightFacing ** 0.9
            * Math.exp(-(((progress - 0.32) / 0.2) ** 2)) * SEAT_RING_HIGHLIGHT_STRENGTH * outerFade
        const shadow = shadowFacing ** 1.2
            * (0.1 + groove ** 1.4 * 0.72) * outerFade
        const isHighlight = highlight > shadow
        const opacity = Math.max(highlight, shadow)
        const shade = isHighlight ? 1 : 0
        positions.setZ(index, -0.003 * (1 - progress) - SEAT_RING_DEPTH * groove ** 2)
        colors.set([shade, shade, shade, opacity], index * 4)
    }

    positions.needsUpdate = true
    geometry.setAttribute('color', new BufferAttribute(colors, 4))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

/** Create a three-pixel recessed contact shadow around the ball. */
const createJoystickContactRingGeometry = () => {
    const innerRadius = DISH_RADIUS
    const geometry = new RingGeometry(innerRadius, innerRadius + CONTACT_RING_WIDTH, 256, 12)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 4)

    for (let index = 0; index < positions.count; index++) {
        const radius = Math.hypot(positions.getX(index), positions.getY(index))
        const progress = (radius - innerRadius) / CONTACT_RING_WIDTH
        const groove = Math.sin(progress * Math.PI)
        const edge = Math.abs(progress - 0.5) * 2
        const shade = 0.22 + edge * 0.3
        positions.setZ(index, -0.003 - CONTACT_RING_DEPTH * groove ** 2)
        colors.set([shade, shade, shade, CONTACT_RING_ALPHA], index * 4)
    }

    geometry.setAttribute('color', new BufferAttribute(colors, 4))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

/** Build the concave movable on-map cuvette. */
export const createJoystickCuvetteGeometry = () => createConcaveGeometry(CUVETTE_RADIUS, CUVETTE_DEPTH)

/** Keep the exported cavity geometry focused on the concave center cup. */
export const createJoystickCavityGeometry = () => createJoystickCuvetteGeometry()

/** Build a smooth concave band with a darker center channel and raised lips. */
export const createJoystickCrownGeometry = () => {
    const geometry = new RingGeometry(CROWN_INNER_RADIUS, CROWN_OUTER_RADIUS, 512, 12)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 3)
    const radialWidth = CROWN_OUTER_RADIUS - CROWN_INNER_RADIUS

    for (let index = 0; index < positions.count; index++) {
        const radius = Math.hypot(positions.getX(index), positions.getY(index))
        const acrossBand = (radius - CROWN_INNER_RADIUS) / radialWidth
        const edgeHeight = Math.abs(acrossBand * 2 - 1)
        const shade = 0.64 + 0.36 * edgeHeight
        positions.setZ(index, CROWN_CONCAVITY_DEPTH * edgeHeight ** 1.5)
        colors.set([shade, shade, shade], index * 3)
    }

    positions.needsUpdate = true
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
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

/** Read the exact on-map surface color used by the themed card. */
const getOnMapSurfaceColor = element => getOnMapColor(element, '--lgs-card-on-map-bg-color', ON_MAP_FALLBACK)

/** Blend and slightly darken the shared ball and cuvette material tint. */
const getOnMapDomeColor = element => {
    const surfaceColor = getOnMapSurfaceColor(element)
    const brandColor = getOnMapColor(element, '--wa-color-brand', ON_MAP_FALLBACK)
    const seasonColor = getOnMapColor(element, '--lgs-season-accent-color', 'var(--wa-color-green-60, #67a50d)')
    return surfaceColor.lerp(brandColor, 0.28).lerp(seasonColor, 0.22).multiplyScalar(0.9)
}

/** Save original vertex heights before adapting the cuvette to the large dish. */
const captureBaseDepths = geometry => {
    const positions = geometry.getAttribute('position')
    const depths = new Float32Array(positions.count)
    for (let index = 0; index < positions.count; index++) depths[index] = positions.getZ(index)
    return depths
}

/** Warp the cuvette to the ball and match its local on-map color brightness. */
const conformToDome = (geometry, baseDepths, x, y) => {
    const positions = geometry.getAttribute('position')
    const colors = geometry.getAttribute('color')
    const centerHeight = getDomeHeight(x, y)
    for (let index = 0; index < positions.count; index++) {
        const localX = positions.getX(index)
        const localY = positions.getY(index)
        const surfaceX = x + localX
        const surfaceY = y + localY
        const heightDelta = getDomeHeight(surfaceX, surfaceY) - centerHeight
        const shade = getDomeShade(surfaceX, surfaceY) * CUVETTE_BRIGHTNESS_FACTOR
        positions.setZ(index, baseDepths[index] + heightDelta)
        colors.setXYZ(index, shade, shade, shade)
    }
    positions.needsUpdate = true
    colors.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
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
    }

    return {texture, update}
}

/** Render the large domed surface and its softly rounded, theme-reflective cuvette. */
export const createReplayCameraJoystickScene = ({canvas, padElement, onContextLost, onContextRestored}) => {
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

    const keyLight = new DirectionalLight(highlightColor, 2.05)
    keyLight.position.set(-2.2, 2.8, 3)
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
    const seatAmbientLight = new AmbientLight(0xffffff, 0.32)
    seatAmbientLight.layers.set(1)
    const seatKeyLight = new DirectionalLight(0xffffff, 1.75)
    seatKeyLight.position.set(-2.2, 2.8, 3)
    seatKeyLight.layers.set(1)
    scene.add(seatAmbientLight, seatKeyLight)
    camera.layers.enable(1)

    const domeGeometry = createJoystickDomeGeometry()
    const seatGeometry = createJoystickSeatGeometry()
    const contactRingGeometry = createJoystickContactRingGeometry()
    const cuvetteGeometry = createJoystickCuvetteGeometry()
    const domeMaterial = new MeshStandardMaterial({color: domeColor, roughness: 0.74, metalness: 0.05, vertexColors: true})
    const seatMaterial = new MeshStandardMaterial({
        color: 0xffffff, vertexColors: true,
        roughness: 0.92, metalness: 0,
        transparent: true, depthWrite: false,
    })
    const contactRingMaterial = new MeshStandardMaterial({
        color: surfaceColor, roughness: 0.94, metalness: 0.02, vertexColors: true,
        transparent: true, depthWrite: false,
    })
    const cuvetteMaterial = new MeshPhysicalMaterial({
        color: domeColor, roughness: 0.56, metalness: 0.05, vertexColors: true,
        envMap: reflection.texture, envMapIntensity: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.34,
        transparent: true, depthTest: false, depthWrite: false,
    })
    const dome = new Mesh(domeGeometry, domeMaterial)
    const seat = new Mesh(seatGeometry, seatMaterial)
    seat.layers.set(1)
    const contactRing = new Mesh(contactRingGeometry, contactRingMaterial)
    const cuvette = new Mesh(cuvetteGeometry, cuvetteMaterial)
    const cuvetteBaseDepths = captureBaseDepths(cuvetteGeometry)
    const cuvetteAssembly = new Group()
    cuvetteAssembly.add(cuvette)
    dome.castShadow = true
    dome.receiveShadow = true
    seat.renderOrder = 1
    contactRing.receiveShadow = true
    contactRing.renderOrder = 2
    cuvette.castShadow = true
    cuvette.receiveShadow = true
    scene.add(dome, seat, contactRing, cuvetteAssembly)

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
        contactRingMaterial.color.copy(surfaceColor)
        cuvetteMaterial.color.copy(domeColor)
        reflection.update(surfaceColor, highlightColor)
        hemisphereLight.color.copy(highlightColor)
        hemisphereLight.groundColor.copy(shadowColor)
        ambientLight.color.copy(highlightColor)
        keyLight.color.copy(highlightColor)
        fillLight.color.copy(shadowColor)
        render()
    }

    /** Match the widget size while keeping its framebuffer bounded. */
    const resize = () => {
        if (disposed) return
        const bounds = padElement.getBoundingClientRect()
        const width = Math.max(1, bounds.width || 112)
        const height = Math.max(1, bounds.height || 112)
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

    /** Repaint the current cuvette position after Three.js restores its context. */
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
        resizeObserver?.disconnect()
        themeObserver?.disconnect()
        window.removeEventListener('resize', resize)
        canvas.removeEventListener('webglcontextlost', loseContext)
        canvas.removeEventListener('webglcontextrestored', restoreContext)
        domeGeometry.dispose()
        seatGeometry.dispose()
        contactRingGeometry.dispose()
        cuvetteGeometry.dispose()
        domeMaterial.dispose()
        seatMaterial.dispose()
        contactRingMaterial.dispose()
        cuvetteMaterial.dispose()
        reflection.texture.dispose()
        renderer.dispose()
    }

    try {
        resize()
    }
    catch (error) {
        dispose()
        throw error
    }

    return {
        /** Move the cuvette along the recessed disk while keeping the domed surface fixed. */
        setPosition: next => {
            if (disposed) return
            const x = next.x * CUVETTE_TRAVEL
            const y = -next.y * CUVETTE_TRAVEL
            const travel = Math.hypot(x, y)
            const domeHeight = getDomeHeight(x, y)
            cuvetteAssembly.position.set(x, y, domeHeight)
            conformToDome(cuvetteGeometry, cuvetteBaseDepths, x, y)
            const edgeGap = DISH_RADIUS - travel - CUVETTE_RADIUS
            cuvetteMaterial.opacity = 1 - Math.max(0, Math.min(1, (0.28 - edgeGap) / 0.2)) * 0.35
            render()
        },
        dispose,
    }
}
