/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughClips.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-07
 * Last modified: 2026-06-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const FLYTHROUGH_CLIP_SLOT_START = 'start'
export const FLYTHROUGH_CLIP_SLOT_STOP = 'stop'
export const FLYTHROUGH_CLIP_SLOT_BOTH = 'both'

export const FLYTHROUGH_CLIP_SLOT_VALUES = [
    FLYTHROUGH_CLIP_SLOT_START,
    FLYTHROUGH_CLIP_SLOT_STOP,
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

const normalizeSlots = (slots = []) => {
    const values = Array.isArray(slots) ? slots : [slots]
    const normalized = values
        .map(slot => `${slot ?? ''}`.toLowerCase())
        .filter(slot => slot === FLYTHROUGH_CLIP_SLOT_START || slot === FLYTHROUGH_CLIP_SLOT_STOP)
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
    const slots = normalizeSlots(definition.slots ?? [FLYTHROUGH_CLIP_SLOT_BOTH])
    const defaults = safeClone(definition.defaults ?? {})
    const fields = Array.isArray(definition.fields)
                    ? definition.fields.map(normalizeField)
                    : []

    return {
        id,
        label,
        description: definition.description ?? '',
        slots,
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
    const resolvedSlot = normalizeSlots([instance.slot ?? slot ?? targetDefinition?.slots?.[0] ?? FLYTHROUGH_CLIP_SLOT_START])[0]

    return {
        id: instance.id ?? uniqueId(clipId ?? 'clip'),
        clipId,
        slot: resolvedSlot,
        enabled: instance.enabled !== false,
        params: normalizeParams(targetDefinition, instance.params ?? instance.values ?? {}),
    }
}

export const defaultFlythroughClips = () => {
    return {
        catalog: {},
        start: [],
        stop:   [],
    }
}

export const normalizeFlythroughClips = (clips = {}) => {
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
            const definition = catalog[item?.clipId ?? item?.id ?? null]
            if (!definition) {
                continue
            }
            const instance = normalizeInstance(item, definition, slot)
            if (definition.slots.includes(slot) || definition.slots.includes(FLYTHROUGH_CLIP_SLOT_BOTH)) {
                normalized.push(instance)
            }
        }
        return normalized
    }

    const start = normalizeList(startList, FLYTHROUGH_CLIP_SLOT_START)
    const stop = normalizeList(stopList, FLYTHROUGH_CLIP_SLOT_STOP)

    return {
        catalog,
        start,
        stop,
    }
}

export const createFlythroughClipInstance = (clipDefinition, slot, overrides = {}) => {
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

export const flythroughClipsForSlot = (clips = {}, slot = FLYTHROUGH_CLIP_SLOT_START) => {
    const normalized = normalizeFlythroughClips(clips)
    return Object.values(normalized.catalog).filter(definition => definition.slots.includes(slot) || definition.slots.includes(FLYTHROUGH_CLIP_SLOT_BOTH))
}

export const availableFlythroughClipsForSlot = (clips = {}, slot = FLYTHROUGH_CLIP_SLOT_START) => {
    const definitions = flythroughClipsForSlot(clips, slot)
    const available = definitions.filter(definition => canAddFlythroughClip(clips, definition, slot))
    return available.length > 0 ? available : null
}

export const flythroughClipInstanceCount = (clips = {}, clipId, slot = null) => {
    const normalized = normalizeFlythroughClips(clips)
    const list = slot === FLYTHROUGH_CLIP_SLOT_STOP
                 ? normalized.stop
                 : slot === FLYTHROUGH_CLIP_SLOT_START
                   ? normalized.start
                   : [...normalized.start, ...normalized.stop]
    const count = list.filter(instance => instance.clipId === clipId).length
    return count
}

export const canAddFlythroughClip = (clips = {}, clipDefinition, slot) => {
    const catalog = normalizeFlythroughClips(clips).catalog
    const definition = typeof clipDefinition === 'string'
                       ? catalog[clipDefinition]
                       : normalizeDefinition(clipDefinition)
    if (!definition) {
        return false
    }

    const allowedSlots = definition.slots.includes(FLYTHROUGH_CLIP_SLOT_BOTH)
                         ? [FLYTHROUGH_CLIP_SLOT_START, FLYTHROUGH_CLIP_SLOT_STOP]
                         : definition.slots
    const maxInstances = definition.maxInstances
    if (!allowedSlots.includes(slot)) {
        return false
    }

    if (!Number.isFinite(Number(maxInstances)) || Number(maxInstances) <= 0) {
        return true
    }

    const count = flythroughClipInstanceCount(clips, definition.id, slot)
    const result = count < Number(maxInstances)
    return result
}
