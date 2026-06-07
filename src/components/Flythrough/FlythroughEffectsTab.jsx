/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughEffectsTab.jsx
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

import { PopupAnchor }                                             from '@Components/PopupAnchor'
import { PopupDrawer }                                             from '@Components/PopupDrawer'
import {
    createFlythroughEffectInstance,
    FLYTHROUGH_EFFECT_SLOT_START,
    FLYTHROUGH_EFFECT_SLOT_STOP,
    availableFlythroughEffectsForSlot,
    canAddFlythroughEffect,
    normalizeFlythroughEffects,
}                                                                  from '@Core/ui/flythrough/FlythroughEffects'
import { ELEVATION_UNITS, UnitUtils }                              from '@Utils/UnitUtils'
import {
    WaButton,
    WaCard,
    WaIcon,
    WaNumberInput,
    WaOption,
    WaSelect,
    WaTooltip,
}                                                                  from '@web.awesome.me/webawesome-pro/dist/react'
import Sortable                                                    from 'sortablejs'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                             from 'valtio'

const ADD_POPUP_SUFFIX = 'add-popup-anchor'
const EDIT_POPUP_SUFFIX = 'edit-popup-anchor'
const FLYTHROUGH_EFFECTS_DEBUG = true

const logFlythroughEffectsTab = (...args) => {
    if (FLYTHROUGH_EFFECTS_DEBUG) {
        console.debug('[FlythroughEffectsTab]', ...args)
    }
}

const listNameForSlot = slot => (slot === FLYTHROUGH_EFFECT_SLOT_STOP ? 'stop' : 'start')

const clone = value => JSON.parse(JSON.stringify(value))

const emptyAddState = () => ({
    open:     false,
    anchorId: null,
    slot:     FLYTHROUGH_EFFECT_SLOT_START,
})

const emptyEditorState = () => ({
    open:       false,
    anchorId:   null,
    slot:       FLYTHROUGH_EFFECT_SLOT_START,
    mode:       'add',
    index:      null,
    effectId:   null,
    params:     {},
    definition: null,
})

const hasCatalogEntries = catalog => Boolean(catalog) && Object.keys(catalog).length > 0

const resolveFlythroughEffectsCatalog = (settings = {}) => {
    const candidates = [
        settings?.effects?.catalog,
        settings?.effects?.definitions,
    ]

    return candidates.find(hasCatalogEntries) ?? {}
}

const syncEffects = (nextEffects) => {
    const normalized = normalizeFlythroughEffects(nextEffects)
    const journey = globalThis.lgs?.theJourney ?? globalThis.lgs?.stores?.main?.theJourney
    const runtime = globalThis.lgs?.stores?.flythrough

    const applyRuntime = target => {
        if (!target) {
            return
        }

        target.effects = normalized
    }

    if (journey) {
        if (!journey.flythrough || typeof journey.flythrough !== 'object') {
            journey.flythrough = {}
        }

        journey.flythrough.start = normalized.start
        journey.flythrough.stop = normalized.stop
        void journey.persistToDatabase?.()
    }

    applyRuntime(runtime)

    return normalized
}

const readDefinitions = (effects, slot) => availableFlythroughEffectsForSlot(effects, slot)

const readCurrentEffects = (settings, journey) => {
    const settingsEffects = normalizeFlythroughEffects({
                                                           catalog: resolveFlythroughEffectsCatalog(settings),
                                                       })
    const journeyFlythrough = journey?.flythrough ?? {}
    const start = Array.isArray(journeyFlythrough.start) ? journeyFlythrough.start : []
    const stop = Array.isArray(journeyFlythrough.stop) ? journeyFlythrough.stop : []
    const normalized = normalizeFlythroughEffects({
                                                      catalog: settingsEffects.catalog,
                                                      start,
                                                      stop,
                                                  })

    logFlythroughEffectsTab('readCurrentEffects', {
        journeySlug:       journey?.slug ?? null,
        catalogSize:       Object.keys(settingsEffects.catalog ?? {}).length,
        journeyStartCount: start.length,
        journeyStopCount:  stop.length,
        normalizedStart:   normalized.start.map(effect => effect.effectId),
        normalizedStop:    normalized.stop.map(effect => effect.effectId),
    })

    return {
        ...normalized,
        catalog: settingsEffects.catalog,
        start,
        stop,
    }
}

