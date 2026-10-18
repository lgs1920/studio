/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: trackTerrainSections.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-18
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Detect longitudinal terrain breaks and build coherent lateral correction sections.
 * Source GPX coordinates and elevations remain immutable throughout this process.
 */

const BREAK_WINDOW_METERS = 30
const BORDER_ERROR_THRESHOLD_METERS = 20
const MATCH_TOLERANCE_METERS = 5
const MAX_SECTION_OFFSETS = 32
const MAX_GEOMETRY_REFINEMENT_PASSES = 6
const MAX_TANGENT_REFINEMENT_METERS = 1
const REFERENCE_MINIMUM_SAMPLES = 32
const REFERENCE_MINIMUM_CONSENSUS = 0.7
const REFERENCE_MINIMUM_ELEVATION_SPAN_METERS = 20
const REFERENCE_MINIMUM_OFFSET_METERS = 10
const REFERENCE_MAXIMUM_OFFSET_METERS = 100

/** Return the median of a finite numeric sample without mutating its input. */
const median = values => {
    const sorted = [...values].sort((first, second) => first - second)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Fit a common vertical comparison offset from a majority of stable border pairs.
 * This is robust registration, not an inferred geoid model: GPX elevations remain unchanged.
 * Short, flat, or inconsistent samples cannot establish a vertical reference.
 */
export const registerTerrainHeightReference = records => {
    const pairs = records.flatMap(record => {
        const heights = record.borderHeights
        if (!Number.isFinite(record.altitude) || heights?.length !== 2 || !heights.every(Number.isFinite)
            || Math.abs(heights[0] - heights[1]) > MATCH_TOLERANCE_METERS) {
            return []
        }
        return [{record, residual: (heights[0] + heights[1]) / 2 - record.altitude}]
    })
    let offsetMeters = 0
    let inlierCount = 0
    if (pairs.length >= REFERENCE_MINIMUM_SAMPLES) {
        const estimate = median(pairs.map(pair => pair.residual))
        const inliers = pairs.filter(pair => Math.abs(pair.residual - estimate) <= MATCH_TOLERANCE_METERS)
        const elevationRange = inliers.reduce((range, pair) => ({
            minimum: Math.min(range.minimum, pair.record.altitude),
            maximum: Math.max(range.maximum, pair.record.altitude),
        }), {minimum: Number.POSITIVE_INFINITY, maximum: Number.NEGATIVE_INFINITY})
        const altitudeSpan = elevationRange.maximum - elevationRange.minimum
        if (Math.abs(estimate) >= REFERENCE_MINIMUM_OFFSET_METERS && Math.abs(estimate) <= REFERENCE_MAXIMUM_OFFSET_METERS
            && inliers.length >= records.length * REFERENCE_MINIMUM_CONSENSUS && altitudeSpan >= REFERENCE_MINIMUM_ELEVATION_SPAN_METERS) {
            offsetMeters = median(inliers.map(pair => pair.residual))
            inlierCount = inliers.length
        }
    }
    records.forEach((record) => {
        record.heightReferenceOffsetMeters = offsetMeters
        record.terrainReferenceAltitude = record.altitude === null ? null : record.altitude + offsetMeters
    })
    return {offsetMeters, inlierCount, sampleCount: records.length}
}

/** Return the largest absolute terrain residual at either rendered border. */
const maximumBorderError = record => Math.max(...record.initialErrors.map(Math.abs))

/** Mark a terrain discrepancy without discarding an earlier, stronger detection. */
const triggerRecord = (record, reason, jumpMeters = 0) => {
    record.status = 'triggered'
    record.detectionReason ??= reason
    record.terrainBreakMeters = Math.max(record.terrainBreakMeters ?? 0, jumpMeters)
}

/** Split a route into contiguous blocks with usable GPX altitudes and terrain samples. */
const validRecordBlocks = (records, distanceBetween) => {
    const blocks = []
    let block = null
    records.forEach((record) => {
        if (record.altitude === null || record.bearing === null) {
            record.status = record.altitude === null ? 'missing-gpx-altitude' : 'insufficient-route-direction'
            block = null
            return
        }

        record.initialErrors = (record.borderHeights ?? []).map(height => (
            Number.isFinite(height) ? height - (record.terrainReferenceAltitude ?? record.altitude) : null
        ))
        if (record.initialErrors.length !== 2 || !record.initialErrors.every(Number.isFinite)) {
            record.status = 'terrain-unavailable'
            block = null
            return
        }

        const previous = block?.at(-1)
        const distance = previous ? distanceBetween(previous.coordinate, record.coordinate) : 0
        if (!block || distance > BREAK_WINDOW_METERS) {
            block = []
            blocks.push(block)
        }
        record.terrainBlockId = `${record.segmentIndex}:${blocks.length}`
        record.alongTrackMeters = (block.at(-1)?.alongTrackMeters ?? 0) + (block.length ? distance : 0)
        record.status = 'within-threshold'
        block.push(record)
    })
    return blocks
}

/** Detect residual changes over several GPX points instead of terrain height alone. */
const detectBlockBreaks = block => {
    block.forEach((record, index) => {
        if (maximumBorderError(record) > BORDER_ERROR_THRESHOLD_METERS) {
            triggerRecord(record, 'vertical-error')
        }
        for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
            const previous = block[previousIndex]
            if (record.alongTrackMeters - previous.alongTrackMeters > BREAK_WINDOW_METERS) {
                break
            }
            const jump = Math.max(...record.initialErrors.map((error, border) => (
                Math.abs(error - previous.initialErrors[border])
            )))
            if (jump <= BORDER_ERROR_THRESHOLD_METERS) {
                continue
            }
            for (let affectedIndex = previousIndex; affectedIndex <= index; affectedIndex += 1) {
                const affected = block[affectedIndex]
                if (maximumBorderError(affected) > MATCH_TOLERANCE_METERS) {
                    triggerRecord(affected, 'longitudinal-break', jump)
                }
            }
        }
    })

    // Hysteresis retains the onset and recovery of a confirmed break down to the matching tolerance.
    const seeds = block.flatMap((record, index) => record.status === 'triggered' ? [{record, index}] : [])
    seeds.forEach(({record: seed, index}) => {
        for (const direction of [-1, 1]) {
            for (let neighborIndex = index + direction; neighborIndex >= 0 && neighborIndex < block.length; neighborIndex += direction) {
                const neighbor = block[neighborIndex]
                if (Math.abs(neighbor.alongTrackMeters - seed.alongTrackMeters) > BREAK_WINDOW_METERS
                    || maximumBorderError(neighbor) <= MATCH_TOLERANCE_METERS) {
                    break
                }
                triggerRecord(neighbor, 'section-continuation', seed.terrainBreakMeters)
            }
        }
    })
}

