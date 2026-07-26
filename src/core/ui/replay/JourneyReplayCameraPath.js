/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraPath.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Cartesian3, Cartographic, Matrix4, Transforms } from 'cesium'

const CAMERA_TRANSFER_THRESHOLD_FALLBACK_KM = 50
const CAMERA_TRANSFER_ELEVATE_RATIO = 3
const CAMERA_TRANSFER_SPIRAL_RATIO = 8
const CAMERA_TRANSFER_MIN_SAMPLES = 16

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const isCartesian3Like = value => Boolean(value)
    && [value.x, value.y, value.z].every(component => Number.isFinite(component))

const normalizeCartesian3 = (value, fallback = Cartesian3.UNIT_Z) => {
    if (isCartesian3Like(value)) {
        return Cartesian3.normalize(value, new Cartesian3())
    }

    return isCartesian3Like(fallback) ? Cartesian3.clone(fallback, new Cartesian3()) : new Cartesian3(0, 0, 1)
}

const lerpCartesian3 = (start, end, ratio) => {
    if (!isCartesian3Like(start)) {
        return isCartesian3Like(end) ? Cartesian3.clone(end, new Cartesian3()) : new Cartesian3()
    }

    if (!isCartesian3Like(end)) {
        return Cartesian3.clone(start, new Cartesian3())
    }

    return Cartesian3.lerp(start, end, clamp(ratio, 0, 1), new Cartesian3())
}

const cubicBezierCartesian3 = (start, control1, control2, end, ratio) => {
    const t = clamp(ratio, 0, 1)
    const invT = 1 - t
    const invT2 = invT * invT
    const invT3 = invT2 * invT
    const t2 = t * t
    const t3 = t2 * t
    const result = new Cartesian3()

    Cartesian3.multiplyByScalar(start, invT3, result)
    Cartesian3.add(result, Cartesian3.multiplyByScalar(control1, 3 * invT2 * t, new Cartesian3()), result)
    Cartesian3.add(result, Cartesian3.multiplyByScalar(control2, 3 * invT * t2, new Cartesian3()), result)
    Cartesian3.add(result, Cartesian3.multiplyByScalar(end, t3, new Cartesian3()), result)
    return result
}

const worldUpFromPoint = (point) => {
    if (!isCartesian3Like(point)) {
        return new Cartesian3(0, 0, 1)
    }

    return normalizeCartesian3(point, Cartesian3.UNIT_Z)
}

const pointInsideAntiCollisionBounds = (point, bounds) => {
    if (!isCartesian3Like(point) || !bounds) {
        return false
    }

    const cartographic = Cartographic.fromCartesian(point)
    const longitude = cartographic.longitude * (180 / Math.PI)
    const latitude = cartographic.latitude * (180 / Math.PI)
    const west = finiteNumber(bounds.west)
    const south = finiteNumber(bounds.south)
    const east = finiteNumber(bounds.east)
    const north = finiteNumber(bounds.north)

    if ([west, south, east, north].some(value => value === null)) {
        return false
    }

    return longitude >= west && longitude <= east && latitude >= south && latitude <= north
}

const liftOutsideAntiCollisionBounds = (point, bounds, liftMeters) => {
    if (!pointInsideAntiCollisionBounds(point, bounds)) {
        return point
    }

    const clearance = finiteNumber(bounds?.clearanceMeters) ?? liftMeters
    const minimumHeight = finiteNumber(bounds?.minimumHeightMeters) ?? 0
    const cartographic = Cartographic.fromCartesian(point)
    cartographic.height = Math.max(cartographic.height, minimumHeight + clearance)
    return Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height, undefined, new Cartesian3())
}

const buildTransferBasis = (start, end) => {
    const travelVector = Cartesian3.subtract(end, start, new Cartesian3())
    const travelAxis = normalizeCartesian3(travelVector, Cartesian3.UNIT_X)
    const midpoint = Cartesian3.multiplyByScalar(Cartesian3.add(start, end, new Cartesian3()), 0.5, new Cartesian3())
    const worldUp = worldUpFromPoint(midpoint)
    const sideCandidate = Cartesian3.cross(worldUp, travelAxis, new Cartesian3())
    const side = Cartesian3.magnitudeSquared(sideCandidate) > Number.EPSILON
                ? Cartesian3.normalize(sideCandidate, sideCandidate)
                : normalizeCartesian3(Cartesian3.cross(Cartesian3.UNIT_Z, travelAxis, new Cartesian3()), Cartesian3.UNIT_X)
    const lift = Cartesian3.normalize(Cartesian3.cross(travelAxis, side, new Cartesian3()), new Cartesian3())

    return {
        travelAxis,
        worldUp,
        side,
        lift,
    }
}