const EffectField = ({field, value, onChange, unitSystem = 0}) => {
    const elevationUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[0]
    const usesElevationUnit = field.unit === 'm'
    const displayUnit = usesElevationUnit ? elevationUnit : field.unit
    const displayValue = usesElevationUnit
                         ? Math.round(UnitUtils.convert(value ?? 0).to(displayUnit))
                         : value
    const displayMin = usesElevationUnit && field.min !== null && field.min !== undefined
                       ? Math.round(UnitUtils.convert(field.min).to(displayUnit))
                       : field.min
    const displayMax = usesElevationUnit && field.max !== null && field.max !== undefined
                       ? Math.round(UnitUtils.convert(field.max).to(displayUnit))
                       : field.max
    const displayStep = usesElevationUnit && field.step !== null && field.step !== undefined
                        ? Math.max(1, Math.round(UnitUtils.convert(field.step).to(displayUnit)))
                        : field.step ?? 1
    const commonProps = {
        label:            `${field.label}${displayUnit ? ` (${displayUnit})` : ''}`,
        size:             's',
        'label-at-start': true,
    }

    const controlClassName = 'flythrough-effects-field-control'

    if (field.type === 'select') {
        return (
            <div className="flythrough-effects-editor-field">
                <WaSelect
                    {...commonProps}
                    appearance="filled"
                    value={displayValue}
                    onChange={event => onChange(event.target.value)}
                    className={`${controlClassName} half-width`}
                >
                    {field.options.map(option => (
                        <WaOption key={String(option.value)} value={option.value}>
                            {option.label}
                        </WaOption>
                    ))}
                </WaSelect>
            </div>
        )
    }

    return (
        <div className="flythrough-effects-editor-field">
            <WaNumberInput
                {...commonProps}
                appearance="filled"
                min={displayMin}
                max={displayMax}
                step={displayStep}
                value={displayValue}
                onInput={event => {
                    const rawValue = event.target.value
                    onChange(usesElevationUnit ? UnitUtils.revert(rawValue, displayUnit) : rawValue)
                }}
                className={`${controlClassName} half-width`}
            />
        </div>
    )
}

