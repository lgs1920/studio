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
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, Group, HemisphereLight, Mesh,
    MeshStandardMaterial, NoToneMapping, PerspectiveCamera, Scene, SRGBColorSpace, TorusGeometry,
    WebGLRenderer,
} from 'three'

const CROWN_RADIUS = 1.02
const CROWN_TUBE_RADIUS = 0.09
const CROWN_VERTICAL_SCALE = 0.65
const CROWN_RIB_COUNT = 28
const DISH_RADIUS = 0.88
const DOME_HEIGHT = 0.26
const DOME_SPHERE_RADIUS = (DISH_RADIUS ** 2 + DOME_HEIGHT ** 2) / (2 * DOME_HEIGHT)
const DOME_EDGE_HEIGHT = Math.sqrt(DOME_SPHERE_RADIUS ** 2 - DISH_RADIUS ** 2)
const DISH_RIM_RADIUS = 0.86
const DISH_RIM_TUBE_RADIUS = 0.03
const CUVETTE_RADIUS = 0.30
const CUVETTE_DEPTH = 0.12
const CUVETTE_TRAVEL = 0.464
const ON_MAP_FALLBACK = 'var(--lgs-on-map-dark-color, var(--lgs-dark-color, var(--wa-color-brand, #273d35)))'

/** Return the spherical cap height above the edge of the large on-map ball. */
const getDomeHeight = (x, y) => Math.sqrt(DOME_SPHERE_RADIUS ** 2 - x ** 2 - y ** 2) - DOME_EDGE_HEIGHT