const pathPositionAt = (mode, start, end, ratio, options = {}) => {
    const t = clamp(ratio, 0, 1)
    const distance = Cartesian3.distance(start, end)
    const basis = buildTransferBasis(start, end)
    const basePoint = lerpCartesian3(start, end, t)
    const safetyProfile = options.safetyProfile ?? null
    const safetyScale = clamp(finiteNumber(safetyProfile?.zoneScale) ?? 1, 0.75, 1.75)
    const trackingMode = safetyProfile?.mode === 'dynamic' ? 'dynamic' : 'navigation'
    const modeScale = trackingMode === 'dynamic' ? 1.15 : 1
    const effectiveScale = safetyScale * modeScale
    const liftMeters = (finiteNumber(options.liftMeters) ?? Math.max(120, distance * 0.18)) * effectiveScale
    const spiralTurns = Math.max(0.5, finiteNumber(options.spiralTurns) ?? 1)
    const angle = 2 * Math.PI * spiralTurns * t
    const circleRadius = Math.max(40, (finiteNumber(options.radiusMeters) ?? distance * 0.08) * effectiveScale)
    const conicalRadius = lerpCartesian3(
        new Cartesian3(circleRadius * 0.75, 0, 0),
        new Cartesian3(circleRadius * 0.1, 0, 0),
        t,
    ).x

    const antiCollisionBounds = options.antiCollisionBounds

    let position
    switch (mode) {
        case 'direct':
            position = liftOutsideAntiCollisionBounds(basePoint, antiCollisionBounds, liftMeters)
            break
        case 'bezier-3d': {
            const control1 = options.controlPoints?.[0]
            const control2 = options.controlPoints?.[1]
            if (isCartesian3Like(control1) && isCartesian3Like(control2)) {
                position = cubicBezierCartesian3(start, control1, control2, end, t)
                break
            }

            const handleDistance = Math.max(60, distance * 0.25)
            const startControl = Cartesian3.add(
                Cartesian3.add(
                    start,
                    Cartesian3.multiplyByScalar(basis.travelAxis, handleDistance, new Cartesian3()),
                    new Cartesian3(),
                ),
                Cartesian3.multiplyByScalar(basis.lift, liftMeters, new Cartesian3()),
                new Cartesian3(),
            )
            const endControl = Cartesian3.add(
                Cartesian3.add(
                    end,
                    Cartesian3.multiplyByScalar(basis.travelAxis, -handleDistance, new Cartesian3()),
                    new Cartesian3(),
                ),
                Cartesian3.multiplyByScalar(basis.lift, liftMeters, new Cartesian3()),
                new Cartesian3(),
            )
            position = cubicBezierCartesian3(start, startControl, endControl, end, t)
            break
        }
        case 'elevate-then-move':
        case 'blur-jump-refocus': {
            const travelHeight = liftMeters
            if (t < 0.33) {
                position = liftOutsideAntiCollisionBounds(Cartesian3.add(
                    start,
                    Cartesian3.multiplyByScalar(basis.worldUp, travelHeight * (t / 0.33), new Cartesian3()),
                    new Cartesian3(),
                ), antiCollisionBounds, travelHeight)
                break
            }

            if (t < 0.66) {
                const moveRatio = (t - 0.33) / 0.33
                const liftedStart = Cartesian3.add(
                    start,
                    Cartesian3.multiplyByScalar(basis.worldUp, travelHeight, new Cartesian3()),
                    new Cartesian3(),
                )
                const liftedEnd = Cartesian3.add(
                    end,
                    Cartesian3.multiplyByScalar(basis.worldUp, travelHeight, new Cartesian3()),
                    new Cartesian3(),
                )
                position = liftOutsideAntiCollisionBounds(lerpCartesian3(liftedStart, liftedEnd, moveRatio), antiCollisionBounds, travelHeight)
                break
            }

            const settleRatio = (t - 0.66) / 0.34
            position = liftOutsideAntiCollisionBounds(Cartesian3.add(
                end,
                Cartesian3.multiplyByScalar(basis.worldUp, travelHeight * (1 - settleRatio), new Cartesian3()),
                new Cartesian3(),
            ), antiCollisionBounds, travelHeight)
            break
        }
        case 'spiral-horizontal': {
            const horizontalBasis = buildTransferBasis(
                Cartesian3.add(start, Cartesian3.multiplyByScalar(basis.worldUp, 1, new Cartesian3()), new Cartesian3()),
                Cartesian3.add(end, Cartesian3.multiplyByScalar(basis.worldUp, 1, new Cartesian3()), new Cartesian3()),
            )
            const horizontalOffset = Cartesian3.add(
                Cartesian3.multiplyByScalar(horizontalBasis.side, Math.cos(angle) * circleRadius, new Cartesian3()),
                Cartesian3.multiplyByScalar(horizontalBasis.lift, Math.sin(angle) * circleRadius, new Cartesian3()),
                new Cartesian3(),
            )
            position = liftOutsideAntiCollisionBounds(Cartesian3.add(basePoint, horizontalOffset, new Cartesian3()), antiCollisionBounds, circleRadius)
            break
        }
        case 'spiral-conical': {
            const radius = Math.max(20, conicalRadius)
            const offset = Cartesian3.add(
                Cartesian3.multiplyByScalar(basis.side, Math.cos(angle) * radius, new Cartesian3()),
                Cartesian3.multiplyByScalar(basis.lift, Math.sin(angle) * radius, new Cartesian3()),
                new Cartesian3(),
            )
            const climb = Cartesian3.multiplyByScalar(basis.worldUp, liftMeters * (1 - Math.abs(0.5 - t) * 1.6), new Cartesian3())
            position = liftOutsideAntiCollisionBounds(Cartesian3.add(Cartesian3.add(basePoint, offset, new Cartesian3()), climb, new Cartesian3()), antiCollisionBounds, radius)
            break
        }
        case 'spiral-vertical':
        default: {
            const radius = Math.max(20, circleRadius)
            const offset = Cartesian3.add(
                Cartesian3.multiplyByScalar(basis.side, Math.cos(angle) * radius, new Cartesian3()),
                Cartesian3.multiplyByScalar(basis.lift, Math.sin(angle) * radius, new Cartesian3()),
                new Cartesian3(),
            )
            const climb = Cartesian3.multiplyByScalar(basis.worldUp, liftMeters * t, new Cartesian3())
            position = liftOutsideAntiCollisionBounds(Cartesian3.add(Cartesian3.add(basePoint, offset, new Cartesian3()), climb, new Cartesian3()), antiCollisionBounds, radius)
            break
        }
    }

    return position
}

