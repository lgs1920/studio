/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeHeroRoute.worker.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import * as THREE from 'three'
import {Line2} from 'three/addons/lines/Line2.js'
import {LineGeometry} from 'three/addons/lines/LineGeometry.js'
import {LineMaterial} from 'three/addons/lines/LineMaterial.js'

const ROUTE_DURATION = 13_000
const ROUTE_PATH_SAMPLE_COUNT = 260
const TRAIL_PATH_SAMPLE_COUNT = 320
const ROUTE_TURNS = 2
const TRAIL_DURATION = 2_200
const TRAIL_LEAD_DURATION = 1_150
const ROUTE_DASH_SIZE = 0.16
const ROUTE_GAP_SIZE = 0.12
const ROUTE_LINE_WIDTH = 2.4
const NEON_OUTER_RADIUS = 0.09
const NEON_MIDDLE_RADIUS = 0.046
const NEON_CORE_RADIUS = 0.018
const ROUTE_EDGE_FADE_LENGTH = 0.14
const ROUTE_HEAD_MIN_OPACITY = 0.24
const ROUTE_SHAPE_STRETCH = 0.16
const ROUTE_SHAPE_SQUEEZE = 0.09
const ROUTE_SHAPE_CYCLE = 5_800
const MAX_PIXEL_RATIO = 1.35
const POI_PROGRESS = [0.25, 0.5, 0.75]
const POI_REVEAL_LEAD = 0.08

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

        if (alpha <= 0.005) discard;
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

        if (alpha <= 0.004) discard;
        gl_FragColor = vec4(color, alpha);
    }