/** Build a concave on-map surface with real depth and smooth normals. */
const createConcaveGeometry = (radius, depth) => {
    const radialSteps = 24
    const radialSegments = 128
    const positions = [0, 0, -depth]
    const colors = [0.76, 0.76, 0.76]
    const indices = []

    for (let step = 1; step <= radialSteps; step++) {
        const ringRadius = radius * step / radialSteps
        const surfaceDepth = -depth * (1 - (ringRadius / radius) ** 2)
        const reliefShade = 0.7 + 0.36 * ringRadius / radius
        for (let segment = 0; segment < radialSegments; segment++) {
            const angle = segment * Math.PI * 2 / radialSegments
            positions.push(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, surfaceDepth)
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

/** Build the concave movable on-map cuvette. */
export const createJoystickCuvetteGeometry = () => createConcaveGeometry(CUVETTE_RADIUS, CUVETTE_DEPTH)

/** Keep the exported cavity geometry focused on the concave center cup. */
export const createJoystickCavityGeometry = () => createJoystickCuvetteGeometry()

/** Emboss narrow radial grooves into the crown instead of simulating them with flat color stripes. */
export const createJoystickCrownGeometry = () => {
    const geometry = new TorusGeometry(CROWN_RADIUS, CROWN_TUBE_RADIUS, 32, 512)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 3)
    const period = Math.PI * 2 / CROWN_RIB_COUNT
    const grooveHalfWidth = period * 0.15

    for (let index = 0; index < positions.count; index++) {
        const x = positions.getX(index)
        const y = positions.getY(index)
        const z = positions.getZ(index)
        const around = Math.atan2(y, x)
        const nearestRib = Math.round(around / period) * period
        const angleDelta = Math.atan2(Math.sin(around - nearestRib), Math.cos(around - nearestRib))
        const acrossTube = Math.max(0, Math.sin(Math.atan2(z, Math.hypot(x, y) - CROWN_RADIUS)))
        const groove = Math.exp(-((angleDelta / grooveHalfWidth) ** 2) * 2.1) * acrossTube ** 2
        const shoulder = Math.exp(-(((Math.abs(angleDelta) - grooveHalfWidth * 1.3) / (grooveHalfWidth * 0.55)) ** 2))
            * acrossTube ** 2
        const reliefShade = Math.max(0.82, Math.min(1.08, 1 - groove * 0.22 + shoulder * 0.1))
        colors.set([reliefShade, reliefShade, reliefShade], index * 3)
        positions.setZ(index, z * CROWN_VERTICAL_SCALE - groove * 0.015)
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

/** Keep the crown in the same on-map hue while lifting it slightly above the ball. */
const getCrownColor = element => getOnMapSurfaceColor(element).multiplyScalar(1.08)

/** Save original vertex heights before adapting the cuvette to the large dish. */
const captureBaseDepths = geometry => {
    const positions = geometry.getAttribute('position')
    const depths = new Float32Array(positions.count)
    for (let index = 0; index < positions.count; index++) depths[index] = positions.getZ(index)
    return depths
}

/** Warp a cuvette component to follow the large ball's spherical surface. */
const conformToDome = (geometry, baseDepths, x, y) => {
    const positions = geometry.getAttribute('position')
    const centerHeight = getDomeHeight(x, y)
    for (let index = 0; index < positions.count; index++) {
        const localX = positions.getX(index)
        const localY = positions.getY(index)
        const heightDelta = getDomeHeight(x + localX, y + localY) - centerHeight
        positions.setZ(index, baseDepths[index] + heightDelta)
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
}

/** Create a brighter light from the on-map surface hue rather than a separate accent hue. */
const getOnMapHighlightColor = element => {
    const color = getOnMapSurfaceColor(element)
    return color.multiplyScalar(1 / Math.max(color.r, color.g, color.b, 0.001))
}

/** Render the on-map cuvette and rounded ball inside the fixed themed crown. */
export const createReplayCameraJoystickScene = ({canvas, padElement, onContextLost, onContextRestored}) => {
    const renderer = new WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'})
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
    renderer.setClearColor(0, 0)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = NoToneMapping

    const scene = new Scene()
    const camera = new PerspectiveCamera(32, 1, 0.1, 10)
    camera.position.set(0, -1.25, 4.2)
    camera.lookAt(0, 0, 0.1)
    const surfaceColor = getOnMapSurfaceColor(padElement)
    const crownColor = getCrownColor(padElement)
    const highlightColor = getOnMapHighlightColor(padElement)
    const shadowColor = surfaceColor.clone().multiplyScalar(0.65)
    const hemisphereLight = new HemisphereLight(highlightColor, shadowColor, 0.72)
    const ambientLight = new AmbientLight(highlightColor, 0.38)
    scene.add(hemisphereLight, ambientLight)

    const keyLight = new DirectionalLight(highlightColor, 2.05)
    keyLight.position.set(-2.2, 2.8, 3)
    scene.add(keyLight)
    const fillLight = new DirectionalLight(shadowColor, 0.25)
    fillLight.position.set(2, -1.5, 2.5)
    scene.add(fillLight)

    const domeGeometry = createJoystickDomeGeometry()
    const cuvetteGeometry = createJoystickCuvetteGeometry()
    const crownGeometry = createJoystickCrownGeometry()
    const dishRimGeometry = new TorusGeometry(DISH_RIM_RADIUS, DISH_RIM_TUBE_RADIUS, 24, 256)
    const outerBeadGeometry = new TorusGeometry(CROWN_RADIUS + CROWN_TUBE_RADIUS - 0.005, 0.014, 16, 192)
    const domeMaterial = new MeshStandardMaterial({color: surfaceColor, roughness: 0.74, metalness: 0.05, vertexColors: true})
    const cuvetteMaterial = new MeshStandardMaterial({
        color: surfaceColor, roughness: 0.68, metalness: 0.06, vertexColors: true,
        transparent: true, depthWrite: false,
    })
    const dishRimMaterial = new MeshStandardMaterial({color: surfaceColor, roughness: 0.48, metalness: 0.08})
    const crownMaterial = new MeshStandardMaterial({color: crownColor, roughness: 0.42, metalness: 0.08, vertexColors: true})
    const outerBeadMaterial = new MeshStandardMaterial({color: crownColor, roughness: 0.46, metalness: 0.08})
    const dome = new Mesh(domeGeometry, domeMaterial)
    const dishRim = new Mesh(dishRimGeometry, dishRimMaterial)
    const crown = new Mesh(crownGeometry, crownMaterial)
    const outerBead = new Mesh(outerBeadGeometry, outerBeadMaterial)
    const cuvette = new Mesh(cuvetteGeometry, cuvetteMaterial)
    const cuvetteBaseDepths = captureBaseDepths(cuvetteGeometry)
    dishRim.position.z = 0.004
    outerBead.position.z = -0.003
    const crownAssembly = new Group()
    crownAssembly.add(crown, outerBead)
    const cuvetteAssembly = new Group()
    cuvetteAssembly.add(cuvette)
    scene.add(dome, dishRim, crownAssembly, cuvetteAssembly)

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
        const crownColor = getCrownColor(padElement)
        const highlightColor = getOnMapHighlightColor(padElement)
        const shadowColor = surfaceColor.clone().multiplyScalar(0.65)
        domeMaterial.color.copy(surfaceColor)
        cuvetteMaterial.color.copy(surfaceColor)
        dishRimMaterial.color.copy(surfaceColor)
        crownMaterial.color.copy(crownColor)
        outerBeadMaterial.color.copy(crownColor)
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
    themeObserver?.observe(padElement.ownerDocument.documentElement, {attributes: true, attributeFilter: ['class', 'style']})
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
        cuvetteGeometry.dispose()
        crownGeometry.dispose()
        dishRimGeometry.dispose()
        outerBeadGeometry.dispose()
        domeMaterial.dispose()
        cuvetteMaterial.dispose()
        dishRimMaterial.dispose()
        crownMaterial.dispose()
        outerBeadMaterial.dispose()
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
        /** Move the cuvette along the recessed disk while keeping the themed crown fixed around it. */
        setPosition: next => {
            if (disposed) return
            const x = next.x * CUVETTE_TRAVEL
            const y = -next.y * CUVETTE_TRAVEL
            const travel = Math.hypot(x, y)
            const domeHeight = getDomeHeight(x, y)
            cuvetteAssembly.position.set(x, y, domeHeight + CUVETTE_DEPTH + 0.006)
            conformToDome(cuvetteGeometry, cuvetteBaseDepths, x, y)
            const edgeGap = DISH_RADIUS - travel - CUVETTE_RADIUS
            cuvetteMaterial.opacity = 1 - Math.max(0, Math.min(1, (0.28 - edgeGap) / 0.2)) * 0.35
            render()
        },
        dispose,
    }
}