/**
 * Select the transfer mode to use for a camera move.
 *
 * @param {number} distanceMeters - Distance between the start and the end in meters.
 * @param {number} thresholdKm - Distance threshold expressed in kilometers.
 * @returns {string} Transfer mode identifier.
 */
export const selectCameraTransferMode = (distanceMeters, thresholdKm = CAMERA_TRANSFER_THRESHOLD_FALLBACK_KM) => {
    const distance = finiteNumber(distanceMeters)
    if (distance === null || distance <= 0) {
        return 'direct'
    }

    const thresholdMeters = Math.max(1, (finiteNumber(thresholdKm) ?? CAMERA_TRANSFER_THRESHOLD_FALLBACK_KM) * 1000)
    if (distance < thresholdMeters) {
        return 'direct'
    }

    if (distance < thresholdMeters * CAMERA_TRANSFER_ELEVATE_RATIO) {
        return 'elevate-then-move'
    }

    if (distance < thresholdMeters * CAMERA_TRANSFER_SPIRAL_RATIO) {
        return 'spiral-conical'
    }

    return 'blur-jump-refocus'
}

/**
 * Build a reusable camera transfer path between two Cartesian3 positions.
 *
 * The returned object exposes a deterministic `sampleAt` function and a sampled
 * point cache so the same path can be replayed in live preview, draft export,
 * or HQ export.
 *
 * @param {object} options - Path construction options.
 * @param {Cartesian3} options.start - Start position.
 * @param {Cartesian3} options.end - End position.
 * @param {string} [options.mode='direct'] - Path mode identifier.
 * @param {number} [options.sampleCount=48] - Number of cached samples.
 * @param {number} [options.liftMeters] - Optional lift altitude applied by spiral and elevate modes.
 * @param {number} [options.spiralTurns=1] - Number of spiral turns for spiral modes.
 * @param {number} [options.radiusMeters] - Optional spiral radius override.
 * @param {Cartesian3[]} [options.controlPoints] - Optional cubic Bezier control points.
 * @returns {{mode: string, distanceMeters: number, sampleCount: number, samples: Cartesian3[], sampleAt: function(number): Cartesian3|null}}
 */