/** Classify both borders and retain complete multi-point terrain-break sections. */
export const detectTerrainAlignmentSections = (records, {distanceBetween}) => {
    validRecordBlocks(records, distanceBetween).forEach((block) => {
        detectBlockBreaks(block)
        let section = []
        const sections = []
        block.forEach((record) => {
            if (record.status !== 'triggered') {
                section = []
                return
            }
            if (!section.length) {
                section = []
                sections.push(section)
            }
            section.push(record)
            const threshold = maximumBorderError(record) > BORDER_ERROR_THRESHOLD_METERS
                ? BORDER_ERROR_THRESHOLD_METERS
                : MATCH_TOLERANCE_METERS
            const [left, right] = record.initialErrors.map(error => Math.abs(error) > threshold)
            record.directions = left && !right ? [1] : right && !left ? [-1] : [-1, 1]
        })
        sections.forEach((points, index) => points.forEach((record) => {
            record.terrainSectionId = `${record.terrainBlockId}:${index}`
            record.terrainSectionSize = points.length
        }))
    })
}

/** Resolve bounded, distinct plateau offsets from the closest verified candidates of a section. */
const sectionOffsets = records => {
    const offsets = [...new Set(records.flatMap(record => record.candidateOptions.map(candidate => (
        candidate.offsetMeters.toFixed(3)
    ))))].map(Number).sort((first, second) => first - second)
    const selected = offsets.length <= MAX_SECTION_OFFSETS
        ? offsets
        : Array.from({length: MAX_SECTION_OFFSETS}, (_, index) => (
            offsets[Math.round(index * (offsets.length - 1) / (MAX_SECTION_OFFSETS - 1))]
        ))
    // Verified clearance alternatives avoid accepting a knife-edge fit that fails after the final tangent changes.
    return [...new Set(selected.flatMap(offset => [0, 0.5, 1, 2].map(clearance => (
        Number((Math.sign(offset) * (Math.abs(offset) + clearance)).toFixed(3))
    ))))]
}

