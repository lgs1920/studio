/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeHeroRoute.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-13
 * Last modified: 2026-09-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef } from 'react'
import {
    getWelcomeRoutePoiScale,
    WELCOME_ROUTE_CAMERA_DISTANCE,
} from './welcomeHeroRouteProjection'

const ROUTE_POIS = [
    {index: 0, point: 0.25, label: 'Route point 01'},
    {index: 1, point: 0.5, label: 'Route point 02'},
    {index: 2, point: 0.75, label: 'Route point 03'},
]

const ROUTE_DURATION = 13_000
const ROUTE_PATH_SAMPLE_COUNT = 260
const ROUTE_DASH_SIZE = 0.16
const ROUTE_GAP_SIZE = 0.12
const ROUTE_LINE_WIDTH = 2.4
const TRAIL_PATH_SAMPLE_COUNT = 320
const ROUTE_TURNS = 2
const TRAIL_DURATION = 2_200
const TRAIL_LEAD_DURATION = 1_150
const NEON_OUTER_RADIUS = 0.09
const NEON_MIDDLE_RADIUS = 0.046
const NEON_CORE_RADIUS = 0.018
const ROUTE_EDGE_FADE_LENGTH = 0.14
const ROUTE_HEAD_MIN_OPACITY = 0.24
const ROUTE_SHAPE_STRETCH = 0.16
const ROUTE_SHAPE_SQUEEZE = 0.09
const ROUTE_SHAPE_CYCLE = 5_800
const ROUTE_MAX_PIXEL_RATIO = 1.35

const GLOW_VERTEX_SHADER = `
    attribute float aAlpha;
    uniform float uSize;
    varying float vAlpha;

    void main() {
        vAlpha = aAlpha;
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * (300.0 / max(1.0, -modelViewPosition.z));
        gl_Position = projectionMatrix * modelViewPosition;
    }
`

const GLOW_FRAGMENT_SHADER = `
    precision mediump float;

    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
        vec2 centeredPoint = gl_PointCoord - 0.5;
        float distanceFromCenter = length(centeredPoint);
        float softEdge = 1.0 - smoothstep(0.08, 0.5, distanceFromCenter);
        float brightCore = 1.0 - smoothstep(0.0, 0.18, distanceFromCenter);
        float alpha = vAlpha * (softEdge * 0.82 + brightCore * 0.36);

        if (alpha <= 0.005) {
            discard;
        }

        gl_FragColor = vec4(uColor, alpha);
    }
`

const NEON_VERTEX_SHADER = `
    varying float vRouteProgress;

    void main() {
        vRouteProgress = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

const NEON_FRAGMENT_SHADER = `
    precision mediump float;

    uniform vec3 uBaseColor;
    uniform vec3 uGlowColor;
    uniform float uGlowMix;
    uniform float uOpacity;
    uniform float uPastSpan;
    uniform float uFutureSpan;
    uniform float uProgress;
    varying float vRouteProgress;

    void main() {
        float offset = vRouteProgress - uProgress;
        float span = offset < 0.0 ? uPastSpan : uFutureSpan;
        float distanceFromMarker = abs(offset) / max(span, 0.0001);
        float normalizedFade = clamp(1.0 - distanceFromMarker, 0.0, 1.0);
        float fade = smoothstep(0.0, 1.0, normalizedFade);
        float colorFade = smoothstep(0.0, 1.0, normalizedFade) * uGlowMix;
        vec3 color = mix(uBaseColor, uGlowColor, colorFade);
        float alpha = fade * uOpacity;

        if (alpha <= 0.004) {
            discard;
        }

        gl_FragColor = vec4(color, alpha);
    }
