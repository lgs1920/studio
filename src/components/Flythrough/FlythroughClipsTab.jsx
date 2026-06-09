/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughClipsTab.jsx
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
    createFlythroughClipInstance,
    FLYTHROUGH_CLIP_SLOT_START,
    FLYTHROUGH_CLIP_SLOT_STOP,
    availableFlythroughClipsForSlot,
    canAddFlythroughClip,
    normalizeFlythroughClips,
}                                                                  from '@Core/ui/flythrough/FlythroughClips'
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
const FLYTHROUGH_CLIPS_DEBUG = true

const logFlythroughClipsTab = (...args) => {
    if (FLYTHROUGH_CLIPS_DEBUG) {
        console.debug('[FlythroughClipsTab]', ...args)
    }
}

const listNameForSlot = slot => (slot === FLYTHROUGH_CLIP_SLOT_STOP ? 'stop' : 'start')

const clone = value => JSON.parse(JSON.stringify(value))

const emptyAddState = () => ({
    open:     false,
    anchorId: null,
    slot:     FLYTHROUGH_CLIP_SLOT_START,
})

const emptyEditorState = () => ({
    open:       false,
    anchorId:   null,
    slot:       FLYTHROUGH_CLIP_SLOT_START,
    mode:       'add',
    index:      null,
    clipId:   null,
    params:     {},
    initialParams: {},
    definition: null,
})

const hasCatalogEntries = catalog => Boolean(catalog) && Object.keys(catalog).length > 0

const resolveFlythroughClipsCatalog = (settings = {}) => {
    const candidates = [
        settings?.clips?.catalog,
        settings?.clips?.definitions,
    ]

    return candidates.find(hasCatalogEntries) ?? {}
}