/** Select diverse verified translations, plus their robust center, for shape-preserving section registration. */
const sectionTranslations = (records, displacementBetween) => {
    const unique = new Map()
    const clusters = new Map()
    records.forEach(record => record.candidateOptions.forEach(candidate => {
        const translation = displacementBetween(record.coordinate, candidate.correctedCoordinate)
        unique.set(`${translation.east.toFixed(1)}:${translation.north.toFixed(1)}`, translation)
        const cell = `${Math.round(translation.east / 10)}:${Math.round(translation.north / 10)}`
        const cluster = clusters.get(cell) ?? {east: [], north: [], records: new Set()}
        cluster.east.push(translation.east)
        cluster.north.push(translation.north)
        cluster.records.add(record.id)
        clusters.set(cell, cluster)
    }))
    const translations = [...unique.values()]
    if (translations.length === 0) {
        return []
    }
    const center = {east: median(translations.map(value => value.east)), north: median(translations.map(value => value.north))}
    const modes = [...clusters.values()].map(cluster => ({
        east: median(cluster.east),
        north: median(cluster.north),
        support: cluster.records.size,
    })).sort((first, second) => second.support - first.support)
    const selected = [center, ...modes]
    const deduplicated = []
    selected.forEach((translation) => {
        if (deduplicated.length >= MAX_SECTION_OFFSETS) {
            return
        }
        if (deduplicated.every(previous => Math.hypot(previous.east - translation.east, previous.north - translation.north) >= 2)) {
            deduplicated.push(translation)
        }
    })
    while (deduplicated.length < MAX_SECTION_OFFSETS) {
        let next = null
        let maximumDistance = 0
        translations.forEach(translation => {
            const distance = Math.min(...deduplicated.map(value => Math.hypot(value.east - translation.east, value.north - translation.north)))
            if (distance > maximumDistance) {
                maximumDistance = distance
                next = translation
            }
        })
        if (!next || maximumDistance < 0.1) {
            break
        }
        deduplicated.push(next)
    }
    return deduplicated
}