`

const parseRgbColor = (value, fallback) => {
    const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)

    if (!match) {
        return fallback
    }

    return {
        r: Number(match[1]) / 255,
        g: Number(match[2]) / 255,
        b: Number(match[3]) / 255,
    }
}

/**
 * Composites a route POI at its projected canvas position without triggering layout.
 *
 * @param {HTMLElement | null} element - POI annotation element.
 * @param {number} left - Projected horizontal position in pixels.
 * @param {number} top - Projected vertical position in pixels.
 * @param {boolean} visible - Whether the projected point is inside the viewport.
 * @param {number} scale - Perspective scale based on the point depth.
 * @returns {void}
 */
const setPoiScreenPosition = (element, left, top, visible, scale) => {
    if (!element) {
        return
    }

    element.style.setProperty('--welcome-hero-poi-x', `${left}px`)
    element.style.setProperty('--welcome-hero-poi-y', `${top}px`)
    element.style.setProperty('--welcome-hero-poi-scale', scale.toFixed(3))
    element.style.visibility = visible ? 'visible' : 'hidden'
    element.classList.toggle('is-positioned', visible)
}

/**
 * Reads a CSS color from the hero so brand and season theme changes are reflected by the route.
 *
 * @param {HTMLElement} layer - Hero route layer.
 * @param {string} property - CSS custom property name.
 * @param {{r: number, g: number, b: number}} fallback - Fallback RGB color.
 * @returns {{r: number, g: number, b: number}} Normalized RGB color.
 */
const readThemeColor = (layer, property, fallback) => {
    const probe = document.createElement('span')
    probe.style.position = 'absolute'
    probe.style.color = `var(${property})`
    probe.style.visibility = 'hidden'
    layer.append(probe)

    const value = getComputedStyle(probe).color
    probe.remove()

    return parseRgbColor(value, fallback)
}

/**
 * Runs the route renderer in a dedicated worker when OffscreenCanvas is available.
 *
 * @param {HTMLElement} layer - Hero route layer.
 * @param {HTMLCanvasElement} canvas - WebGL canvas.
 * @param {() => void} [onError] - Callback used to start the main-thread fallback.
 * @returns {() => void} Cleanup callback.
 */
const setupRouteWorker = (layer, canvas, onError) => {
    const worker = new Worker(new URL('./WelcomeHeroRoute.worker.js', import.meta.url), {type: 'module'})
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const getPalette = () => ({
        glowColor: readThemeColor(layer, '--hero-route-glow-color', {r: 0.4, g: 0.65, b: 0.05}),
        routeColor: readThemeColor(layer, '--hero-route-path-color', {r: 0.25, g: 0.38, b: 0.07}),
    })
    const postResize = () => {
        const bounds = layer.getBoundingClientRect()

        if (!bounds.width || !bounds.height) {
            return
        }

        worker.postMessage({
            type: 'resize',
            width: bounds.width,
            height: bounds.height,
            pixelRatio: window.devicePixelRatio || 1,
        })
    }
    const postVisibility = () => {
        worker.postMessage({type: 'visibility', visible: !document.hidden})
    }
    const onWorkerMessage = ({data}) => {
        if (data.type === 'ready') {
            layer.dataset.routeStatus = 'ready'
            return
        }

        if (data.type === 'poi-positions') {
            data.positions.forEach(({index, left, scale, top, visible}) => {
                setPoiScreenPosition(
                    layer.querySelector(`[data-route-poi-index="${index}"]`),
                    left,
                    top,
                    visible,
                    scale,
                )
            })
            return
        }

        if (data.type !== 'poi') {
            return
        }

        const poi = layer.querySelector(`[data-route-poi-index="${data.index}"]`)
        poi?.classList.toggle('is-revealed', data.revealed)
    }
    const onWorkerError = (event) => {
        layer.dataset.routeError = 'worker'
        layer.dataset.routeStatus = 'error'
        console.error('[LGS1920][WelcomeRoute] worker failed', event.error ?? event.message ?? event)
        onError?.()
    }
    const offscreenCanvas = canvas.transferControlToOffscreen()
    const bounds = layer.getBoundingClientRect()
    const palette = getPalette()
    worker.addEventListener('message', onWorkerMessage)
    worker.addEventListener('error', onWorkerError)

    worker.postMessage({
        type: 'init',
        canvas: offscreenCanvas,
        height: bounds.height,
        pixelRatio: window.devicePixelRatio || 1,
        reducedMotion: reducedMotionQuery.matches,
        width: bounds.width,
        ...palette,
    }, [offscreenCanvas])

    const resizeObserver = new ResizeObserver(postResize)
    resizeObserver.observe(layer)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
        worker.postMessage({type: 'visibility', visible: entry.isIntersecting && !document.hidden})
    }, {threshold: 0.01})
    intersectionObserver.observe(layer)
    const paletteObserver = new MutationObserver(() => {
        layer.querySelectorAll('[data-route-poi]').forEach(poi => poi.classList.remove('is-revealed'))
        worker.postMessage({type: 'palette', ...getPalette()})
    })
    paletteObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-brand-color', 'data-season-theme']})
    document.addEventListener('visibilitychange', postVisibility)
    const onReducedMotionChange = (event) => {
        worker.postMessage({type: 'reduced-motion', value: event.matches})
    }
    reducedMotionQuery.addEventListener('change', onReducedMotionChange)
    layer.dataset.renderMode = 'worker'

    return () => {
        resizeObserver.disconnect()
        intersectionObserver.disconnect()
        paletteObserver.disconnect()
        document.removeEventListener('visibilitychange', postVisibility)
        worker.removeEventListener('message', onWorkerMessage)
        worker.removeEventListener('error', onWorkerError)
        reducedMotionQuery.removeEventListener('change', onReducedMotionChange)
        try {
            worker.postMessage({type: 'dispose'})
        }
        catch {
        }
        worker.terminate()
    }
}

/**
 * Creates the route animation and returns its complete cleanup function.
 *
 * @param {HTMLElement} layer - Hero route layer.
 * @param {HTMLCanvasElement} canvas - WebGL canvas.
 * @param {object} modules - Three.js modules.
 * @returns {() => void} Cleanup callback.
 */
const setupRouteAnimation = (layer, canvas, modules) => {
    const THREE = modules.three
    const {Line2} = modules.line2
    const {LineGeometry} = modules.lineGeometry
    const {LineMaterial} = modules.lineMaterial
    const root = document.documentElement
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const toThreeColor = ({r, g, b}) => new THREE.Color(r, g, b)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: 'low-power',
    })
    const sceneRoot = new THREE.Group()
    const routeEdges = ['left', 'right', 'top', 'bottom']
    const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum)
    let routeState = null
    let animationStartedAt = null
    let animationFrame = null
    let isVisible = true
    const dimensions = {width: 0, height: 0}
    const worldPosition = new THREE.Vector3()

    const createGlowMaterial = (color, size) => new THREE.ShaderMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fragmentShader: GLOW_FRAGMENT_SHADER,
        transparent: true,
        uniforms: {
            uColor: {value: toThreeColor(color)},
            uSize: {value: size},
        },
        vertexShader: GLOW_VERTEX_SHADER,
    })

    const createNeonMaterial = (baseColor, glowColor, opacity, glowMix) => new THREE.ShaderMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fragmentShader: NEON_FRAGMENT_SHADER,
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
        uniforms: {
            uBaseColor: {value: toThreeColor(baseColor)},
            uFutureSpan: {value: TRAIL_LEAD_DURATION / ROUTE_DURATION},
            uGlowColor: {value: toThreeColor(glowColor)},
            uGlowMix: {value: glowMix},
            uOpacity: {value: opacity},
            uPastSpan: {value: TRAIL_DURATION / ROUTE_DURATION},
            uProgress: {value: 0},
        },
        vertexShader: NEON_VERTEX_SHADER,
    })

    const getRouteNormal = (direction) => {
        const normal = new THREE.Vector3(-direction.y, direction.x, 0)

        if (normal.lengthSq() < 0.001) {
            normal.set(0, 1, 0)
        }

        return normal.normalize()
    }

    const createRouteState = () => {
        const routeColor = readThemeColor(layer, '--hero-route-path-color', {r: 0.25, g: 0.38, b: 0.07})
        const glowColor = readThemeColor(layer, '--hero-route-glow-color', {r: 0.4, g: 0.65, b: 0.05})
        const routeGroup = new THREE.Group()
        const entryEdge = routeEdges[Math.floor(Math.random() * routeEdges.length)]
        let exitEdge = routeEdges[Math.floor(Math.random() * routeEdges.length)]

        while (exitEdge === entryEdge) {
            exitEdge = routeEdges[Math.floor(Math.random() * routeEdges.length)]
        }

        const createEdgePoint = (edge, depth) => {
            const z = depth === 'entry'
                ? randomBetween(2.25, 3.25)
                : randomBetween(-4.2, -2.65)

            if (edge === 'left') {
                return new THREE.Vector3(-4.45, randomBetween(-2.35, 2.35), z)
            }

            if (edge === 'right') {
                return new THREE.Vector3(4.45, randomBetween(-2.35, 2.35), z)
            }

            if (edge === 'top') {
                return new THREE.Vector3(randomBetween(-3.25, 3.25), 2.95, z)
            }

            return new THREE.Vector3(randomBetween(-3.25, 3.25), -2.95, z)
        }

        const entryPoint = createEdgePoint(entryEdge, 'entry')
        const exitPoint = createEdgePoint(exitEdge, 'exit')
        const spiralCenter = new THREE.Vector3(
            randomBetween(-0.45, 0.45),
            randomBetween(-0.25, 0.35),
            randomBetween(0.15, 0.55),
        )
        const routeStartAngle = randomBetween(0, Math.PI * 2)
        const spiralDirection = Math.random() < 0.5 ? -1 : 1
        const spiralRadiusX = randomBetween(2.25, 2.75)
        const spiralRadiusY = randomBetween(1.45, 1.9)
        const spiralHeight = randomBetween(5.55, 6.25)
        const spiralTop = randomBetween(2.35, 2.9)
        const spiralControlPointCount = 66
        const getSpiralPoint = (progress) => {
            const angle = routeStartAngle + progress * Math.PI * 2 * ROUTE_TURNS * spiralDirection
            const radiusX = 0.18 + progress * spiralRadiusX
            const radiusY = 0.12 + progress * spiralRadiusY

            return new THREE.Vector3(
                spiralCenter.x + Math.cos(angle) * radiusX,
                spiralCenter.y + Math.sin(angle) * radiusY,
                spiralCenter.z + spiralTop - progress * spiralHeight + Math.sin(angle * 0.5) * 0.24,
            )
        }
        const spiralPoints = Array.from({length: spiralControlPointCount}, (_, index) => getSpiralPoint(index / (spiralControlPointCount - 1)))
        const spiralStartTangent = new THREE.Vector3().subVectors(spiralPoints[1], spiralPoints[0]).normalize()
        const spiralEndTangent = new THREE.Vector3().subVectors(spiralPoints.at(-1), spiralPoints.at(-2)).normalize()
        const entryApproach = spiralPoints[0].clone().sub(spiralStartTangent.clone().multiplyScalar(randomBetween(0.78, 1.12)))
        const entryDirection = new THREE.Vector3().subVectors(entryApproach, entryPoint).normalize()
        const entryNormal = getRouteNormal(entryDirection)
        const entryBend = entryPoint.clone().lerp(entryApproach, randomBetween(0.34, 0.52)).add(entryNormal.clone().multiplyScalar(randomBetween(0.95, 1.4)))
        entryBend.z += randomBetween(-0.3, 0.35)
        const entrySway = entryPoint.clone().lerp(entryApproach, randomBetween(0.62, 0.74)).add(entryNormal.clone().multiplyScalar(randomBetween(-0.55, -0.85)))
        entrySway.z += randomBetween(-0.22, 0.22)
        const exitDeparture = spiralPoints.at(-1).clone().add(spiralEndTangent.clone().multiplyScalar(randomBetween(0.82, 1.18)))
        const exitDirection = new THREE.Vector3().subVectors(exitPoint, exitDeparture).normalize()
        const exitNormal = getRouteNormal(exitDirection)
        const exitBend = exitDeparture.clone().lerp(exitPoint, randomBetween(0.42, 0.62)).add(exitNormal.clone().multiplyScalar(randomBetween(-1.2, -0.65)))
        exitBend.z += randomBetween(-0.35, 0.3)
        const exitSway = exitDeparture.clone().lerp(exitPoint, randomBetween(0.7, 0.8)).add(exitNormal.clone().multiplyScalar(randomBetween(0.45, 0.8)))
        exitSway.z += randomBetween(-0.2, 0.2)
        const routeCurve = new THREE.CatmullRomCurve3([
            entryPoint, entryBend, entrySway, entryApproach, ...spiralPoints,
            exitDeparture, exitBend, exitSway, exitPoint,
        ], false, 'centripetal', 0.28)
        const routePathPoints = routeCurve.getSpacedPoints(ROUTE_PATH_SAMPLE_COUNT)
        const routePositions = new Float32Array(routePathPoints.length * 3)

        routePathPoints.forEach((point, index) => {
            routePositions[index * 3] = point.x
            routePositions[index * 3 + 1] = point.y
            routePositions[index * 3 + 2] = point.z
        })

        const routeGeometry = new LineGeometry()
        routeGeometry.setPositions(routePositions)
        const routeMaterial = new LineMaterial({
            alphaToCoverage: true,
            color: toThreeColor(routeColor),
            dashed: true,
            dashSize: ROUTE_DASH_SIZE,
            depthWrite: false,
            gapSize: ROUTE_GAP_SIZE,
            linewidth: ROUTE_LINE_WIDTH,
            opacity: 0.96,
            transparent: true,
        })
        routeMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uRouteLength = {value: routeCurve.getLength()}
            shader.fragmentShader = shader.fragmentShader.replace('uniform float linewidth;', 'uniform float linewidth;\n\t\tuniform float uRouteLength;')
            shader.fragmentShader = shader.fragmentShader.replace(
                'float alpha = opacity;',
                `float routeProgress = clamp(vLineDistance / max(uRouteLength, 0.0001), 0.0, 1.0);
                float routeStartFade = smoothstep(0.0, ${ROUTE_EDGE_FADE_LENGTH}, routeProgress);
                float routeEndFade = smoothstep(0.0, ${ROUTE_EDGE_FADE_LENGTH}, 1.0 - routeProgress);
                float routeEdgeFade = min(routeStartFade, routeEndFade);
                float edgeOpacity = mix(${ROUTE_HEAD_MIN_OPACITY}, 1.0, routeEdgeFade);
                float alpha = opacity * edgeOpacity;`,
            )
        }
        const routeLine = new Line2(routeGeometry, routeMaterial)
        routeLine.computeLineDistances()
        routeLine.frustumCulled = false
        routeLine.renderOrder = 4
        const neonMaterials = [
            createNeonMaterial(routeColor, glowColor, 0.1, 0.5),
            createNeonMaterial(routeColor, glowColor, 0.2, 0.78),
            createNeonMaterial(routeColor, glowColor, 0.72, 1),
        ]
        const neonOuter = new THREE.Mesh(new THREE.TubeGeometry(routeCurve, TRAIL_PATH_SAMPLE_COUNT, NEON_OUTER_RADIUS, 8, false), neonMaterials[0])
        const neonMiddle = new THREE.Mesh(new THREE.TubeGeometry(routeCurve, TRAIL_PATH_SAMPLE_COUNT, NEON_MIDDLE_RADIUS, 8, false), neonMaterials[1])
        const neonCore = new THREE.Mesh(new THREE.TubeGeometry(routeCurve, TRAIL_PATH_SAMPLE_COUNT, NEON_CORE_RADIUS, 6, false), neonMaterials[2])
        const neonMeshes = [neonOuter, neonMiddle, neonCore]
        neonMeshes.forEach((mesh, index) => {
            mesh.frustumCulled = false
            mesh.renderOrder = index + 1
        })
        const markerGeometry = new THREE.BufferGeometry()
        markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3), 3))
        markerGeometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(new Float32Array([1]), 1))
        const markerMaterial = createGlowMaterial(glowColor, 1.55)
        const marker = new THREE.Points(markerGeometry, markerMaterial)
        marker.renderOrder = 5
        routeGroup.add(neonOuter, neonMiddle, neonCore, routeLine, marker)
        sceneRoot.add(routeGroup)

        return {
            marker,
            markerMaterial,
            neonMaterials,
            poiItems: ROUTE_POIS.map(({index, point}) => ({
                element: layer.querySelector(`[data-route-poi-index="${index}"]`),
                position: routeCurve.getPointAt(point),
            })),
            routeCurve,
            routeGroup,
            routeMaterial,
        }
    }

    const disposeRouteState = () => {
        if (!routeState) {
            return
        }

        sceneRoot.remove(routeState.routeGroup)
        routeState.routeGroup.traverse(object => {
            object.geometry?.dispose()
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            materials.filter(Boolean).forEach(material => material.dispose())
        })
        routeState = null
    }

    const rebuildRoute = () => {
        const nextRouteState = createRouteState()
        disposeRouteState()
        routeState = nextRouteState
        animationStartedAt = null
    }

    const resize = () => {
        const bounds = layer.getBoundingClientRect()

        if (!bounds.width || !bounds.height) {
            return
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ROUTE_MAX_PIXEL_RATIO))
        renderer.setSize(bounds.width, bounds.height, false)
        dimensions.width = bounds.width
        dimensions.height = bounds.height
        routeState?.routeMaterial.resolution.set(bounds.width, bounds.height)
        camera.aspect = bounds.width / bounds.height
        camera.updateProjectionMatrix()
        const aspect = bounds.width / bounds.height
        const isMobile = bounds.width < 720
        const routeScale = isMobile
            ? Math.max(0.36, Math.min(0.5, aspect * 0.58))
            : Math.max(0.54, Math.min(0.72, aspect * 0.46))
        sceneRoot.scale.set(routeScale, routeScale, routeScale)
        sceneRoot.position.x = isMobile ? 0 : 1.35
        sceneRoot.position.y = isMobile ? -1.5 : 0.05
        sceneRoot.updateMatrixWorld(true)
    }

    const render = (timestamp = 0) => {
        if (!routeState) {
            return
        }

        if (animationStartedAt === null && timestamp > 0) {
            animationStartedAt = timestamp
        }

        const elapsed = animationStartedAt === null ? 0 : (timestamp - animationStartedAt) % ROUTE_DURATION
        const progress = reducedMotionQuery.matches ? 1 : Math.max(0, Math.min(1, elapsed / ROUTE_DURATION))
        routeState.neonMaterials.forEach(material => {
            material.uniforms.uProgress.value = progress
        })
        routeState.routeCurve.getPointAt(progress, routeState.marker.position)
        routeState.markerMaterial.uniforms.uSize.value = reducedMotionQuery.matches
            ? 1.55
            : 1.55 + Math.sin(timestamp * 0.008) * 0.1
        sceneRoot.rotation.x = reducedMotionQuery.matches ? 0.42 : 0.46 + Math.sin(timestamp * 0.00025) * 0.18
        sceneRoot.rotation.y = reducedMotionQuery.matches ? -0.62 : Math.sin(timestamp * 0.00032) * 0.68
        sceneRoot.rotation.z = reducedMotionQuery.matches ? 0.06 : Math.sin(timestamp * 0.00023) * 0.1
        const shapeWave = Math.sin(timestamp / ROUTE_SHAPE_CYCLE * Math.PI * 2)
        routeState.routeGroup.scale.set(
            reducedMotionQuery.matches ? 1 : 1 + shapeWave * ROUTE_SHAPE_STRETCH,
            reducedMotionQuery.matches ? 1 : 1 - shapeWave * ROUTE_SHAPE_SQUEEZE,
            1,
        )
        sceneRoot.updateMatrixWorld(true)
        routeState.poiItems.forEach(({element, position}) => {
            if (!element || !dimensions.width || !dimensions.height) {
                return
            }

            worldPosition.copy(position)
            routeState.routeGroup.localToWorld(worldPosition)
            const depthScale = getWelcomeRoutePoiScale(camera.position.z - worldPosition.z)
            worldPosition.project(camera)
            const visible = worldPosition.z > -1
                && worldPosition.z < 1
                && worldPosition.x > -1.15
                && worldPosition.x < 1.15
                && worldPosition.y > -1.15
                && worldPosition.y < 1.15
            setPoiScreenPosition(
                element,
                (worldPosition.x * 0.5 + 0.5) * dimensions.width,
                (-worldPosition.y * 0.5 + 0.5) * dimensions.height,
                visible,
                depthScale,
            )
        })
        renderer.render(scene, camera)
    }

    const draw = (timestamp) => {
        animationFrame = null

        if (!isVisible || document.hidden) {
            return
        }

        render(timestamp)

        if (!reducedMotionQuery.matches) {
            animationFrame = window.requestAnimationFrame(draw)
        }
    }

    const restart = () => {
        if (reducedMotionQuery.matches) {
            render(0)
            return
        }

        if (animationFrame === null && isVisible && !document.hidden) {
            animationFrame = window.requestAnimationFrame(draw)
        }
    }

    const applyPalette = () => {
        if (!routeState) {
            return
        }

        const routeColor = readThemeColor(layer, '--hero-route-path-color', {r: 0.25, g: 0.38, b: 0.07})
        const glowColor = readThemeColor(layer, '--hero-route-glow-color', {r: 0.4, g: 0.65, b: 0.05})
        routeState.routeMaterial.color.copy(toThreeColor(routeColor))
        routeState.neonMaterials.forEach(material => {
            material.uniforms.uBaseColor.value.copy(toThreeColor(routeColor))
            material.uniforms.uGlowColor.value.copy(toThreeColor(glowColor))
        })
        routeState.markerMaterial.uniforms.uColor.value.copy(toThreeColor(glowColor))
    }

    scene.add(sceneRoot)
    camera.position.set(0, 0, WELCOME_ROUTE_CAMERA_DISTANCE)
    camera.lookAt(0, 0, 0)
    rebuildRoute()
    resize()

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(layer)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting
        if (isVisible) {
            restart()
        }
    }, {threshold: 0.01})
    intersectionObserver.observe(layer)
    const paletteObserver = new MutationObserver(() => {
        applyPalette()
        render(0)
    })
    paletteObserver.observe(root, {attributes: true, attributeFilter: ['data-brand-color', 'data-season-theme']})
    document.addEventListener('visibilitychange', restart)
    reducedMotionQuery.addEventListener('change', restart)
    restart()

    return () => {
        if (animationFrame !== null) {
            window.cancelAnimationFrame(animationFrame)
        }

        resizeObserver.disconnect()
        intersectionObserver.disconnect()
        paletteObserver.disconnect()
        document.removeEventListener('visibilitychange', restart)
        reducedMotionQuery.removeEventListener('change', restart)
        disposeRouteState()
        renderer.dispose()
        renderer.forceContextLoss?.()
    }
}

/**
 * Renders the persistent Three.js route backdrop used by the Studio welcome hero.
 *
 * @param {{mountInSplash?: boolean, useWorker?: boolean}} props - Route mounting options.
 * @returns {JSX.Element} Decorative route canvas.
 */
export const WelcomeHeroRoute = ({mountInSplash = false, useWorker = true}) => {
    const suppressRoute = mountInSplash
        && typeof document !== 'undefined'
        && Boolean(document.querySelector('[data-lgs-boot-route-host]'))
    const _canvas = useRef(null)

    useLayoutEffect(() => {
        let disposed = false
        let cleanup = () => {}
        const layer = _canvas.current?.parentElement
        const canvas = _canvas.current

        if (!layer || !canvas) {
            return undefined
        }

        if (typeof window.WebGLRenderingContext === 'undefined') {
            layer.dataset.routeError = 'webgl-unavailable'
            layer.dataset.routeStatus = 'error'
            console.warn('[LGS1920][WelcomeRoute] WebGL is unavailable in the splash')
            return undefined
        }

        const initialize = async () => {
            const loadThreeModules = () => Promise.all([
                import('three'),
                import('three/addons/lines/Line2.js'),
                import('three/addons/lines/LineGeometry.js'),
                import('three/addons/lines/LineMaterial.js'),
            ]).then(([three, line2, lineGeometry, lineMaterial]) => ({
                line2,
                lineGeometry,
                lineMaterial,
                three,
            }))
            const initializeFallback = async (fallbackCanvas) => {
                const modules = await loadThreeModules()
                if (disposed) {
                    return
                }

                cleanup = setupRouteAnimation(layer, fallbackCanvas, modules)
                delete layer.dataset.routeError
                layer.dataset.renderMode = 'fallback'
                layer.dataset.routeStatus = 'ready'
                console.info('[LGS1920][WelcomeRoute] splash renderer ready', {mode: 'fallback'})
            }
            let fallbackStarted = false
            const startMainThreadFallback = () => {
                if (fallbackStarted || disposed) {
                    return
                }

                fallbackStarted = true
                const fallbackCanvas = document.createElement('canvas')
                fallbackCanvas.className = canvas.className
                fallbackCanvas.setAttribute('aria-hidden', 'true')
                canvas.replaceWith(fallbackCanvas)
                console.info('[LGS1920][WelcomeRoute] switching to main-thread renderer')
                void initializeFallback(fallbackCanvas).catch(error => {
                    layer.dataset.routeError = 'true'
                    layer.dataset.routeStatus = 'error'
                    console.warn('The Studio hero route fallback could not be initialized', error)
                })
            }

            try {
                const bounds = layer.getBoundingClientRect()
                console.info('[LGS1920][WelcomeRoute] initializing splash renderer', {
                    width: bounds.width,
                    height: bounds.height,
                })
                if (useWorker && typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function') {
                    cleanup = setupRouteWorker(layer, canvas, startMainThreadFallback)
                    return
                }

                await initializeFallback(canvas)
            }
            catch (error) {
                layer.dataset.routeError = 'true'
                layer.dataset.routeStatus = 'error'
                console.warn('The Studio hero route animation could not be initialized', error)
            }
        }

        void initialize()

        return () => {
            disposed = true
            cleanup()
        }
    }, [useWorker])

    if (suppressRoute) {
        return null
    }

    const route = (
        <div className="welcome-hero-route" data-render-mode="initializing">
            <canvas ref={_canvas} className="welcome-hero-route-canvas" aria-hidden="true"/>
            <div className="welcome-hero-route-annotations" aria-label="Route points">
                {ROUTE_POIS.map(({index, label, point}) => (
                    <div
                        className="welcome-hero-poi"
                        data-route-point={point}
                        data-route-poi
                        data-route-poi-index={index}
                        key={index}
                        role="img"
                        aria-label={label}
                    >
                        <svg
                            className="welcome-hero-poi-marker"
                            aria-hidden="true"
                            viewBox="0 0 384 512"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fill="currentColor"
                                d="M215.7 499.2C267 435 384 279.4 384 192C384 86 297.9 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"
                            />
                        </svg>
                    </div>
                ))}
            </div>
        </div>
    )

    if (mountInSplash && typeof document !== 'undefined') {
        const splashElement = document.querySelector('#lgs-boot-splash')

        if (splashElement) {
            return createPortal(route, splashElement)
        }
    }

    return route
}