const EffectEditorPopup = ({effects, editor, setEditor, onSave}) => {
    const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
    const normalized = useMemo(() => normalizeFlythroughEffects(effects), [effects])
    const definitions = useMemo(() => readDefinitions(effects, editor.slot) ?? [], [effects, editor.slot])
    const definition = editor.definition ?? (editor.effectId ? normalized.catalog[editor.effectId] : null)

    useEffect(() => {
        if (!editor.open || editor.mode !== 'add' || editor.effectId) {
            return
        }

        const nextDefinition = definitions[0] ?? null
        if (!nextDefinition) {
            return
        }

        setEditor(current => ({
            ...current,
            effectId: current.effectId ?? nextDefinition.id,
            params:   current.effectId ? current.params : {...nextDefinition.defaults},
        }))
    }, [definitions, editor.effectId, editor.mode, editor.open, setEditor])

    const close = useCallback(() => {
        setEditor(emptyEditorState())
    }, [setEditor])

    const save = useCallback(() => {
        if (!definition) {
            logFlythroughEffectsTab('editor-save-abort-no-definition', {
                slot:     editor.slot,
                mode:     editor.mode,
                effectId: editor.effectId,
            })
            close()
            return
        }

        const current = clone(effects ?? {})
        const normalizedCurrent = normalizeFlythroughEffects(current)
        const listKey = listNameForSlot(editor.slot)
        const list = [...(normalizedCurrent[listKey] ?? [])]
        const instance = editor.mode === 'add'
                         ? createFlythroughEffectInstance(definition, editor.slot, {params: editor.params})
                         : {
                ...list[editor.index],
                params: {
                    ...(list[editor.index]?.params ?? {}),
                    ...(editor.params ?? {}),
                },
            }

        if (!instance) {
            logFlythroughEffectsTab('editor-save-abort-no-instance', {
                slot:     editor.slot,
                mode:     editor.mode,
                effectId: editor.effectId,
            })
            close()
            return
        }

        if (editor.mode === 'add' && !canAddFlythroughEffect(normalizedCurrent, definition, editor.slot)) {
            logFlythroughEffectsTab('editor-save-blocked-by-maxInstances', {
                slot:             editor.slot,
                effectId:         definition.id,
                maxInstances:     definition.maxInstances,
                currentInstances: [...normalizedCurrent.start, ...normalizedCurrent.stop]
                                      .filter(effect => effect.effectId === definition.id)
                                      .length,
            })
            close()
            return
        }

        if (editor.mode === 'add') {
            list.push(instance)
        }
        else if (editor.index !== null && editor.index !== undefined) {
            list[editor.index] = {
                ...list[editor.index],
                ...instance,
                params: instance.params,
            }
        }

        onSave({
                   ...normalizedCurrent,
                   [listKey]:             list,
                   [`${listKey}Effects`]: list,
               })
        close()
    }, [close, definition, editor, effects, onSave])

    if (!editor.open || !definition) {
        return null
    }

    return (
        <PopupDrawer
            active={editor.open}
            anchor={editor.anchorId}
            onRequestClose={close}
            popupProps={{placement: 'bottom', distance: 8}}
            header={
                <>
                    <WaIcon name={editor.mode === 'add' ? 'sparkles' : 'pencil'} variant="regular"/>
                    <span>{editor.mode === 'add' ? 'Add effect' : 'Edit'}</span>
                </>
            }
            headerActions={(
                <WaButton appearance="plain" slot="header-actions" onClick={close}>
                    <WaIcon size="s" name="xmark" variant="regular"/>
                </WaButton>
            )}
            footer={(
                <>
                    <WaButton size="s" variant="brand" appearance="outlined" onClick={close}>
                        <WaIcon slot="start" size="s" name="xmark" variant="regular"/>
                        {'Cancel'}
                    </WaButton>
                    <WaButton size="s" variant="brand" appearance="filled" onClick={save}>
                        <WaIcon slot="start" size="s" name="check" variant="regular"/>
                        {editor.mode === 'add' ? 'Add' : 'Apply'}
                    </WaButton>
                </>
            )}
            className="flythrough-effects-popup-card"
        >

            <div className="flythrough-effects-editor">
                <div className="flythrough-effects-editor-header">
                    <strong>{definition.label}</strong>
                </div>
                <div className="flythrough-effects-editor-fields">
                    {definition.fields.map(field => (
                        <EffectField
                            key={field.key}
                            field={field}
                            value={editor.params?.[field.key] ?? definition.defaults?.[field.key] ?? ''}
                            unitSystem={unitSystem}
                            onChange={value => setEditor(current => ({
                                ...current,
                                params: {
                                    ...(current.params ?? {}),
                                    [field.key]: value,
                                },
                            }))}
                        />
                    ))}
                </div>
            </div>
        </PopupDrawer>
    )
}

