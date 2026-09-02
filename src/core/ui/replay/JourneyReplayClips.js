/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayClips.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-07
 * Last modified: 2026-09-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const REPLAY_CLIP_SLOT_PRE_REPLAY = 'pre-replay'
export const REPLAY_CLIP_SLOT_POST_REPLAY = 'post-replay'
export const REPLAY_CLIP_SLOT_BOTH = 'both'

/**
 * Backwards-compatible alias for the pre-Replay slot constant.
 *
 * @deprecated Use REPLAY_CLIP_SLOT_PRE_REPLAY.
 */
export const REPLAY_CLIP_SLOT_START = REPLAY_CLIP_SLOT_PRE_REPLAY

/**
 * Backwards-compatible alias for the post-Replay slot constant.
 *
 * @deprecated Use REPLAY_CLIP_SLOT_POST_REPLAY.
 */
export const REPLAY_CLIP_SLOT_STOP = REPLAY_CLIP_SLOT_POST_REPLAY

export const REPLAY_CLIP_SLOT_VALUES = [
    REPLAY_CLIP_SLOT_PRE_REPLAY,
    REPLAY_CLIP_SLOT_POST_REPLAY,
]


const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clampNumber = (value, fallback, min, max, rounded = false) => {
    const number = Math.min(max, Math.max(min, finiteNumber(value) ?? fallback))
    return rounded ? Math.ceil(number) : number
}

const safeClone = value => {
    if (value === null || value === undefined) {
        return value
    }

    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value)
        }
        catch {
            // Fall through to JSON cloning below.
        }
    }

    return JSON.parse(JSON.stringify(value))
}

const uniqueId = prefix => `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`

const normalizeSlotValue = slot => {
    const value = `${slot ?? ''}`.toLowerCase()
    return value === 'start'
        ? REPLAY_CLIP_SLOT_PRE_REPLAY
        : value === 'stop' ? REPLAY_CLIP_SLOT_POST_REPLAY : value
}

const normalizeSlots = (slots = []) => {
    const values = Array.isArray(slots) ? slots : [slots]
    const normalized = values
        .map(normalizeSlotValue)
        .filter(slot => REPLAY_CLIP_SLOT_VALUES.includes(slot))
    return Array.from(new Set(normalized))
}

const normalizeField = (field = {}) => ({
    key:        field.key ?? field.name ?? null,
    label:      field.label ?? field.key ?? field.name ?? '',
    type:       field.type ?? 'number',
    unit:       field.unit ?? null,
    min:        finiteNumber(field.min),
    max:        finiteNumber(field.max),
    step:       finiteNumber(field.step),
    options:    Array.isArray(field.options) ? field.options.map(option => ({
        value: option?.value ?? option,
        label: option?.label ?? `${option?.value ?? option}`,
    })) : [],
    placeholder: field.placeholder ?? '',
})

const normalizeDefinition = (definition = {}) => {
    const id = definition.id ?? null
    const label = definition.label ?? id ?? ''
    const slots = normalizeSlots(definition.slots ?? [REPLAY_CLIP_SLOT_BOTH])
    const defaults = safeClone(definition.defaults ?? {})
    const fields = Array.isArray(definition.fields)
                    ? definition.fields.map(normalizeField)
                    : []

    return {
        id,
        label,
        icon: definition.icon ?? null,
        description: definition.description ?? '',
        slots,
        resizable: definition.resizable !== false,
        maxInstances: Number.isFinite(Number(definition.maxInstances))
                      && Number(definition.maxInstances) > 0
                      ? Math.max(1, Math.floor(Number(definition.maxInstances)))
                      : null,
        defaults,
        fields,
    }
}

const normalizeParams = (definition, params = {}) => {
    const defaults = safeClone(definition?.defaults ?? {})
    const result = {
        ...defaults,
        ...(params ?? {}),
    }

    for (const field of definition?.fields ?? []) {
        const key = field.key ?? field.name
        if (!key) {
            continue
        }

        if (field.type === 'number') {
            const fallback = finiteNumber(defaults[key]) ?? finiteNumber(result[key]) ?? 0
            const min = finiteNumber(field.min) ?? Number.NEGATIVE_INFINITY
            const max = finiteNumber(field.max) ?? Number.POSITIVE_INFINITY
            const rounded = field.step !== null && field.step !== undefined && Number(field.step) >= 1
            result[key] = clampNumber(result[key], fallback, min, max, rounded)
        }
    }

    return result
}