/** Add terrain-verified plateau alternatives and smooth entry/exit ramps around a detected section. */
export const addTerrainSectionCandidates = async (records, {sampleTrials, displacementBetween, translateCoordinate}) => {
    const sections = new Map()
    records.filter(record => record.status === 'triggered').forEach((record) => {
        const section = sections.get(record.terrainSectionId) ?? []
        section.push(record)
        sections.set(record.terrainSectionId, section)
    })
    const trials = []
    const trialKeys = new Set()
    sections.forEach((section, sectionId) => {
        if (section.length < 2) {
            return
        }
        const first = section[0]
        const last = section.at(-1)
        sectionOffsets(section).forEach((offset) => {
            const rampLength = Math.max(20, Math.abs(offset) * 2)
            records.forEach((record) => {
                if (record.terrainBlockId !== first.terrainBlockId
                    || !['triggered', 'within-threshold', 'support'].includes(record.status)) {
                    return
                }
                const distance = Math.max(first.alongTrackMeters - record.alongTrackMeters, record.alongTrackMeters - last.alongTrackMeters, 0)
                const progress = Math.max(0, 1 - distance / rampLength)
                const offsetMeters = offset * progress * progress * (3 - 2 * progress)
                if (Math.abs(offsetMeters) < 0.1
                    || (record.status === 'triggered' && !record.directions.includes(Math.sign(offsetMeters)))
                    || record.candidateOptions.some(candidate => Math.abs(candidate.offsetMeters - offsetMeters) < 0.1)) {
                    return
                }
                const key = `${record.id}:${offsetMeters.toFixed(3)}`
                if (trialKeys.has(key)) {
                    return
                }
                trialKeys.add(key)
                trials.push({record, offsetMeters, sectionId, support: record.status !== 'triggered'})
            })
        })
        // A shared east/north translation preserves bends that independent route-normal offsets can distort.
        sectionTranslations(section, displacementBetween).forEach(translation => {
            const rampLength = Math.max(20, Math.hypot(translation.east, translation.north) * 2)
            records.forEach(record => {
                if (record.terrainBlockId !== first.terrainBlockId
                    || !['triggered', 'within-threshold', 'support'].includes(record.status)) {
                    return
                }
                const distance = Math.max(first.alongTrackMeters - record.alongTrackMeters, record.alongTrackMeters - last.alongTrackMeters, 0)
                const progress = Math.max(0, 1 - distance / rampLength)
                const weight = progress * progress * (3 - 2 * progress)
                if (weight < 0.001) {
                    return
                }
                const delta = {east: translation.east * weight, north: translation.north * weight}
                const key = `${record.id}:xy:${delta.east.toFixed(1)}:${delta.north.toFixed(1)}`
                if (trialKeys.has(key)) {
                    return
                }
                trialKeys.add(key)
                trials.push({record, offsetMeters: 0, correctedCoordinate: translateCoordinate(record.coordinate, delta), sectionId, support: record.status !== 'triggered'})
            })
        })
        // Long cliff sections can bend: retain local registration modes instead of relying only on whole-section representatives.
        section.forEach(record => {
            const neighbors = section.filter(neighbor => Math.abs(neighbor.alongTrackMeters - record.alongTrackMeters) <= BREAK_WINDOW_METERS)
            sectionTranslations(neighbors, displacementBetween).forEach(delta => {
                const key = `${record.id}:xy:${delta.east.toFixed(1)}:${delta.north.toFixed(1)}`
                if (!trialKeys.has(key)) {
                    trialKeys.add(key)
                    trials.push({record, offsetMeters: 0, correctedCoordinate: translateCoordinate(record.coordinate, delta), sectionId, support: false})
                }
            })
        })
        // Carry the previous point's nearest valid correction onto the next GPX point. This gives
        // the path solver a terrain-checked starting position that preserves the local 2D shape.
        section.slice(1).forEach((record, index) => {
            const previous = section[index]
            const carriedByDirection = new Map()
            previous.candidateOptions
                .filter(candidate => !candidate.unchanged)
                .sort((first, second) => first.distanceMeters - second.distanceMeters)
                .forEach((candidate) => {
                    const direction = Math.sign(candidate.offsetMeters)
                    if (!direction || carriedByDirection.has(direction)) {
                        return
                    }
                    const delta = displacementBetween(previous.coordinate, candidate.correctedCoordinate)
                    if (Math.hypot(delta.east, delta.north) < 0.1) {
                        return
                    }
                    carriedByDirection.set(direction, delta)
                })
            carriedByDirection.forEach((delta) => {
                const key = `${record.id}:carry:${delta.east.toFixed(1)}:${delta.north.toFixed(1)}`
                if (trialKeys.has(key)) {
                    return
                }
                trialKeys.add(key)
                trials.push({
                    record,
                    offsetMeters: 0,
                    correctedCoordinate: translateCoordinate(record.coordinate, delta),
                    sectionId,
                    support: false,
                })
            })
        })
    })
    if (!trials.length) {
        return
    }
    const checks = await sampleTrials(trials)
    checks.forEach((check, index) => {
        if (!check?.candidate) {
            return
        }
        const trial = trials[index]
        const unavailable = [...(trial.record.unavailableDistanceByDirection?.values() ?? [])]
        if (unavailable.some(distance => check.candidate.distanceMeters >= distance - 1e-3)) {
            return
        }
        if (trial.record.candidateOptions.some(candidate => {
            const delta = displacementBetween(candidate.correctedCoordinate, check.candidate.correctedCoordinate)
            return Math.hypot(delta.east, delta.north) < 0.1
        })) {
            return
        }
        trial.record.candidateOptions.push({...check.candidate, support: trial.support, sectionId: trial.sectionId})
        if (trial.support) {
            trial.record.status = 'support'
        }
    })
}