const EffectAddPopup = ({effects, addState, setAddState, openEditor}) => {
    const definitions = useMemo(() => readDefinitions(effects, addState.slot) ?? [], [effects, addState.slot])

    useEffect(() => {
        logFlythroughEffectsTab('add-popup-render', {
            slot:    addState.slot,
            open:    addState.open,
            count:   definitions.length,
            effects: definitions.map(definition => ({
                id:           definition.id,
                maxInstances: definition.maxInstances,
            })),
        })
    }, [addState.open, addState.slot, definitions])

    const close = useCallback(() => {
        setAddState(emptyAddState())
    }, [setAddState])

    if (!addState.open) {
        return null
    }

    return (
        <PopupDrawer
            active={addState.open}
            anchor={addState.anchorId}
            onRequestClose={close}
            popupProps={{placement: 'bottom', distance: 8}}
            header={(
                <>
                    <WaIcon name="sparkles" variant="regular"/>
                    <span>{'Add effect'}</span>
                </>
            )}
            headerActions={(
                <WaButton appearance="plain" slot="header-actions" onClick={close}>
                    <WaIcon size="s" name="xmark" variant="regular"/>
                </WaButton>
            )}
            footer={(
                <WaButton size="s" variant="brand" appearance="outlined" onClick={close}>
                    <WaIcon slot="start" size="s" name="xmark" variant="regular"/>
                    {'Close'}
                </WaButton>
            )}
            className="flythrough-effects-popup-card"
        >
            <div className="flythrough-effects-add-list">
                {definitions.length === 0 ? (
                    <p className="flythrough-empty-state">{'No effect available for this slot.'}</p>
                ) : definitions.map(definition => {
                    const itemId = `flythrough-effects-add-${addState.slot}-${definition.id}`
                    const selectEffect = () => {
                        const canAdd = canAddFlythroughEffect(effects, definition, addState.slot)
                        logFlythroughEffectsTab('add-popup-select', {
                            slot:     addState.slot,
                            effectId: definition.id,
                            canAdd,
                        })
                        if (!canAdd) {
                            return
                        }

                        openEditor({
                                       slot:     addState.slot,
                                       anchorId: addState.anchorId,
                                       effectId: definition.id,
                                       params:   {...definition.defaults},
                                       definition,
                                       mode:     'add',
                                   })
                    }

                    return (
                        <div
                            key={definition.id}
                            className="flythrough-effects-add-item-shell"
                            role="button"
                            tabIndex={0}
                            onClick={selectEffect}
                            onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    selectEffect()
                                }
                            }}
                        >
                            <WaCard
                                id={itemId}
                                appearance="outlined"
                                className="lgs--card-hoverable flythrough-effects-add-item"
                            >
                                    <span className="flythrough-effects-add-item-content">
                                        <strong>{definition.label}</strong>
                                    </span>
                            </WaCard>
                            <WaTooltip for={itemId} placement="top">
                                {definition.description}
                            </WaTooltip>
                        </div>
                    )
                })}
            </div>
        </PopupDrawer>
    )
}

const EffectRow = ({
                       effect,
                       definition,
                       index,
                       slot,
                       onEdit,
                       onRemove,
                       onMove,
                       editAnchorId,
                       canMoveUp,
                       canMoveDown,
                   }) => {
    return (
        <WaCard
            appearance="outlined"
            className="lgs--card-hoverable flythrough-effect-row"
            data-id={effect.id}
        >
            <div className="flythrough-effect-content">
                <div className="flythrough-effect-title-row">
                    <strong>{definition?.label ?? effect.effectId}</strong>
                </div>
            </div>
            <div className="flythrough-effect-actions">
                <WaButton appearance="plain" size="s" onClick={() => onEdit({
                                                                                slot,
                                                                                index,
                                                                                anchorId: editAnchorId,
                                                                                effectId: effect.effectId,
                                                                                params:   effect.params,
                                                                                definition,
                                                                                mode:     'edit',
                                                                            })} aria-label="Edit effect">
                    <WaIcon name="pencil" variant="regular"/>
                </WaButton>
                <WaButton appearance="plain" size="s" disabled={!canMoveUp} onClick={() => onMove(slot, index, -1)}
                          aria-label="Move effect up">
                    <WaIcon name="arrow-up" variant="regular"/>
                </WaButton>
                <WaButton appearance="plain" size="s" disabled={!canMoveDown} onClick={() => onMove(slot, index, 1)}
                          aria-label="Move effect down">
                    <WaIcon name="arrow-down" variant="regular"/>
                </WaButton>
                <WaButton appearance="plain" size="s" variant="danger" onClick={() => onRemove(slot, index)}
                          aria-label="Remove effect">
                    <WaIcon name="trash-can" variant="regular"/>
                </WaButton>
            </div>
        </WaCard>
    )
}