const normalizeInstance = (instance = {}, definition = null, slot = null) => {
    const targetDefinition = definition ?? null
    const clipId = instance.clipId ?? targetDefinition?.id ?? null
    const resolvedSlot = normalizeSlots([instance.slot ?? slot ?? targetDefinition?.slots?.[0] ?? REPLAY_CLIP_SLOT_PRE_REPLAY])[0]

    return {
        id: instance.id ?? uniqueId(clipId ?? 'clip'),
        clipId,
        slot: resolvedSlot,
        enabled: instance.enabled !== false,
        resizable: instance.resizable ?? targetDefinition?.resizable !== false,
        params: normalizeParams(targetDefinition, instance.params ?? instance.values ?? {}),
    }
}

export const defaultJourneyReplayClips = () => {
    return {
        catalog: {},
        start: [],
        stop:   [],
    }
}

export const normalizeJourneyReplayClips = (clips = {}) => {
    const sourceCatalog = clips?.catalog ?? clips?.definitions ?? {}
    const catalog = {}
    for (const [id, definition] of Object.entries(sourceCatalog ?? {})) {
        catalog[id] = normalizeDefinition({
            ...definition,
            id,
        })
    }
    const startList = Array.isArray(clips?.start) ? clips.start : []
    const stopList = Array.isArray(clips?.stop) ? clips.stop : []

    const normalizeList = (list, slot) => {
        const normalized = []
        for (const item of Array.isArray(list) ? list : []) {
            const sourceId = item?.clipId ?? item?.id ?? null
            const clipId = sourceId === 'launch' && catalog['take-off'] ? 'take-off' : sourceId
            const definition = catalog[clipId] ?? catalog[sourceId]
            if (!definition) {
                continue
            }
            const instance = normalizeInstance(item, definition, slot)
            if (definition.slots.includes(slot) || definition.slots.includes(REPLAY_CLIP_SLOT_BOTH)) {
                normalized.push(instance)
            }
        }
        return normalized
    }

    const start = normalizeList(startList, REPLAY_CLIP_SLOT_PRE_REPLAY)
    const stop = normalizeList(stopList, REPLAY_CLIP_SLOT_POST_REPLAY)

    return {
        catalog,
        start,
        stop,
    }
}

export const createJourneyReplayClipInstance = (clipDefinition, slot, overrides = {}) => {
    const definition = typeof clipDefinition === 'string'
                       ? null
                       : normalizeDefinition(clipDefinition)

    if (!definition) {
        return null
    }

    return normalizeInstance({
        ...overrides,
        clipId: definition.id,
        slot,
    }, definition, slot)
}

export const replayClipsForSlot = (clips = {}, slot = REPLAY_CLIP_SLOT_PRE_REPLAY) => {
    const normalized = normalizeJourneyReplayClips(clips)
    const normalizedSlot = normalizeSlotValue(slot)
    return Object.values(normalized.catalog).filter(definition => definition.slots.includes(normalizedSlot) || definition.slots.includes(REPLAY_CLIP_SLOT_BOTH))
}

export const availableJourneyReplayClipsForSlot = (clips = {}, slot = REPLAY_CLIP_SLOT_PRE_REPLAY) => {
    const definitions = replayClipsForSlot(clips, slot)
    const available = definitions.filter(definition => canAddJourneyReplayClip(clips, definition, slot))
    return available.length > 0 ? available : null
}

export const replayClipInstanceCount = (clips = {}, clipId, slot = null) => {
    const normalized = normalizeJourneyReplayClips(clips)
    const normalizedSlot = normalizeSlotValue(slot)
    const list = normalizedSlot === REPLAY_CLIP_SLOT_POST_REPLAY
                 ? normalized.stop
                 : normalizedSlot === REPLAY_CLIP_SLOT_PRE_REPLAY
                   ? normalized.start
                   : [...normalized.start, ...normalized.stop]
    const count = list.filter(instance => instance.clipId === clipId).length
    return count
}

export const canAddJourneyReplayClip = (clips = {}, clipDefinition, slot) => {
    const catalog = normalizeJourneyReplayClips(clips).catalog
    const definition = typeof clipDefinition === 'string'
                       ? catalog[clipDefinition]
                       : normalizeDefinition(clipDefinition)
    if (!definition) {
        return false
    }

    const normalizedSlot = normalizeSlotValue(slot)
    const allowedSlots = definition.slots.includes(REPLAY_CLIP_SLOT_BOTH)
                         ? [REPLAY_CLIP_SLOT_PRE_REPLAY, REPLAY_CLIP_SLOT_POST_REPLAY]
                         : definition.slots
    const maxInstances = definition.maxInstances
    if (!allowedSlots.includes(normalizedSlot)) {
        return false
    }

    if (!Number.isFinite(Number(maxInstances)) || Number(maxInstances) <= 0) {
        return true
    }

    const count = replayClipInstanceCount(clips, definition.id, normalizedSlot)
    const result = count < Number(maxInstances)
    return result
}