/** Validate final tangents and corridor borders before corrected geometry reaches the renderer. */
export const validateTerrainSectionCorrections = async (records, {sampleTrials, bearingAt, displacementBetween, translateCoordinate}) => {
    // Re-evaluate nearby terrain matches against the tangent of the complete corrected path. At a bend,
    // a point's original route normal can rotate enough that its borders move off the terrain contour.
    for (let pass = 0; pass < MAX_GEOMETRY_REFINEMENT_PASSES; pass += 1) {
        const currentCoordinates = records.map(record => (
            record.geometryReconstructionRejected
                ? record.coordinate
                : record.selectedCandidate?.correctedCoordinate ?? record.coordinate
        ))
        const movedIndices = records.flatMap((record, index) => (
            record.selectedCandidate && !record.selectedCandidate.unchanged && !record.geometryReconstructionRejected
                ? [index]
                : []
        ))
        if (movedIndices.length === 0) {
            break
        }

        const tangentTrials = movedIndices.map(index => ({
            record: {...records[index], coordinate: currentCoordinates[index], bearing: bearingAt(currentCoordinates, index)},
            offsetMeters: 0,
        }))
        const tangentChecks = await sampleTrials(tangentTrials)
        const failedIndices = tangentChecks.flatMap((check, trialIndex) => check?.candidate
            ? []
            : [movedIndices[trialIndex]])
        if (failedIndices.length === 0) {
            break
        }

        let refinedAny = false
        for (const index of failedIndices) {
            const record = records[index]
            const current = record.selectedCandidate
            const followsNeighborGeometry = candidateCoordinate => [index - 1, index + 1].every((neighborIndex) => {
                const neighbor = records[neighborIndex]
                if (!neighbor) {
                    return true
                }
                const neighborCoordinate = neighbor.selectedCandidate?.correctedCoordinate ?? neighbor.coordinate
                const candidateOffset = displacementBetween(record.coordinate, candidateCoordinate)
                const neighborOffset = displacementBetween(neighbor.coordinate, neighborCoordinate)
                const offsetChange = Math.hypot(
                    candidateOffset.east - neighborOffset.east,
                    candidateOffset.north - neighborOffset.north,
                )
                const routeStep = displacementBetween(record.coordinate, neighbor.coordinate)
                return offsetChange <= Math.max(3, Math.hypot(routeStep.east, routeStep.north) * 2) + 1e-6
            })
            const alternatives = record.candidateOptions
                .filter(candidate => candidate !== current && !candidate.unchanged)
                .filter(candidate => followsNeighborGeometry(candidate.correctedCoordinate))
                .sort((first, second) => {
                    const firstDistance = displacementBetween(current.correctedCoordinate, first.correctedCoordinate)
                    const secondDistance = displacementBetween(current.correctedCoordinate, second.correctedCoordinate)
                    return Math.hypot(firstDistance.east, firstDistance.north) - Math.hypot(secondDistance.east, secondDistance.north)
                })
            const validationRecord = {
                ...record,
                coordinate: currentCoordinates[index],
                bearing: bearingAt(currentCoordinates, index),
            }
            const alternativeTrials = alternatives.map(candidate => ({
                record: validationRecord,
                offsetMeters: 0,
                correctedCoordinate: candidate.correctedCoordinate,
            }))
            const alternativeChecks = alternativeTrials.length > 0 ? await sampleTrials(alternativeTrials) : []
            const validIndex = alternativeChecks.findIndex(check => Boolean(check?.candidate))
            let selected = validIndex >= 0
                ? {
                    ...alternatives[validIndex],
                    maxVerticalErrorMeters: alternativeChecks[validIndex].candidate.maxVerticalErrorMeters,
                }
                : null

            // Refine a small border miss on a one-metre grid while preserving the point's along-track station.
            if (!selected) {
                const routeSpacing = [index - 1, index + 1].flatMap(neighborIndex => {
                    const neighbor = records[neighborIndex]
                    if (!neighbor) {
                        return []
                    }
                    const step = displacementBetween(record.coordinate, neighbor.coordinate)
                    return [Math.hypot(step.east, step.north)]
                })
                const radius = Math.max(3, ...routeSpacing.map(spacing => spacing * 2))
                const localTrials = []
                for (let east = -radius; east <= radius; east += 1) {
                    for (let north = -radius; north <= radius; north += 1) {
                        const distance = Math.hypot(east, north)
                        const alongTrackShift = (east * Math.sin(validationRecord.bearing))
                            + (north * Math.cos(validationRecord.bearing))
                        if (distance < 0.5 || distance > radius + 1e-6
                            || Math.abs(alongTrackShift) > MAX_TANGENT_REFINEMENT_METERS) {
                            continue
                        }
                        const correctedCoordinate = translateCoordinate(current.correctedCoordinate, {east, north})
                        if (!followsNeighborGeometry(correctedCoordinate)) {
                            continue
                        }
                        localTrials.push({
                            record: validationRecord,
                            offsetMeters: 0,
                            correctedCoordinate,
                            distance,
                        })
                    }
                }
                localTrials.sort((first, second) => first.distance - second.distance)
                const localChecks = await sampleTrials(localTrials)
                const localIndex = localChecks.findIndex(check => Boolean(check?.candidate))
                if (localIndex >= 0) {
                    const correctedCoordinate = localTrials[localIndex].correctedCoordinate
                    const displacement = displacementBetween(record.coordinate, correctedCoordinate)
                    const offsetMeters = displacement.east * Math.cos(record.bearing) - displacement.north * Math.sin(record.bearing)
                    selected = {
                        direction: Math.sign(offsetMeters),
                        offsetMeters,
                        distanceMeters: Math.hypot(displacement.east, displacement.north),
                        maxVerticalErrorMeters: localChecks[localIndex].candidate.maxVerticalErrorMeters,
                        correctedCoordinate,
                        sectionId: current.sectionId,
                        support: current.support,
                        geometryRefined: true,
                    }
                    record.candidateOptions.push(selected)
                }
            }

            if (!selected) {
                continue
            }
            record.selectedCandidate = selected
            refinedAny = true
        }
        if (!refinedAny) {
            break
        }
    }

    const coordinates = records.map(record => (
        record.geometryReconstructionRejected
            ? record.coordinate
            : record.selectedCandidate?.correctedCoordinate ?? record.coordinate
    ))
    const runs = []
    records.forEach((record, index) => {
        if (!record.selectedCandidate || record.selectedCandidate.unchanged || record.geometryReconstructionRejected) {
            return
        }
        const run = runs.at(-1)
        if (run && run.at(-1) >= index - 2) {
            run.push(index)
        }
        else {
            runs.push([index])
        }
    })
    const trials = runs.flatMap((run, runIndex) => {
        const indices = Array.from({length: run.at(-1) - run[0] + 3}, (_, index) => run[0] - 1 + index)
        return indices.flatMap((index) => {
            const record = records[index]
            if (!record || ['terrain-unavailable', 'missing-gpx-altitude', 'insufficient-route-direction'].includes(record.status)) {
                return []
            }
            return [{
                record: {...record, coordinate: coordinates[index], bearing: bearingAt(coordinates, index)},
                offsetMeters: 0,
                runIndex,
                moved: run.includes(index),
                sourceIndex: index,
            }]
        })
    })
    if (!trials.length) {
        return []
    }
    const checks = await sampleTrials(trials)
    const rejected = new Set()
    const invalidSelections = []
    checks.forEach((check, index) => {
        const trial = trials[index]
        const initialWithinThreshold = trial.record.initialErrors.every(error => Math.abs(error) <= BORDER_ERROR_THRESHOLD_METERS)
        // An unchanged unresolved point must not veto its repaired neighbors. Keep its existing per-border error budget,
        // while still rejecting any new degradation introduced by the neighboring corrections.
        const compatible = trial.moved
            ? Boolean(check?.candidate)
            : check?.profileAvailable && (!initialWithinThreshold || check.cliffSafe)
                && check.errors.every((error, border) => Number.isFinite(error) && Math.abs(error) <= Math.max(
                    BORDER_ERROR_THRESHOLD_METERS,
                    Math.abs(trial.record.initialErrors[border]) + (initialWithinThreshold ? 0 : MATCH_TOLERANCE_METERS),
                ))
        if (!compatible) {
            rejected.add(trial.runIndex)
            const indices = trial.moved ? [trial.sourceIndex] : [trial.sourceIndex - 1, trial.sourceIndex + 1]
            indices.forEach(sourceIndex => {
                const record = records[sourceIndex]
                if (record?.selectedCandidate && !record.selectedCandidate.unchanged) {
                    invalidSelections.push({record, candidate: record.selectedCandidate})
                }
            })
        }
    })
    // Roll back a connected correction together so a failed final sample cannot leave a torn route.
    rejected.forEach(runIndex => runs[runIndex].forEach((index) => {
        const record = records[index]
        record.geometryReconstructionRejected = record.status === 'triggered'
        delete record.selectedCandidate
    }))
    return invalidSelections
}