export const buildCameraTransferPath = ({
                                            start,
                                            end,
                                            mode = 'direct',
                                            sampleCount = 48,
                                            liftMeters = null,
                                            spiralTurns = 1,
                                            radiusMeters = null,
                                            controlPoints = null,
                                            antiCollisionBounds = null,
                                            safetyProfile = null,
                                            frameResolver = null,
                                        } = {}) => {
    if (!isCartesian3Like(start) || !isCartesian3Like(end)) {
        return null
    }

    const pathMode = mode ?? 'direct'
    const safetyScale = clamp(finiteNumber(safetyProfile?.zoneScale) ?? 1, 0.75, 1.75)
    const pointsCount = Math.max(
        CAMERA_TRANSFER_MIN_SAMPLES,
        Math.round((Math.round(sampleCount) || CAMERA_TRANSFER_MIN_SAMPLES) * safetyScale),
    )
    const distanceMeters = Cartesian3.distance(start, end)
    const pathOptions = {
        liftMeters,
        spiralTurns,
        radiusMeters,
        controlPoints,
        antiCollisionBounds,
        safetyProfile,
    }

    const sampleAt = (ratio) => pathPositionAt(pathMode, start, end, ratio, pathOptions)
    const samples = Array.from({length: pointsCount}, (_, index) => sampleAt(pointsCount === 1 ? 1 : index / (pointsCount - 1)))

    const path = {
        mode: pathMode,
        distanceMeters,
        sampleCount: pointsCount,
        samples,
        sampleAt,
        antiCollisionBounds,
        safetyProfile,
        frameResolver,
        flyTo: ({
                    camera,
                    target,
                    orientation = null,
                    duration = 1,
                    complete = null,
                    cancel = null,
                    beforeFrame = null,
                    afterFrame = null,
                    cadence = 'frame',
                } = {}) => {
            if (!camera?.setView) {
                return false
            }

            let cancelled = false
            let frameHandle = null
            const useTimeCadence = cadence === 'time'
            const requestFrame = useTimeCadence
                ? callback => globalThis.setTimeout?.(callback, 16) ?? null
                : globalThis.requestAnimationFrame
                  ? callback => globalThis.requestAnimationFrame(callback)
                  : callback => globalThis.setTimeout?.(callback, 16) ?? null
            const cancelFrame = handle => {
                if (handle === null) {
                    return
                }

                globalThis.cancelAnimationFrame?.(handle)
                globalThis.clearTimeout?.(handle)
            }
            const startTime = globalThis.performance?.now?.() ?? Date.now()
            const durationMs = Math.max(1, Math.round((finiteNumber(duration) ?? 1) * 1000))

            const tick = () => {
                if (cancelled) {
                    return
                }

                const ratio = clamp(((globalThis.performance?.now?.() ?? Date.now()) - startTime) / durationMs, 0, 1)
                const view = cameraTransferViewAt(path, target, ratio, orientation)
                if (view) {
                    beforeFrame?.(view)
                    camera.setView(view)
                    afterFrame?.(view)
                }

                if (ratio >= 1) {
                    cancelled = true
                    frameHandle = null
                    complete?.()
                    return
                }

                frameHandle = requestFrame(tick)
            }

            frameHandle = requestFrame(tick)
            return () => {
                cancelled = true
                if (frameHandle !== null) {
                    cancelFrame(frameHandle)
                    frameHandle = null
                }
                cancel?.()
            }
        },
    }

    return path
}