const syncClips = (nextClips) => {
    const normalized = normalizeFlythroughClips(nextClips)
    const journey = globalThis.lgs?.theJourney ?? globalThis.lgs?.stores?.main?.theJourney
    const runtime = globalThis.lgs?.stores?.flythrough

    const applyRuntime = target => {
        if (!target) {
            return
        }

        target.clips = normalized
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

const readClipDefinitions = (clips, slot) => availableFlythroughClipsForSlot(clips, slot)

const readCurrentClips = (settings, journey) => {
    const settingsClips = normalizeFlythroughClips({
                                                           catalog: resolveFlythroughClipsCatalog(settings),
                                                       })
    const journeyFlythrough = journey?.flythrough ?? {}
    const start = Array.isArray(journeyFlythrough.start) ? journeyFlythrough.start : []
    const stop = Array.isArray(journeyFlythrough.stop) ? journeyFlythrough.stop : []
    const normalized = normalizeFlythroughClips({
                                                      catalog: settingsClips.catalog,
                                                      start,
                                                      stop,
                                                  })

    logFlythroughClipsTab('readCurrentClips', {
        journeySlug:       journey?.slug ?? null,
        catalogSize:       Object.keys(settingsClips.catalog ?? {}).length,
        journeyStartCount: start.length,
        journeyStopCount:  stop.length,
        normalizedStart:   normalized.start.map(clip => clip.clipId),
        normalizedStop:    normalized.stop.map(clip => clip.clipId),
    })

    return {
        ...normalized,
        catalog: settingsClips.catalog,
        start,
        stop,
    }
}

const ClipField = ({field, value, onChange, unitSystem = 0}) => {
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

    const controlClassName = 'flythrough-clips-field-control'

    if (field.type === 'select') {
        return (
            <div className="flythrough-clips-editor-field">
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
        <div className="flythrough-clips-editor-field">
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

const ClipEditorPopup = ({clips, editor, setEditor, onSave}) => {
    const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
    const normalized = useMemo(() => normalizeFlythroughClips(clips), [clips])
    const definitions = useMemo(() => readClipDefinitions(clips, editor.slot) ?? [], [clips, editor.slot])
    const definition = editor.definition ?? (editor.clipId ? normalized.catalog[editor.clipId] : null)
    const initialParams = useMemo(() => editor.initialParams ?? definition?.defaults ?? {}, [definition, editor.initialParams])
    const isDirty = useMemo(() => JSON.stringify(editor.params ?? {}) !== JSON.stringify(initialParams ?? {}), [editor.params, initialParams])

    const persistEdit = useCallback((params) => {
        if (editor.mode !== 'edit' || editor.index === null || editor.index === undefined || !definition) {
            return
        }

        const current = clone(clips ?? {})
        const normalizedCurrent = normalizeFlythroughClips(current)
        const listKey = listNameForSlot(editor.slot)
        const list = [...(normalizedCurrent[listKey] ?? [])]
        if (!list[editor.index]) {
            return
        }

        list[editor.index] = {
            ...list[editor.index],
            params: {
                ...(list[editor.index]?.params ?? {}),
                ...(params ?? {}),
            },
        }

        onSave({
                   ...normalizedCurrent,
                   [listKey]:             list,
               })
    }, [definition, editor.index, editor.mode, editor.slot, clips, onSave])

    const updateParams = useCallback((nextParams) => {
        setEditor(current => ({
            ...current,
            params: nextParams,
        }))
        persistEdit(nextParams)
    }, [persistEdit, setEditor])

    useEffect(() => {
        if (!editor.open || editor.mode !== 'add' || editor.clipId) {
            return
        }

        const nextDefinition = definitions[0] ?? null
        if (!nextDefinition) {
            return
        }

        setEditor(current => ({
            ...current,
            clipId: current.clipId ?? nextDefinition.id,
            params:   current.clipId ? current.params : {...nextDefinition.defaults},
            initialParams: current.clipId ? current.initialParams : {...nextDefinition.defaults},
        }))
    }, [definitions, editor.clipId, editor.mode, editor.open, setEditor])

    const close = useCallback(() => {
        setEditor(emptyEditorState())
    }, [setEditor])

    const save = useCallback(() => {
        if (!definition) {
            logFlythroughClipsTab('editor-save-abort-no-definition', {
                slot:     editor.slot,
                mode:     editor.mode,
                clipId: editor.clipId,
            })
            close()
            return
        }

        const current = clone(clips ?? {})
        const normalizedCurrent = normalizeFlythroughClips(current)
        const listKey = listNameForSlot(editor.slot)
        const list = [...(normalizedCurrent[listKey] ?? [])]
        const instance = editor.mode === 'add'
                         ? createFlythroughClipInstance(definition, editor.slot, {params: editor.params})
                         : {
                ...list[editor.index],
                params: {
                    ...(list[editor.index]?.params ?? {}),
                    ...(editor.params ?? {}),
                },
            }

        if (!instance) {
            logFlythroughClipsTab('editor-save-abort-no-instance', {
                slot:     editor.slot,
                mode:     editor.mode,
                clipId: editor.clipId,
            })
            close()
            return
        }

        if (editor.mode === 'add' && !canAddFlythroughClip(normalizedCurrent, definition, editor.slot)) {
            logFlythroughClipsTab('editor-save-blocked-by-maxInstances', {
                slot:             editor.slot,
                clipId:         definition.id,
                maxInstances:     definition.maxInstances,
                currentInstances: [...normalizedCurrent.start, ...normalizedCurrent.stop]
                                      .filter(clip => clip.clipId === definition.id)
                                      .length,
            })
            close()
            return
        }

        if (editor.mode === 'add') {
            list.push(instance)
            onSave({
                       ...normalizedCurrent,
                       [listKey]:             list,
                   })
        }
        else if (editor.index !== null && editor.index !== undefined) {
            list[editor.index] = {
                ...list[editor.index],
                ...instance,
                params: instance.params,
            }
            onSave({
                       ...normalizedCurrent,
                       [listKey]:             list,
                   })
        }
        close()
    }, [close, definition, editor, clips, onSave])

    const reset = useCallback(() => {
        const nextParams = clone(initialParams ?? definition?.defaults ?? {})
        setEditor(current => ({
            ...current,
            params: nextParams,
        }))
        persistEdit(nextParams)
    }, [definition, initialParams, persistEdit, setEditor])

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
                    <span>{editor.mode === 'add' ? 'Add clip' : 'Edit'}</span>
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
                        {editor.mode === 'add' ? 'Cancel' : 'Close'}
                    </WaButton>
                    {editor.mode === 'edit' && isDirty && (
                        <WaButton size="s" variant="brand" appearance="outlined" onClick={reset}>
                            <WaIcon slot="start" size="s" name="arrow-rotate-left" variant="regular"/>
                            {'Reset'}
                        </WaButton>
                    )}
                    {editor.mode === 'add' && (
                        <WaButton size="s" variant="brand" appearance="filled" onClick={save}>
                            <WaIcon slot="start" size="s" name="check" variant="regular"/>
                            {'Add'}
                        </WaButton>
                    )}
                </>
            )}
            className="flythrough-clips-popup-card"
        >

            <div className="flythrough-clips-editor">
                <div className="flythrough-clips-editor-header">
                    <strong>{definition.label}</strong>
                </div>
                <div className="flythrough-clips-editor-fields">
                    {definition.fields.map(field => (
                        <ClipField
                            key={field.key}
                            field={field}
                            value={editor.params?.[field.key] ?? definition.defaults?.[field.key] ?? ''}
                            unitSystem={unitSystem}
                            onChange={value => updateParams({
                                ...(editor.params ?? {}),
                                [field.key]: value,
                            })}
                        />
                    ))}
                </div>
            </div>
        </PopupDrawer>
    )
}

const ClipAddPopup = ({clips, addState, setAddState, openEditor}) => {
    const definitions = useMemo(() => readClipDefinitions(clips, addState.slot) ?? [], [clips, addState.slot])

    useEffect(() => {
        logFlythroughClipsTab('add-popup-render', {
            slot:    addState.slot,
            open:    addState.open,
            count:   definitions.length,
            clips: definitions.map(definition => ({
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
                    <span>{'Add clip'}</span>
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
            className="flythrough-clips-popup-card"
        >
            <div className="flythrough-clips-add-list">
                {definitions.length === 0 ? (
                    <p className="flythrough-empty-state">{'No clip available for this slot.'}</p>
                ) : definitions.map(definition => {
                    const itemId = `flythrough-clips-add-${addState.slot}-${definition.id}`
                    const selectClip = () => {
                        const canAdd = canAddFlythroughClip(clips, definition, addState.slot)
                        logFlythroughClipsTab('add-popup-select', {
                            slot:     addState.slot,
                            clipId: definition.id,
                            canAdd,
                        })
                        if (!canAdd) {
                            return
                        }

                        openEditor({
                                       slot:     addState.slot,
                                       anchorId: addState.anchorId,
                                       clipId: definition.id,
                                       params:   {...definition.defaults},
                                       definition,
                                       mode:     'add',
                                   })
                    }

                    return (
                        <div
                            key={definition.id}
                            className="flythrough-clips-add-item-shell"
                            role="button"
                            tabIndex={0}
                            onClick={selectClip}
                            onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    selectClip()
                                }
                            }}
                        >
                            <WaCard
                                id={itemId}
                                appearance="outlined"
                                className="lgs--card-hoverable flythrough-clips-add-item"
                            >
                                    <span className="flythrough-clips-add-item-content">
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

const ClipRow = ({
                       clip,
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
            className="lgs--card-hoverable flythrough-clip-row"
        >
            <div className="flythrough-clip-content">
                <div className="flythrough-clip-title-row">
                    <strong>{definition?.label ?? clip.clipId}</strong>
                </div>
            </div>
            <div className="flythrough-clip-actions">
                <WaButton appearance="plain" size="s" onClick={() => onEdit({
                                                                                slot,
                                                                                index,
                                                                                anchorId: editAnchorId,
                                                                                clipId: clip.clipId,
                                                                                params:   clip.params,
                                                                                definition,
                                                                                mode:     'edit',
                                                                            })} aria-label="Edit clip">
                    <WaIcon name="pencil" variant="regular"/>
                </WaButton>
                <WaButton appearance="plain" size="s" disabled={!canMoveUp} onClick={() => onMove(slot, index, -1)}
                          aria-label="Move clip up">
                    <WaIcon name="arrow-up" variant="regular"/>
                </WaButton>
                <WaButton appearance="plain" size="s" disabled={!canMoveDown} onClick={() => onMove(slot, index, 1)}
                          aria-label="Move clip down">
                    <WaIcon name="arrow-down" variant="regular"/>
                </WaButton>
                <WaButton appearance="plain" size="s" variant="danger" onClick={() => onRemove(slot, index)}
                          aria-label="Remove clip">
                    <WaIcon name="trash-can" variant="regular"/>
                </WaButton>
            </div>
        </WaCard>
    )
}

const ClipList = ({
                        title,
                        slot,
                        clips,
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
    const availableDefinitions = useMemo(() => readClipDefinitions(clips, slot), [clips, slot])
    const hasAvailableDefinitions = (availableDefinitions?.length ?? 0) > 0

    useEffect(() => {
        logFlythroughClipsTab('clip-list-render', {
            slot,
            title,
            listCount:          list.length,
            availableCount:     availableDefinitions?.length ?? 0,
            availableClipIds: availableDefinitions?.map(definition => definition.id) ?? [],
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
            filter:        '.flythrough-clip-actions',
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
        <section className="flythrough-clips-section">
            <div className="flythrough-clips-section-header">
                <div className="flythrough-clips-section-header-row">
                    <span className="flythrough-clips-section-title">{title}</span>
                    <WaButton
                        disabled={!hasAvailableDefinitions}
                        appearance="outlined"
                        variant="brand"
                        size="s"
                        onClick={() => {
                            logFlythroughClipsTab('open-add-click', {
                                slot,
                                title,
                                availableClipIds: availableDefinitions?.map(definition => definition.id) ?? [],
                            })
                            onAdd({slot, anchorId: addAnchorIdPrefix})
                        }}
                    >
                        <WaIcon name="plus" variant="regular"/>
                        {'Add clip'}
                    </WaButton>
                </div>
                <PopupAnchor id={addAnchorIdPrefix}/>

            </div>

            <div ref={listRef} className="flythrough-clips-list">
                {list.length === 0 ? (
                    <p className="flythrough-empty-state">{`No ${title.toLowerCase()} clip configured.`}</p>
                ) : list.map((clip, index) => {
                    const definition = clips?.catalog?.[clip.clipId]
                    const editAnchorId = `${editAnchorIdPrefix}-${clip.id}`
                    return (
                        <div key={clip.id} className="flythrough-clip-row-shell" data-id={clip.id}>
                            <PopupAnchor id={editAnchorId}/>
                            <ClipRow
                                clip={clip}
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

export const FlythroughClipsTab = memo(({settings}) => {
    const [addState, setAddState] = useState(emptyAddState())
    const [editor, setEditor] = useState(emptyEditorState())
    const mainStore = useSnapshot(lgs.stores.main)
    const currentJourney = mainStore?.theJourney ?? lgs.theJourney ?? lgs.stores.main?.theJourney
    const currentClips = readCurrentClips(settings, currentJourney)

    useEffect(() => {
        logFlythroughClipsTab('tab-render', {
            journeySlug: currentJourney?.slug ?? null,
            catalogSize: Object.keys(currentClips.catalog ?? {}).length,
            startCount:  currentClips.start.length,
            stopCount:   currentClips.stop.length,
            startIds:    currentClips.start.map(clip => clip.clipId),
            stopIds:     currentClips.stop.map(clip => clip.clipId),
        })
    }, [currentClips, currentJourney?.slug])

    const saveClips = useCallback((nextClips) => {
        syncClips(nextClips)
    }, [])

    const openAdd = useCallback(({slot, anchorId}) => {
        logFlythroughClipsTab('open-add', {
            slot,
            anchorId,
            currentStart: currentClips.start.map(clip => clip.clipId),
            currentStop:  currentClips.stop.map(clip => clip.clipId),
        })
        setEditor(emptyEditorState())
        setAddState({
                        open: true,
                        slot,
                        anchorId,
                    })
    }, [currentClips.start, currentClips.stop])

    const openEditor = useCallback(({
                                        slot,
                                        index = null,
                                        anchorId,
                                        clipId,
                                        params = {},
                                        definition = null,
                                        mode = 'add',
                                    }) => {
        logFlythroughClipsTab('open-editor', {
            slot,
            index,
            anchorId,
            clipId,
            mode,
        })
        setAddState(emptyAddState())
        setEditor({
                      open:     true,
                      slot,
                      mode,
                      index,
                      anchorId: anchorId ?? `${slot}-${EDIT_POPUP_SUFFIX}`,
                      clipId,
                      params:         {...params},
                      initialParams:  {...params},
                      definition,
                  })
    }, [])

    const reorderClips = useCallback((slot, _unusedIndex, _unusedDirection, orderedIds = null) => {
        if (!Array.isArray(orderedIds)) {
            return
        }

        const current = readCurrentClips(settings, currentJourney)
        const listKey = listNameForSlot(slot)
        const sourceList = Array.isArray(current[listKey]) ? current[listKey] : []
        const ordered = orderedIds
            .map(id => sourceList.find(clip => clip.id === id))
            .filter(Boolean)

        if (orderedIds.length === 0 || ordered.length !== orderedIds.length) {
            return
        }

        saveClips({
                        ...current,
                        [listKey]:             ordered,
                    })
    }, [currentJourney, saveClips, settings])

    const moveClip = useCallback((slot, index, direction, orderedIds = null) => {
        if (Array.isArray(orderedIds)) {
            reorderClips(slot, index, direction, orderedIds)
            return
        }

        const current = readCurrentClips(settings, currentJourney)
        const listKey = listNameForSlot(slot)
        const list = [...(current[listKey] ?? [])]
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= list.length) {
            return
        }

        const [item] = list.splice(index, 1)
        list.splice(targetIndex, 0, item)
        saveClips({
                        ...current,
                        [listKey]:             list,
                    })
    }, [currentJourney, reorderClips, saveClips, settings])

    const removeClip = useCallback((slot, index) => {
        const current = readCurrentClips(settings, currentJourney)
        const listKey = listNameForSlot(slot)
        const list = (current[listKey] ?? []).filter((_, currentIndex) => currentIndex !== index)
        saveClips({
                        ...current,
                        [listKey]:             list,
                    })
    }, [currentJourney, saveClips, settings])

    const startList = currentClips.start
    const stopList = currentClips.stop

    return (
        <div className="flythrough-clips-tab">
            <ClipList
                title="Start"
                slot={FLYTHROUGH_CLIP_SLOT_START}
                clips={currentClips}
                list={startList}
                onAdd={openAdd}
                onEdit={openEditor}
                onRemove={removeClip}
                onMove={moveClip}
                addAnchorIdPrefix={`${FLYTHROUGH_CLIP_SLOT_START}-${ADD_POPUP_SUFFIX}`}
                editAnchorIdPrefix={`${FLYTHROUGH_CLIP_SLOT_START}-${EDIT_POPUP_SUFFIX}`}
            />
            <ClipList
                title="Stop"
                slot={FLYTHROUGH_CLIP_SLOT_STOP}
                clips={currentClips}
                list={stopList}
                onAdd={openAdd}
                onEdit={openEditor}
                onRemove={removeClip}
                onMove={moveClip}
                addAnchorIdPrefix={`${FLYTHROUGH_CLIP_SLOT_STOP}-${ADD_POPUP_SUFFIX}`}
                editAnchorIdPrefix={`${FLYTHROUGH_CLIP_SLOT_STOP}-${EDIT_POPUP_SUFFIX}`}
            />
            <ClipAddPopup
                clips={currentClips}
                addState={addState}
                setAddState={setAddState}
                openEditor={openEditor}
            />
            <ClipEditorPopup
                clips={currentClips}
                editor={editor}
                setEditor={setEditor}
                onSave={saveClips}
            />
        </div>
    )
})
