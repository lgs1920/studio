/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-joystick-scene.test.js
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

import {describe, expect, it, vi} from 'vitest'
import {Color, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three'
import {
    createDomeSeamGeometry, createJoystickContactRingGeometry, createJoystickCrownGeometry, createJoystickDomeGeometry,
    createGripMarks, createJoystickCrownEdgeShadeGeometry, createJoystickCrownSeparationBaseMaterial,
    createJoystickCrownMaterial, createJoystickCrownSeparationGeometry, createJoystickDomeMaterial,
    createJoystickGripRingGeometry, setJoystickDomeTilt,
    setJoystickMapReflectionTransform,
} from '@Components/JourneyReplay/ReplayCameraJoystickScene'

describe('Replay camera joystick surface', () => {
    it('flips sampled map imagery horizontally and vertically for the convex reflection', () => {
        const context = {setTransform: vi.fn()}
        setJoystickMapReflectionTransform(context, 256)
        expect(context.setTransform).toHaveBeenCalledWith(-1, 0, 0, -1, 256, 256)
    })

    it('keeps the dome smooth while its finish rolls with the drag', () => {
        const dome = createJoystickDomeGeometry()
        try {
            const positions = dome.getAttribute('position')
            const reflection = dome.getAttribute('uv')
            expect(positions.getZ(0)).toBeCloseTo(0.19)
            expect(positions.getZ(1)).toBeLessThan(positions.getZ(0))
            const originalPositions = positions.array.slice()
            setJoystickDomeTilt(dome, 0.35, 0)
            expect(positions.array).toEqual(originalPositions)
            expect(reflection.getX(0)).toBeLessThan(0.5)
            expect(reflection.getY(0)).toBeCloseTo(0.5)
            setJoystickDomeTilt(dome, 0, 0)
            expect(reflection.getX(0)).toBe(0.5)
        }
        finally {
            dome.dispose()
        }
    })

    it('adds light at the dark edge when the dome is fully deflected', () => {
        const dome = createJoystickDomeGeometry()
        try {
            const colors = dome.getAttribute('color')
            const edge = colors.count - 128
            const idleShade = colors.getX(edge)
            setJoystickDomeTilt(dome, 0.40, 0)
            expect(colors.getX(edge)).toBeGreaterThan(idleShade)
            setJoystickDomeTilt(dome, 0, 0)
            expect(colors.getX(edge)).toBe(idleShade)
        }
        finally {
            dome.dispose()
        }
    })

    it('cuts the north tip and tick marks into the crown instead of raising them', () => {
        const crown = createJoystickCrownGeometry()
        const material = new MeshBasicMaterial()
        const mesh = new Mesh(crown, material)
        const raycaster = new Raycaster(new Vector3(), new Vector3(0, 0, -1))
        try {
            raycaster.ray.origin.set(0, 0.89, 1)
            expect(raycaster.intersectObject(mesh)).toHaveLength(0)
            raycaster.ray.origin.set(0.85, 0, 1)
            expect(raycaster.intersectObject(mesh)).toHaveLength(0)
            raycaster.ray.origin.set(0.84, 0.11, 1)
            expect(raycaster.intersectObject(mesh)[0].point.z).toBeCloseTo(0)
            expect(crown.groups.map(group => group.materialIndex)).toEqual([0, 1])
        }
        finally {
            crown.dispose()
            material.dispose()
        }
    })

    it('gives the grip deeper grooves while keeping its surface flush with the compass', () => {
        const grip = createJoystickGripRingGeometry()
        const crown = createJoystickCrownGeometry()
        const material = new MeshBasicMaterial()
        const mesh = new Mesh(grip, material)
        const raycaster = new Raycaster(new Vector3(), new Vector3(0, 0, -1))
        try {
            raycaster.ray.origin.set(0.726, 0, 1)
            expect(raycaster.intersectObject(mesh)).toHaveLength(0)
            raycaster.ray.origin.set(0.724, 0.065, 1)
            expect(raycaster.intersectObject(mesh)[0].point.z).toBeCloseTo(0)
            grip.computeBoundingBox()
            crown.computeBoundingBox()
            expect(grip.boundingBox.min.z).toBeLessThan(crown.boundingBox.min.z)
            expect(grip.boundingBox.max.z).toBeCloseTo(0, 7)
            expect(crown.boundingBox.max.z).toBeCloseTo(0.0025, 6)
            expect(grip.boundingBox.max.x).toBeCloseTo(0.788, 5)
        }
        finally {
            grip.dispose()
            crown.dispose()
            material.dispose()
        }
    })

    it('sets the 32 inner grip grooves to the eight compass tick directions', () => {
        const marks = createGripMarks()
        expect(marks).toHaveLength(32)
        for (let index = 0; index < 32; index += 4) {
            const points = marks[index].getPoints().slice(0, -1)
            const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length
            const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length
            const expectedAngle = index * Math.PI / 16
            expect(centerX / Math.hypot(centerX, centerY)).toBeCloseTo(Math.cos(expectedAngle), 6)
            expect(centerY / Math.hypot(centerX, centerY)).toBeCloseTo(Math.sin(expectedAngle), 6)
        }
    })

    it('creates a two-pixel shaded channel between the grip and compass crowns', () => {
        const grip = createJoystickGripRingGeometry()
        const crown = createJoystickCrownGeometry()
        const separation = createJoystickCrownSeparationGeometry()
        try {
            const radialExtent = (geometry, maximum) => {
                const positions = geometry.getAttribute('position')
                let radius = maximum ? 0 : Infinity
                for (let index = 0; index < positions.count; index++) {
                    const candidate = Math.hypot(positions.getX(index), positions.getY(index))
                    radius = maximum ? Math.max(radius, candidate) : Math.min(radius, candidate)
                }
                return radius
            }
            const pixelScale = 144 / (2 * 0.99)
            const gapPixels = (radialExtent(crown, false) - radialExtent(grip, true)) * pixelScale
            expect(gapPixels).toBeCloseTo(2, 1)

            const colors = separation.getAttribute('color')
            let darkestChannelAlpha = 0
            let brightestChannel = 0
            for (let index = 0; index < colors.count; index++) {
                darkestChannelAlpha = Math.max(darkestChannelAlpha, colors.getW(index))
                brightestChannel = Math.max(brightestChannel, colors.getX(index))
            }
            expect(darkestChannelAlpha).toBeGreaterThan(0.45)
            expect(brightestChannel).toBeGreaterThan(0.2)
        }
        finally {
            grip.dispose()
            crown.dispose()
            separation.dispose()
        }
    })

    it('uses an opaque theme-colored backing under the crown channel', () => {
        const material = createJoystickCrownSeparationBaseMaterial(new Color(0.4, 0.6, 0.8))
        try {
            expect(material.transparent).toBe(false)
            expect(material.color.r).toBeCloseTo(0.192)
            expect(material.color.g).toBeCloseTo(0.288)
            expect(material.color.b).toBeCloseTo(0.384)
        }
        finally {
            material.dispose()
        }
    })

    it('keeps both decorative crowns mostly opaque', () => {
        const material = createJoystickCrownMaterial(new Color(0.4, 0.6, 0.8), new Color(1, 1, 1))
        try {
            expect(material.transparent).toBe(true)
            expect(material.opacity).toBe(0.9)
        }
        finally {
            material.dispose()
        }
    })

    it('uses a more matte finish on the ball while retaining a soft reflection', () => {
        const material = createJoystickDomeMaterial(new Color(0.4, 0.6, 0.8), null)
        try {
            expect(material.roughness).toBe(0.66)
            expect(material.clearcoat).toBe(0.1)
            expect(material.clearcoatRoughness).toBe(0.58)
        }
        finally {
            material.dispose()
        }
    })

    it('lights the upper-left map edge and the opposite side inside the recess', () => {
        const shadow = createJoystickContactRingGeometry()
        try {
            const positions = shadow.getAttribute('position')
            const colors = shadow.getAttribute('color')
            let darkInside = false
            let darkOutside = false
            let reflectedLight = 0
            let oppositeLight = 0
            let innerLight = 0
            let upperInnerLight = 0
            let reflectedLightRadius = 0
            for (let index = 0; index < positions.count; index++) {
                const radius = Math.hypot(positions.getX(index), positions.getY(index))
                const opacity = colors.getW(index)
                const x = positions.getX(index)
                const y = positions.getY(index)
                if (opacity > 0.4) {
                    darkInside ||= radius < 0.99
                    darkOutside ||= radius > 0.99
                }
                const light = colors.getX(index) * opacity
                if (x < 0 && y > 0 && light > reflectedLight) {
                    reflectedLight = light
                    reflectedLightRadius = radius
                }
                if (x > 0 && y < 0) {
                    if (radius >= 0.99) oppositeLight = Math.max(oppositeLight, light)
                    else innerLight = Math.max(innerLight, light)
                }
                if (radius <= 0.99 && x < 0 && y > 0) upperInnerLight = Math.max(upperInnerLight, light)
            }
            expect(colors.getW(0)).toBeCloseTo(0)
            expect(colors.getW(positions.count - 1)).toBeCloseTo(0)
            expect(darkInside && darkOutside).toBe(true)
            expect(reflectedLight).toBeGreaterThan(0.09)
            expect(reflectedLightRadius).toBeGreaterThan(1.07)
            expect(reflectedLightRadius).toBeLessThan(1.09)
            expect(oppositeLight).toBe(0)
            expect(innerLight).toBeGreaterThan(0.22)
            expect(upperInnerLight).toBe(0)
            expect(positions.getZ(positions.count - 1)).toBeGreaterThan(positions.getZ(0))
            expect(positions.getZ(positions.count - 1)).toBeCloseTo(positions.getZ(positions.count - 257))
        }
        finally {
            shadow.dispose()
        }
    })

    it('places the crown-edge shade over only the lower-right outer arc', () => {
        const shade = createJoystickCrownEdgeShadeGeometry()
        try {
            shade.computeBoundingBox()
            expect(shade.boundingBox.min.x).toBeCloseTo(0)
            expect(shade.boundingBox.max.x).toBeCloseTo(0.99)
            expect(shade.boundingBox.min.y).toBeCloseTo(-0.99)
            expect(shade.boundingBox.max.y).toBeCloseTo(0)
        }
        finally {
            shade.dispose()
        }
    })

    it('keeps a faint floor shadow on the lower-right side', () => {
        const seam = createDomeSeamGeometry()
        try {
            const colors = seam.getAttribute('color')
            const seamRow = 5 * 193
            expect(colors.getW(seamRow + 164)).toBeGreaterThan(0.05)
            expect(colors.getW(seamRow + 164)).toBeLessThan(0.10)
            expect(colors.getW(seamRow + 68)).toBeGreaterThan(0.35)
        }
        finally {
            seam.dispose()
        }
    })

    it('centers the map reflection and curves its sampling toward the dome edge', () => {
        const dome = createJoystickDomeGeometry()
        try {
            const positions = dome.getAttribute('position')
            const coordinates = dome.getAttribute('uv')
            expect(coordinates.count).toBe(positions.count)
            expect(coordinates.getX(0)).toBe(0.5)
            expect(coordinates.getY(0)).toBe(0.5)
            const firstRingScale = (coordinates.getX(1) - 0.5) / positions.getX(1)
            const lastRingStart = positions.count - 128
            const edgeScale = (coordinates.getX(lastRingStart) - 0.5) / positions.getX(lastRingStart)
            expect(edgeScale).toBeGreaterThan(firstRingScale)
            expect(coordinates.getX(lastRingStart)).toBeCloseTo(1)
        }
        finally {
            dome.dispose()
        }
    })

    it('keeps the outer diameter while reserving a gap between the dome and compass', () => {
        const crown = createJoystickCrownGeometry()
        const dome = createJoystickDomeGeometry()

        try {
            crown.computeBoundingBox()
            dome.computeBoundingBox()
            expect(crown.boundingBox.max.x).toBeCloseTo(0.99)
            expect(crown.boundingBox.min.x).toBeCloseTo(-0.99)
            expect(crown.boundingBox.min.z).toBeCloseTo(-0.0445, 5)
            expect(crown.boundingBox.max.z).toBeCloseTo(0.0025, 5)
            expect(dome.boundingBox.max.x).toBeCloseTo(0.70, 5)
            expect(dome.boundingBox.max.z).toBeCloseTo(0.19)
            const vertices = crown.getAttribute('position')
            const uv = crown.getAttribute('uv')
            let innerRadius = Infinity
            let maxU = 0
            for (let index = 0; index < vertices.count; index++) {
                innerRadius = Math.min(innerRadius, Math.hypot(vertices.getX(index), vertices.getY(index)))
                maxU = Math.max(maxU, uv.getX(index))
            }
            expect(innerRadius).toBeCloseTo(0.8155, 5)
            expect(maxU).toBeCloseTo(0.85)
        }
        finally {
            crown.dispose()
            dome.dispose()
        }
    })
})
