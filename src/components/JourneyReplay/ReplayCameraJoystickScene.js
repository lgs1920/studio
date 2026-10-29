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
    AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, HemisphereLight, Mesh,
    MeshPhysicalMaterial, MeshStandardMaterial, NoToneMapping, OrthographicCamera, Scene,
    SphereGeometry, SRGBColorSpace, TorusGeometry, WebGLRenderer,
} from 'three'

const CROWN_RADIUS = 0.47
const CROWN_TUBE_RADIUS = 0.12
const CROWN_RIB_COUNT = 28
const CAVITY_RADIUS = CROWN_RADIUS - CROWN_TUBE_RADIUS + 0.004
const BALL_RADIUS = 0.27
const BALL_TRAVEL = 0.5104

/** Build the recessed center dish with real depth and smooth surface normals. */
export const createJoystickCavityGeometry = () => {
    const radialSteps = 24
    const radialSegments = 128
    const positions = [0, 0, -0.085]
    const indices = []

    for (let step = 1; step <= radialSteps; step++) {
        const radius = CAVITY_RADIUS * step / radialSteps
        const depth = -0.085 * (1 - (radius / CAVITY_RADIUS) ** 2)
        for (let segment = 0; segment < radialSegments; segment++) {
            const angle = segment * Math.PI * 2 / radialSegments
            positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, depth)
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
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

/** Emboss narrow radial grooves into the crown instead of simulating them with flat color stripes. */
export const createJoystickCrownGeometry = () => {
    const geometry = new TorusGeometry(CROWN_RADIUS, CROWN_TUBE_RADIUS, 32, 512)
    const positions = geometry.getAttribute('position')
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
        const groove = Math.exp(-((angleDelta / grooveHalfWidth) ** 2) * 1.8) * acrossTube ** 2
        positions.setZ(index, z - groove * 0.032)
    }

    positions.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
}

/** Resolve an on-map CSS color token to an RGB value understood by Three.js. */
const getOnMapColor = (element, token, fallback) => {
    const swatch = element.ownerDocument.createElement('span')
    swatch.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;background-color:var(${token}, ${fallback})`
    element.appendChild(swatch)
    const color = new Color().setStyle(getComputedStyle(swatch).backgroundColor, SRGBColorSpace)
    swatch.remove()
    return color
}

/** Own the joystick's transparent Three.js overlay and hardware-inspired physical controls. */
export const createReplayCameraJoystickScene = ({canvas, padElement, onContextLost, onContextRestored}) => {
    const renderer = new WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'})
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
    renderer.setClearColor(0, 0)
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = NoToneMapping

    const scene = new Scene()
    const camera = new OrthographicCamera(-1.16, 1.16, 1.16, -1.16, 0.1, 10)
    camera.position.z = 4
    scene.add(new HemisphereLight(0xf4f4f4, 0x202020, 0.95))
    scene.add(new AmbientLight(0xffffff, 0.5))

    const keyLight = new DirectionalLight(0xffffff, 2.4)
    keyLight.position.set(-1.8, 2.4, 3.5)
    scene.add(keyLight)
    const fillLight = new DirectionalLight(0xffffff, 0.65)
    fillLight.position.set(2, -1.5, 2.5)
    scene.add(fillLight)

    const cavityGeometry = createJoystickCavityGeometry()
    const crownGeometry = createJoystickCrownGeometry()
    const ballGeometry = new SphereGeometry(BALL_RADIUS, 64, 48)
    const innerBeadGeometry = new TorusGeometry(CAVITY_RADIUS - 0.006, 0.022, 20, 192)
    const outerBeadGeometry = new TorusGeometry(CROWN_RADIUS + CROWN_TUBE_RADIUS - 0.005, 0.014, 16, 192)
    const surfaceColor = getOnMapColor(padElement, '--lgs-card-on-map-bg-color', '#34383b')
    const borderColor = getOnMapColor(padElement, '--lgs-card-on-map-border-color', '#8a8a8a')
    const cavityMaterial = new MeshStandardMaterial({color: surfaceColor, roughness: 0.7, metalness: 0.08})
    const crownMaterial = new MeshStandardMaterial({color: borderColor, roughness: 0.52, metalness: 0.12})
    const innerBeadMaterial = new MeshStandardMaterial({color: borderColor, roughness: 0.52, metalness: 0.12})
    const outerBeadMaterial = new MeshStandardMaterial({color: borderColor, roughness: 0.46, metalness: 0.12})
    const ballMaterial = new MeshPhysicalMaterial({
        color: surfaceColor,
        roughness: 0.2,
        metalness: 0.1,
        clearcoat: 0.85,
        clearcoatRoughness: 0.17,
    })
    const cavity = new Mesh(cavityGeometry, cavityMaterial)
    const crown = new Mesh(crownGeometry, crownMaterial)
    const innerBead = new Mesh(innerBeadGeometry, innerBeadMaterial)
    const outerBead = new Mesh(outerBeadGeometry, outerBeadMaterial)
    const ball = new Mesh(ballGeometry, ballMaterial)
    innerBead.position.z = 0.008
    outerBead.position.z = -0.003
    ball.position.z = 0.13
    scene.add(cavity, innerBead, crown, outerBead, ball)

    let position = {x: 0, y: 0}
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
        cavityMaterial.color.copy(getOnMapColor(padElement, '--lgs-card-on-map-bg-color', '#34383b'))
        const borderColor = getOnMapColor(padElement, '--lgs-card-on-map-border-color', '#8a8a8a')
        crownMaterial.color.copy(borderColor)
        innerBeadMaterial.color.copy(borderColor)
        outerBeadMaterial.color.copy(borderColor)
        ballMaterial.color.copy(getOnMapColor(padElement, '--lgs-card-on-map-bg-color', '#34383b'))
        render()
    }

    /** Match the widget size while keeping its framebuffer bounded. */
    const resize = () => {
        if (disposed) return
        const bounds = padElement.getBoundingClientRect()
        renderer.setSize(Math.max(1, bounds.width || 112), Math.max(1, bounds.height || 112), false)
        render()
    }

    /** Retain the DOM input fallback while a GPU context is unavailable. */
    const loseContext = event => {
        event.preventDefault()
        contextLost = true
        onContextLost?.()
    }

    /** Repaint the current knob position after Three.js restores its context. */
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
        cavityGeometry.dispose()
        crownGeometry.dispose()
        ballGeometry.dispose()
        innerBeadGeometry.dispose()
        outerBeadGeometry.dispose()
        cavityMaterial.dispose()
        crownMaterial.dispose()
        innerBeadMaterial.dispose()
        outerBeadMaterial.dispose()
        ballMaterial.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
    }

    try {
        resize()
    }
    catch (error) {
        dispose()
        throw error
    }

    return {
        /** Move the shaded ball with the interactive thumb while the recessed dish and crown remain fixed. */
        setPosition: next => {
            if (disposed) return
            position = next
            const x = position.x * BALL_TRAVEL
            const y = -position.y * BALL_TRAVEL
            cavity.position.set(x, y, 0)
            crown.position.set(x, y, 0)
            innerBead.position.set(x, y, 0.008)
            outerBead.position.set(x, y, -0.003)
            ball.position.set(x, y, 0.13)
            render()
        },
        dispose,
    }
}