`

const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum)

const toColor = ({r, g, b}) => new THREE.Color(r, g, b)

const createNeonMaterial = (baseColor, glowColor, opacity, glowMix) => new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: NEON_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    toneMapped: false,
    transparent: true,
    uniforms: {
        uBaseColor: {value: toColor(baseColor)},
        uFutureSpan: {value: TRAIL_LEAD_DURATION / ROUTE_DURATION},
        uGlowColor: {value: toColor(glowColor)},
        uGlowMix: {value: glowMix},
        uOpacity: {value: opacity},
        uPastSpan: {value: TRAIL_DURATION / ROUTE_DURATION},
        uProgress: {value: 0},
    },
    vertexShader: NEON_VERTEX_SHADER,
})

const createGlowMaterial = (color) => new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: GLOW_FRAGMENT_SHADER,
    transparent: true,
    uniforms: {
        uColor: {value: toColor(color)},
        uSize: {value: 1.55},
    },
    vertexShader: GLOW_VERTEX_SHADER,
})

const getNormal = (direction) => {
    const normal = new THREE.Vector3(-direction.y, direction.x, 0)
    if (normal.lengthSq() < 0.001) normal.set(0, 1, 0)
    return normal.normalize()
}

const createRoute = (routeColor, glowColor) => {
    const edges = ['left', 'right', 'top', 'bottom']
    const entryEdge = edges[Math.floor(Math.random() * edges.length)]
    let exitEdge = edges[Math.floor(Math.random() * edges.length)]

    while (exitEdge === entryEdge) exitEdge = edges[Math.floor(Math.random() * edges.length)]

    const edgePoint = (edge, depth) => {
        const z = depth === 'entry' ? randomBetween(2.25, 3.25) : randomBetween(-4.2, -2.65)
        if (edge === 'left') return new THREE.Vector3(-4.45, randomBetween(-2.35, 2.35), z)
        if (edge === 'right') return new THREE.Vector3(4.45, randomBetween(-2.35, 2.35), z)
        if (edge === 'top') return new THREE.Vector3(randomBetween(-3.25, 3.25), 2.95, z)
        return new THREE.Vector3(randomBetween(-3.25, 3.25), -2.95, z)
    }

    const entryPoint = edgePoint(entryEdge, 'entry')
    const exitPoint = edgePoint(exitEdge, 'exit')
    const center = new THREE.Vector3(randomBetween(-0.45, 0.45), randomBetween(-0.25, 0.35), randomBetween(0.15, 0.55))
    const startAngle = randomBetween(0, Math.PI * 2)
    const direction = Math.random() < 0.5 ? -1 : 1
    const radiusX = randomBetween(2.25, 2.75)
    const radiusY = randomBetween(1.45, 1.9)
    const height = randomBetween(5.55, 6.25)
    const top = randomBetween(2.35, 2.9)
    const spiralPoints = Array.from({length: 66}, (_, index) => {
        const progress = index / 65
        const angle = startAngle + progress * Math.PI * 2 * ROUTE_TURNS * direction
        return new THREE.Vector3(
            center.x + Math.cos(angle) * (0.18 + progress * radiusX),
            center.y + Math.sin(angle) * (0.12 + progress * radiusY),
            center.z + top - progress * height + Math.sin(angle * 0.5) * 0.24,
        )
    })
    const startTangent = new THREE.Vector3().subVectors(spiralPoints[1], spiralPoints[0]).normalize()
    const endTangent = new THREE.Vector3().subVectors(spiralPoints.at(-1), spiralPoints.at(-2)).normalize()
    const entryApproach = spiralPoints[0].clone().sub(startTangent.clone().multiplyScalar(randomBetween(0.78, 1.12)))
    const entryDirection = new THREE.Vector3().subVectors(entryApproach, entryPoint).normalize()
    const entryNormal = getNormal(entryDirection)
    const entryBend = entryPoint.clone().lerp(entryApproach, randomBetween(0.34, 0.52)).add(entryNormal.clone().multiplyScalar(randomBetween(0.95, 1.4)))
    const entrySway = entryPoint.clone().lerp(entryApproach, randomBetween(0.62, 0.74)).add(entryNormal.clone().multiplyScalar(randomBetween(-0.55, -0.85)))
    const exitDeparture = spiralPoints.at(-1).clone().add(endTangent.clone().multiplyScalar(randomBetween(0.82, 1.18)))
    const exitDirection = new THREE.Vector3().subVectors(exitPoint, exitDeparture).normalize()
    const exitNormal = getNormal(exitDirection)
    const exitBend = exitDeparture.clone().lerp(exitPoint, randomBetween(0.42, 0.62)).add(exitNormal.clone().multiplyScalar(randomBetween(-1.2, -0.65)))
    const exitSway = exitDeparture.clone().lerp(exitPoint, randomBetween(0.7, 0.8)).add(exitNormal.clone().multiplyScalar(randomBetween(0.45, 0.8)))
    const curve = new THREE.CatmullRomCurve3([
        entryPoint, entryBend, entrySway, entryApproach, ...spiralPoints,
        exitDeparture, exitBend, exitSway, exitPoint,
    ], false, 'centripetal', 0.28)
    const pathPoints = curve.getSpacedPoints(ROUTE_PATH_SAMPLE_COUNT)
    const positions = new Float32Array(pathPoints.length * 3)
    pathPoints.forEach((point, index) => {
        positions[index * 3] = point.x
        positions[index * 3 + 1] = point.y
        positions[index * 3 + 2] = point.z
    })
    const routeGeometry = new LineGeometry()
    routeGeometry.setPositions(positions)
    const routeMaterial = new LineMaterial({
        alphaToCoverage: true,
        color: toColor(routeColor),
        dashed: true,
        dashSize: ROUTE_DASH_SIZE,
        depthWrite: false,
        gapSize: ROUTE_GAP_SIZE,
        linewidth: ROUTE_LINE_WIDTH,
        opacity: 0.96,
        transparent: true,
    })
    routeMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uRouteLength = {value: curve.getLength()}
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
    routeMaterial.resolution.set(1, 1)
    const routeLine = new Line2(routeGeometry, routeMaterial)
    routeLine.computeLineDistances()
    routeLine.frustumCulled = false
    routeLine.renderOrder = 4
    const neonMaterials = [
        createNeonMaterial(routeColor, glowColor, 0.1, 0.5),
        createNeonMaterial(routeColor, glowColor, 0.2, 0.78),
        createNeonMaterial(routeColor, glowColor, 0.72, 1),
    ]
    const meshes = [
        new THREE.Mesh(new THREE.TubeGeometry(curve, TRAIL_PATH_SAMPLE_COUNT, NEON_OUTER_RADIUS, 8, false), neonMaterials[0]),
        new THREE.Mesh(new THREE.TubeGeometry(curve, TRAIL_PATH_SAMPLE_COUNT, NEON_MIDDLE_RADIUS, 8, false), neonMaterials[1]),
        new THREE.Mesh(new THREE.TubeGeometry(curve, TRAIL_PATH_SAMPLE_COUNT, NEON_CORE_RADIUS, 6, false), neonMaterials[2]),
    ]
    meshes.forEach((mesh, index) => {
        mesh.frustumCulled = false
        mesh.renderOrder = index + 1
    })
    const markerGeometry = new THREE.BufferGeometry()
    markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3), 3))
    markerGeometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(new Float32Array([1]), 1))
    const markerMaterial = createGlowMaterial(glowColor)
    const marker = new THREE.Points(markerGeometry, markerMaterial)
    marker.renderOrder = 5
    const group = new THREE.Group()
    group.add(...meshes, routeLine, marker)

    return {group, marker, markerMaterial, neonMaterials, pathPoints, routeMaterial}
}

let renderer
let camera
let scene
let sceneRoot
let route
let routeColor
let glowColor
let reducedMotion = false
let visible = true
let animationFrame = null
let startedAt = null
let poiReached = POI_PROGRESS.map(() => false)
let viewportWidth = 0
let viewportHeight = 0
let lastPoiProjectionAt = -Infinity
const projectedPoiPosition = new THREE.Vector3()
const requestFrame = (callback) => globalThis.requestAnimationFrame?.(callback)
    ?? globalThis.setTimeout(() => callback(globalThis.performance.now()), 16)
const cancelFrame = (frame) => globalThis.cancelAnimationFrame?.(frame) ?? globalThis.clearTimeout(frame)

const resize = (width, height, pixelRatio) => {
    if (!renderer || !width || !height) return
    viewportWidth = width
    viewportHeight = height
    renderer.setPixelRatio(Math.min(pixelRatio || 1, MAX_PIXEL_RATIO))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    route.routeMaterial.resolution.set(width, height)
    const aspect = width / height
    const isMobile = width < 720
    const scale = isMobile ? Math.max(0.36, Math.min(0.5, aspect * 0.58)) : Math.max(0.54, Math.min(0.72, aspect * 0.46))
    sceneRoot.scale.set(scale, scale, scale)
    sceneRoot.position.x = isMobile ? 0 : 1.35
    sceneRoot.position.y = isMobile ? -1.5 : 0.05
}

const projectPois = (timestamp) => {
    if (!route || !viewportWidth || !viewportHeight || timestamp - lastPoiProjectionAt < 66) {
        return
    }

    lastPoiProjectionAt = timestamp
    sceneRoot.updateMatrixWorld(true)

    POI_PROGRESS.forEach((point, index) => {
        const pathIndex = Math.min(Math.round(point * (route.pathPoints.length - 1)), route.pathPoints.length - 1)
        projectedPoiPosition.copy(route.pathPoints[pathIndex])
        route.group.localToWorld(projectedPoiPosition)
        projectedPoiPosition.project(camera)
        const visible = projectedPoiPosition.z > -1
            && projectedPoiPosition.z < 1
            && projectedPoiPosition.x > -1.15
            && projectedPoiPosition.x < 1.15
            && projectedPoiPosition.y > -1.15
            && projectedPoiPosition.y < 1.15

        self.postMessage({
            type: 'poi-position',
            index,
            left: (projectedPoiPosition.x * 0.5 + 0.5) * viewportWidth,
            top: (-projectedPoiPosition.y * 0.5 + 0.5) * viewportHeight,
            visible,
        })
    })
}

const rebuild = () => {
    const nextRoute = createRoute(routeColor, glowColor)
    if (route) {
        sceneRoot.remove(route.group)
        route.group.traverse(object => {
            object.geometry?.dispose()
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            materials.filter(Boolean).forEach(material => material.dispose())
        })
    }
    route = nextRoute
    sceneRoot.add(route.group)
    startedAt = null
    poiReached = POI_PROGRESS.map(() => false)
    POI_PROGRESS.forEach((_, index) => self.postMessage({type: 'poi', index, revealed: false}))
}

const applyPalette = (nextRouteColor, nextGlowColor) => {
    routeColor = nextRouteColor
    glowColor = nextGlowColor

    if (!route) {
        return
    }

    route.routeMaterial.color.copy(toColor(routeColor))
    route.neonMaterials.forEach(material => {
        material.uniforms.uBaseColor.value.copy(toColor(routeColor))
        material.uniforms.uGlowColor.value.copy(toColor(glowColor))
    })
    route.markerMaterial.uniforms.uColor.value.copy(toColor(glowColor))
}

const render = (timestamp) => {
    if (!renderer || !route) return
    if (startedAt === null && timestamp > 0) startedAt = timestamp
    const elapsed = startedAt === null ? 0 : (timestamp - startedAt) % ROUTE_DURATION
    const progress = reducedMotion ? 1 : Math.max(0, Math.min(1, elapsed / ROUTE_DURATION))
    if (!reducedMotion && progress < 0.02 && poiReached.some(Boolean)) {
        poiReached = POI_PROGRESS.map(() => false)
        POI_PROGRESS.forEach((_, index) => self.postMessage({type: 'poi', index, revealed: false}))
    }
    POI_PROGRESS.forEach((poiProgress, index) => {
        if ((reducedMotion || progress >= Math.max(0, poiProgress - POI_REVEAL_LEAD)) && !poiReached[index]) {
            poiReached[index] = true
            self.postMessage({type: 'poi', index, revealed: true})
        }
    })
    route.neonMaterials.forEach(material => {
        material.uniforms.uProgress.value = progress
    })
    const markerPosition = progress * (route.pathPoints.length - 1)
    const markerIndex = Math.min(Math.floor(markerPosition), route.pathPoints.length - 2)
    route.marker.position.lerpVectors(route.pathPoints[markerIndex], route.pathPoints[markerIndex + 1], markerPosition - markerIndex)
    route.markerMaterial.uniforms.uSize.value = reducedMotion ? 1.55 : 1.55 + Math.sin(timestamp * 0.008) * 0.1
    sceneRoot.rotation.x = reducedMotion ? 0.42 : 0.46 + Math.sin(timestamp * 0.00025) * 0.18
    sceneRoot.rotation.y = reducedMotion ? -0.62 : Math.sin(timestamp * 0.00032) * 0.68
    sceneRoot.rotation.z = reducedMotion ? 0.06 : Math.sin(timestamp * 0.00023) * 0.1
    const shapeWave = Math.sin(timestamp / ROUTE_SHAPE_CYCLE * Math.PI * 2)
    route.group.scale.set(reducedMotion ? 1 : 1 + shapeWave * ROUTE_SHAPE_STRETCH, reducedMotion ? 1 : 1 - shapeWave * ROUTE_SHAPE_SQUEEZE, 1)
    projectPois(timestamp)
    renderer.render(scene, camera)
}

const draw = (timestamp) => {
    animationFrame = null
    if (!visible) return
    render(timestamp)
    if (!reducedMotion) animationFrame = requestFrame(draw)
}

const schedule = () => {
    if (animationFrame === null && visible) animationFrame = requestFrame(draw)
}

self.onmessage = ({data}) => {
    if (data.type === 'init') {
        routeColor = data.routeColor
        glowColor = data.glowColor
        reducedMotion = data.reducedMotion
        renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, canvas: data.canvas, powerPreference: 'low-power'})
        scene = new THREE.Scene()
        sceneRoot = new THREE.Group()
        scene.add(sceneRoot)
        camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
        camera.position.set(0, 0, 9.5)
        camera.lookAt(0, 0, 0)
        rebuild()
        resize(data.width, data.height, data.pixelRatio)
        schedule()
        return
    }

    if (data.type === 'resize') resize(data.width, data.height, data.pixelRatio)
    if (data.type === 'palette') {
        applyPalette(data.routeColor, data.glowColor)
        schedule()
    }
    if (data.type === 'visibility') {
        visible = data.visible
        if (visible) schedule()
    }
    if (data.type === 'reduced-motion') {
        reducedMotion = data.value
        if (reducedMotion) render(0)
        else schedule()
    }
    if (data.type === 'dispose') {
        if (animationFrame !== null) cancelFrame(animationFrame)
        route?.group.traverse(object => object.geometry?.dispose())
        renderer?.dispose()
        self.close()
    }
}