const EffectList = ({
                        title,
                        slot,
                        effects,
                        list,
                        onAdd,
                        onEdit,
                        onRemove,
                        onMove,
                        addAnchorIdPrefix,
                        editAnchorIdPrefix,
                    }) => {
    const listRef = useRef(null)
    const sortableRef = useRef(null)
    const availableDefinitions = useMemo(() => readDefinitions(effects, slot), [effects, slot])
    const hasAvailableDefinitions = (availableDefinitions?.length ?? 0) > 0

    useEffect(() => {
        logFlythroughEffectsTab('effect-list-render', {
            slot,
            title,
            listCount:          list.length,
            availableCount:     availableDefinitions?.length ?? 0,
            availableEffectIds: availableDefinitions?.map(definition => definition.id) ?? [],
            hasAvailableDefinitions,
        })
    }, [availableDefinitions, hasAvailableDefinitions, list.length, slot, title])

    useEffect(() => {
        const listElement = listRef.current
        if (!listElement || list.length === 0) {
            return undefined
        }

        sortableRef.current?.destroy?.()
        sortableRef.current = new Sortable(listElement, {
            animation:     150,
            forceFallback: true,
            dataIdAttr:    'data-id',
            filter:        '.flythrough-effect-actions',
            dragClass:     'widget-row-drag',
            ghostClass:    'widget-row-ghost',
            chosenClass:   'widget-row-chosen',
            onEnd:         () => {
                const nextIds = sortableRef.current?.toArray?.() ?? []
                onMove(slot, null, 0, nextIds)
            },
        })

        return () => {
            sortableRef.current?.destroy?.()
            sortableRef.current = null
        }
    }, [list, onMove, slot])

    return (
        <section className="flythrough-effects-section">
            <div className="flythrough-effects-section-header">
                <div className="flythrough-effects-section-header-row">
                    <span className="flythrough-effects-section-title">{title}</span>
                    <WaButton
                        disabled={!hasAvailableDefinitions}
                        appearance="outlined"
                        variant="brand"
                        size="s"
                        onClick={() => {
                            logFlythroughEffectsTab('open-add-click', {
                                slot,
                                title,
                                availableEffectIds: availableDefinitions?.map(definition => definition.id) ?? [],
                            })
                            onAdd({slot, anchorId: addAnchorIdPrefix})
                        }}
                    >
                        <WaIcon name="plus" variant="regular"/>
                        {'Add effect'}
                    </WaButton>
                </div>
                <PopupAnchor id={addAnchorIdPrefix}/>

            </div>

            <div ref={listRef} className="flythrough-effects-list">
                {list.length === 0 ? (
                    <p className="flythrough-empty-state">{`No ${title.toLowerCase()} effect configured.`}</p>
                ) : list.map((effect, index) => {
                    const definition = effects?.catalog?.[effect.effectId]
                    const editAnchorId = `${editAnchorIdPrefix}-${effect.id}`
                    return (
                        <div key={effect.id} className="flythrough-effect-row-shell">
                            <PopupAnchor id={editAnchorId}/>
                            <EffectRow
                                effect={effect}
                                definition={definition}
                                index={index}
                                slot={slot}
                                onEdit={onEdit}
                                onRemove={onRemove}
                                onMove={onMove}
                                editAnchorId={editAnchorId}
                                canMoveUp={index > 0}
                                canMoveDown={index < list.length - 1}
                            />
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

export const FlythroughEffectsTab = memo(({settings}) => {
    const [addState, setAddState] = useState(emptyAddState())
    const [editor, setEditor] = useState(emptyEditorState())
    const mainStore = useSnapshot(lgs.stores.main)
    const currentJourney = mainStore?.theJourney ?? lgs.theJourney ?? lgs.stores.main?.theJourney
    const currentEffects = readCurrentEffects(settings, currentJourney)

    useEffect(() => {
        logFlythroughEffectsTab('tab-render', {
            journeySlug: currentJourney?.slug ?? null,
            catalogSize: Object.keys(currentEffects.catalog ?? {}).length,
            startCount:  currentEffects.start.length,
            stopCount:   currentEffects.stop.length,
            startIds:    currentEffects.start.map(effect => effect.effectId),
            stopIds:     currentEffects.stop.map(effect => effect.effectId),
        })
    }, [currentEffects, currentJourney?.slug])

    const saveEffects = useCallback((nextEffects) => {
        syncEffects(nextEffects)
    }, [])

    const openAdd = useCallback(({slot, anchorId}) => {
        logFlythroughEffectsTab('open-add', {
            slot,
            anchorId,
            currentStart: currentEffects.start.map(effect => effect.effectId),
            currentStop:  currentEffects.stop.map(effect => effect.effectId),
        })
        setEditor(emptyEditorState())
        setAddState({
                        open: true,
                        slot,
                        anchorId,
                    })
    }, [currentEffects.start, currentEffects.stop])

    const openEditor = useCallback(({
                                        slot,
                                        index = null,
                                        anchorId,
                                        effectId,
                                        params = {},
                                        definition = null,
                                        mode = 'add',
                                    }) => {
        logFlythroughEffectsTab('open-editor', {
            slot,
            index,
            anchorId,
            effectId,
            mode,
        })
        setAddState(emptyAddState())
        setEditor({
                      open:     true,
                      slot,
                      mode,
                      index,
                      anchorId: anchorId ?? `${slot}-${EDIT_POPUP_SUFFIX}`,
                      effectId,
                      params,
                      definition,
                  })
    }, [])

    const reorderEffects = useCallback((slot, _unusedIndex, _unusedDirection, orderedIds = null) => {
        if (!Array.isArray(orderedIds)) {
            return
        }

        const current = readCurrentEffects(settings, currentJourney)
        const listKey = listNameForSlot(slot)
        const sourceList = Array.isArray(current[listKey]) ? current[listKey] : []
        const ordered = orderedIds
            .map(id => sourceList.find(effect => effect.id === id))
            .filter(Boolean)

        if (orderedIds.length === 0 || ordered.length !== orderedIds.length) {
            return
        }

        saveEffects({
                        ...current,
                        [listKey]:             ordered,
                        [`${listKey}Effects`]: ordered,
                    })
    }, [currentJourney, saveEffects, settings])

    const moveEffect = useCallback((slot, index, direction, orderedIds = null) => {
        if (Array.isArray(orderedIds)) {
            reorderEffects(slot, index, direction, orderedIds)
            return
        }

        const current = readCurrentEffects(settings, currentJourney)
        const listKey = listNameForSlot(slot)
        const list = [...(current[listKey] ?? [])]
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= list.length) {
            return
        }

        const [item] = list.splice(index, 1)
        list.splice(targetIndex, 0, item)
        saveEffects({
                        ...current,
                        [listKey]:             list,
                        [`${listKey}Effects`]: list,
                    })
    }, [currentJourney, reorderEffects, saveEffects, settings])

    const removeEffect = useCallback((slot, index) => {
        const current = readCurrentEffects(settings, currentJourney)
        const listKey = listNameForSlot(slot)
        const list = (current[listKey] ?? []).filter((_, currentIndex) => currentIndex !== index)
        saveEffects({
                        ...current,
                        [listKey]:             list,
                        [`${listKey}Effects`]: list,
                    })
    }, [currentJourney, saveEffects, settings])

    const startList = currentEffects.start
    const stopList = currentEffects.stop

    return (
        <div className="flythrough-effects-tab">
            <EffectList
                title="Start"
                slot={FLYTHROUGH_EFFECT_SLOT_START}
                effects={currentEffects}
                list={startList}
                onAdd={openAdd}
                onEdit={openEditor}
                onRemove={removeEffect}
                onMove={moveEffect}
                addAnchorIdPrefix={`${FLYTHROUGH_EFFECT_SLOT_START}-${ADD_POPUP_SUFFIX}`}
                editAnchorIdPrefix={`${FLYTHROUGH_EFFECT_SLOT_START}-${EDIT_POPUP_SUFFIX}`}
            />
            <EffectList
                title="Stop"
                slot={FLYTHROUGH_EFFECT_SLOT_STOP}
                effects={currentEffects}
                list={stopList}
                onAdd={openAdd}
                onEdit={openEditor}
                onRemove={removeEffect}
                onMove={moveEffect}
                addAnchorIdPrefix={`${FLYTHROUGH_EFFECT_SLOT_STOP}-${ADD_POPUP_SUFFIX}`}
                editAnchorIdPrefix={`${FLYTHROUGH_EFFECT_SLOT_STOP}-${EDIT_POPUP_SUFFIX}`}
            />
            <EffectAddPopup
                effects={currentEffects}
                addState={addState}
                setAddState={setAddState}
                openEditor={openEditor}
            />
            <EffectEditorPopup
                effects={currentEffects}
                editor={editor}
                setEditor={setEditor}
                onSave={saveEffects}
            />
        </div>
    )
})
