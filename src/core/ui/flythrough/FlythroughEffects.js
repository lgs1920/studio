/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughEffects.js
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

export const FLYTHROUGH_EFFECT_SLOT_START = 'start'
export const FLYTHROUGH_EFFECT_SLOT_STOP = 'stop'
export const FLYTHROUGH_EFFECT_SLOT_BOTH = 'both'

export const FLYTHROUGH_EFFECT_SLOT_VALUES = [
    FLYTHROUGH_EFFECT_SLOT_START,
    FLYTHROUGH_EFFECT_SLOT_STOP,
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
        .filter(slot => slot === FLYTHROUGH_EFFECT_SLOT_START || slot === FLYTHROUGH_EFFECT_SLOT_STOP)
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
    const slots = normalizeSlots(definition.slots ?? [FLYTHROUGH_EFFECT_SLOT_BOTH])
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
    const effectId = instance.effectId ?? instance.effect ?? targetDefinition?.id ?? null
    const resolvedSlot = normalizeSlots([instance.slot ?? slot ?? targetDefinition?.slots?.[0] ?? FLYTHROUGH_EFFECT_SLOT_START])[0]

    return {
        id: instance.id ?? uniqueId(effectId ?? 'effect'),
        effectId,
        slot: resolvedSlot,
        enabled: instance.enabled !== false,
        params: normalizeParams(targetDefinition, instance.params ?? instance.values ?? {}),
    }
}

export const defaultFlythroughEffects = () => {
    return {
        catalog: {},
        start: [],
        stop:   [],
    }
}

export const normalizeFlythroughEffects = (effects = {}) => {
    const sourceCatalog = effects?.catalog ?? effects?.definitions ?? {}
    const catalog = {}
    for (const [id, definition] of Object.entries(sourceCatalog ?? {})) {
        catalog[id] = normalizeDefinition({
            ...definition,
            id,
        })
    }
    const startList = Array.isArray(effects?.start) ? effects.start : []
    const stopList = Array.isArray(effects?.stop) ? effects.stop : []

    const normalizeList = (list, slot) => {
        const normalized = []
        for (const item of Array.isArray(list) ? list : []) {
            const definition = catalog[item?.effectId ?? item?.effect ?? item?.id ?? item?.effectKey ?? null]
            if (!definition) {
                continue
            }
            const instance = normalizeInstance(item, definition, slot)
            if (definition.slots.includes(slot) || definition.slots.includes(FLYTHROUGH_EFFECT_SLOT_BOTH)) {
                normalized.push(instance)
            }
        }
        return normalized
    }

    const start = normalizeList(startList, FLYTHROUGH_EFFECT_SLOT_START)
    const stop = normalizeList(stopList, FLYTHROUGH_EFFECT_SLOT_STOP)

    return {
        catalog,
        start,
        stop,
    }
}

export const createFlythroughEffectInstance = (effectDefinition, slot, overrides = {}) => {
    const definition = typeof effectDefinition === 'string'
                       ? null
                       : normalizeDefinition(effectDefinition)

    if (!definition) {
        return null
    }

    return normalizeInstance({
        ...overrides,
        effectId: definition.id,
        slot,
    }, definition, slot)
}

export const flythroughEffectsForSlot = (effects = {}, slot = FLYTHROUGH_EFFECT_SLOT_START) => {
    const normalized = normalizeFlythroughEffects(effects)
    return Object.values(normalized.catalog).filter(definition => definition.slots.includes(slot) || definition.slots.includes(FLYTHROUGH_EFFECT_SLOT_BOTH))
}

export const availableFlythroughEffectsForSlot = (effects = {}, slot = FLYTHROUGH_EFFECT_SLOT_START) => {
    const definitions = flythroughEffectsForSlot(effects, slot)
    const available = definitions.filter(definition => canAddFlythroughEffect(effects, definition, slot))
    return available.length > 0 ? available : null
}

export const flythroughEffectInstanceCount = (effects = {}, effectId, slot = null) => {
    const normalized = normalizeFlythroughEffects(effects)
    const list = slot === FLYTHROUGH_EFFECT_SLOT_STOP
                 ? normalized.stop
                 : slot === FLYTHROUGH_EFFECT_SLOT_START
                   ? normalized.start
                   : [...normalized.start, ...normalized.stop]
    const count = list.filter(instance => instance.effectId === effectId).length
    return count
}

export const canAddFlythroughEffect = (effects = {}, effectDefinition, slot) => {
    const catalog = normalizeFlythroughEffects(effects).catalog
    const definition = typeof effectDefinition === 'string'
                       ? catalog[effectDefinition]
                       : normalizeDefinition(effectDefinition)
    if (!definition) {
        return false
    }

    const allowedSlots = definition.slots.includes(FLYTHROUGH_EFFECT_SLOT_BOTH)
                         ? [FLYTHROUGH_EFFECT_SLOT_START, FLYTHROUGH_EFFECT_SLOT_STOP]
                         : definition.slots
    const maxInstances = definition.maxInstances
    if (!allowedSlots.includes(slot)) {
        return false
    }

    if (!Number.isFinite(Number(maxInstances)) || Number(maxInstances) <= 0) {
        return true
    }

    const count = flythroughEffectInstanceCount(effects, definition.id, slot)
    const result = count < Number(maxInstances)
    return result
}