/**
 * Sample a reusable camera transfer path at a given progress ratio.
 *
 * @param {{sampleAt?: function(number): Cartesian3|null}|null} path - Path object returned by `buildCameraTransferPath`.
 * @param {number} ratio - Progress ratio between 0 and 1.
 * @returns {Cartesian3|null} Sampled position.
 */
export const cameraTransferSampleAt = (path, ratio) => path?.sampleAt?.(ratio) ?? null

/**
 * Build a Cesium camera view for a transfer path sample.
 *
 * An explicit orientation keeps heading, pitch, and roll independent from the
 * transfer target. This is required by panorama moves, whose final camera
 * position is also the panorama pivot and therefore cannot be used as a
 * look-at target.
 *
 * @param {{sampleAt?: function(number): Cartesian3|null}|null} path - Path object returned by `buildCameraTransferPath`.
 * @param {Cartesian3|null} target - Optional world target to keep framed.
 * @param {number} ratio - Progress ratio between 0 and 1.
 * @param {object|function|null} orientation - Fixed orientation or orientation resolver.
 * @returns {{destination: Cartesian3, orientation: object}|null} Cesium camera view.
 */
const cameraTransferViewAt = (path, target, ratio, orientation = null) => {
    const destination = cameraTransferSampleAt(path, ratio)
    if (!isCartesian3Like(destination)) {
        return null
    }

    const resolvedOrientation = typeof orientation === 'function'
                                ? orientation({
                                      path,
                                      target,
                                      ratio,
                                      destination,
                                  })
                                : orientation
    if (resolvedOrientation) {
        return {
            destination,
            orientation: resolvedOrientation,
        }
    }

    const frame = cameraTransferFrameAt(path, target, ratio)
    if (!frame) {
        return null
    }

    return {
        destination: frame.destination,
        orientation: {
            direction: frame.direction,
            up:        frame.up,
        },
    }
}

/**
 * Build a camera frame for a transfer path sample so the camera keeps looking
 * at the provided target while it moves.
 *
 * @param {{sampleAt?: function(number): Cartesian3|null}|null} path - Path object returned by `buildCameraTransferPath`.
 * @param {Cartesian3} target - World target to keep framed.
 * @param {number} ratio - Progress ratio between 0 and 1.
 * @returns {{destination: Cartesian3, direction: Cartesian3, up: Cartesian3}|null}
 */
export const cameraTransferFrameAt = (path, target, ratio) => {
    if (!path || !isCartesian3Like(target)) {
        return null
    }

    const destination = cameraTransferSampleAt(path, ratio)
    if (!isCartesian3Like(destination)) {
        return null
    }

    const targetTransform = Transforms.eastNorthUpToFixedFrame(target)
    const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
    const north = Matrix4.getColumn(targetTransform, 1, new Cartesian3())
    const up = Matrix4.getColumn(targetTransform, 2, new Cartesian3())
    const direction = Cartesian3.normalize(
        Cartesian3.subtract(target, destination, new Cartesian3()),
        new Cartesian3(),
    )
    const rightCandidate = Cartesian3.cross(direction, up, new Cartesian3())
    const right = Cartesian3.magnitudeSquared(rightCandidate) > Number.EPSILON
                  ? Cartesian3.normalize(rightCandidate, rightCandidate)
                  : Cartesian3.clone(east, new Cartesian3())
    const correctedUp = Cartesian3.normalize(
        Cartesian3.cross(right, direction, new Cartesian3()),
        new Cartesian3(),
    )

    let frame = {
        destination,
        direction,
        up: correctedUp,
    }

    if (typeof path?.frameResolver === 'function') {
        const resolvedFrame = path.frameResolver({
            path,
            target,
            ratio,
            frame,
        })
        if (resolvedFrame && isCartesian3Like(resolvedFrame.destination) && isCartesian3Like(resolvedFrame.direction) && isCartesian3Like(resolvedFrame.up)) {
            frame = resolvedFrame
        }
    }

    return frame
}
