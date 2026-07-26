/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayClipsTab.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-12
 * Last modified: 2026-06-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { PopupAnchor }                                             from '@Components/PopupAnchor'
import { PopupDrawer }                                             from '@Components/PopupDrawer'
import {
    createJourneyReplayClipInstance,
    REPLAY_CLIP_SLOT_START,
    REPLAY_CLIP_SLOT_STOP,
    availableJourneyReplayClipsForSlot,
    canAddJourneyReplayClip,
    normalizeJourneyReplayClips,
}                                                                  from '@Core/ui/replay/JourneyReplayClips'
import { ELEVATION_UNITS, UnitUtils }                              from '@Utils/UnitUtils'
import {
    WaButton,
    WaCard,
    WaDetails,
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

const listNameForSlot = slot => (slot === REPLAY_CLIP_SLOT_STOP ? 'stop' : 'start')

const emptyAddState = () => ({
    open:     false,
    anchorId: null,
    slot:     REPLAY_CLIP_SLOT_START,
})

const hasCatalogEntries = catalog => Boolean(catalog) && Object.keys(catalog).length > 0

const resolveJourneyReplayClipsCatalog = (settings = {}) => {
    const candidates = [
        settings?.clips?.catalog,
        settings?.clips?.definitions,
    ]

    return candidates.find(hasCatalogEntries) ?? {}
}

const syncClips = (nextClips) => {
    const normalized = normalizeJourneyReplayClips(nextClips)
    const journey = globalThis.lgs?.theJourney ?? globalThis.lgs?.stores?.main?.theJourney
    const runtime = globalThis.lgs?.stores?.replay

    const applyRuntime = target => {
        if (!target) {
            return
        }

        target.clips = normalized
    }

    if (journey) {
        if (!journey.replay || typeof journey.replay !== 'object') {
            journey.replay = {}
        }

        journey.replay.start = normalized.start
        journey.replay.stop = normalized.stop
        void journey.persistToDatabase?.()
    }

    applyRuntime(runtime)

    return normalized
}

const readClipDefinitions = (clips, slot) => availableJourneyReplayClipsForSlot(clips, slot)

const readCurrentClips = (settings, journey) => {
    const settingsClips = normalizeJourneyReplayClips({
                                                           catalog: resolveJourneyReplayClipsCatalog(settings),
                                                       })
    const journeyJourneyReplay = journey?.replay ?? {}
    const start = Array.isArray(journeyJourneyReplay.start) ? journeyJourneyReplay.start : []
    const stop = Array.isArray(journeyJourneyReplay.stop) ? journeyJourneyReplay.stop : []
    const normalized = normalizeJourneyReplayClips({
                                                      catalog: settingsClips.catalog,
                                                      start,
                                                      stop,
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
    const [tempValue, setTempValue] = useState(() => `${displayValue ?? ''}`)
    const isFocusedRef = useRef(false)

    useEffect(() => {
        if (!isFocusedRef.current) {
            setTempValue(`${displayValue ?? ''}`)
        }
    }, [displayValue])

    const commitValue = useCallback((rawValue) => {
        const parsedValue = usesElevationUnit
                            ? UnitUtils.revert(rawValue, displayUnit)
                            : Number(rawValue)

        if (Number.isFinite(parsedValue)) {
            onChange(parsedValue)
        }
    }, [displayUnit, onChange, usesElevationUnit])
    const commonProps = {
        label:            `${field.label}${displayUnit ? ` (${displayUnit})` : ''}`,
        size:             's',
        'label-at-start': true,
    }

    const controlClassName = 'replay-clips-field-control'

    if (field.type === 'select') {
        return (
            <div className="replay-clips-editor-field">
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
        <div className="replay-clips-editor-field">
            <WaNumberInput
                {...commonProps}
                appearance="filled"
                min={displayMin}
                max={displayMax}
                step={displayStep}
                value={tempValue}
                onFocus={() => {
                    isFocusedRef.current = true
                    setTempValue(`${displayValue ?? ''}`)
                }}
                onInput={event => {
                    const rawValue = `${event.target.value ?? ''}`
                    setTempValue(rawValue)
                    commitValue(rawValue)
                }}
                onBlur={event => {
                    isFocusedRef.current = false
                    const rawValue = `${event.target.value ?? ''}`
                    const parsedValue = usesElevationUnit
                                       ? UnitUtils.revert(rawValue, displayUnit)
                                       : Number(rawValue)
                    if (Number.isFinite(parsedValue)) {
                        setTempValue(`${usesElevationUnit
                                      ? Math.round(UnitUtils.convert(parsedValue).to(displayUnit))
                                      : parsedValue}`)
                    }
                    else {
                        setTempValue(`${displayValue ?? ''}`)
                    }
                }}
                className={`${controlClassName} half-width`}
            />
        </div>
    )
}

const ClipTitle = ({definition, fallback = '', className = ''}) => {
    const label = definition?.label ?? fallback
    const icon = definition?.icon ?? null

    return (
        <span className={`replay-clip-title ${className}`.trim()}>
            <strong>
                {icon && <WaIcon name={icon} variant="regular"/>}
                {icon && '\u00A0'}
                {label}
            </strong>
        </span>
    )
}

const stopEventPropagation = event => {
    event.stopPropagation()
}

const ClipAddPopup = ({clips, addState, setAddState, onAddClip}) => {
    const definitions = useMemo(() => readClipDefinitions(clips, addState.slot) ?? [], [clips, addState.slot])

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
            className="replay-clips-popup-card"
        >
            <div className="replay-clips-add-list">
                {definitions.length === 0 ? (
                    <p className="replay-empty-state">{'No clip available for this slot.'}</p>
                ) : definitions.map(definition => {
                    const itemId = `replay-clips-add-${addState.slot}-${definition.id}`
                    const selectClip = () => {
                        const canAdd = canAddJourneyReplayClip(clips, definition, addState.slot)
                        if (!canAdd) {
                            return
                        }

                        onAddClip(addState.slot, definition)
                        close()
                    }

                    return (
                        <div
                            key={definition.id}
                            className="replay-clips-add-item-shell"
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
                                className="lgs--card-hoverable replay-clips-add-item"
                            >
                                <span className="replay-clips-add-item-content">
                                    <ClipTitle definition={definition}/>
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

const ClipDetails = ({
                         clip,
                         definition,
                         index,
                         slot,
                         onRemove,
                         onMove,
                         onUpdate,
                         canMoveUp,
                         canMoveDown,
                         isOpen,
                         onOpen,
                         onClose,
                     }) => {
    const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)

    return (
        <WaDetails
            data-id={clip.id}
            className="lgs--details-hoverable replay-clip-details"
            open={isOpen}
            onWaShow={onOpen}
            onWaHide={onClose}
        >
            <span slot="summary" className="replay-clip-summary">
                <ClipTitle className="replay-clip-summary-title" definition={definition} fallback={clip.clipId}/>
                <span className="replay-clip-summary-actions">
                    <WaButton appearance="plain" size="s" disabled={!canMoveUp} onClick={event => {
                        event.stopPropagation()
                        onMove(slot, index, -1)
                    }}
                              aria-label="Move clip up">
                        <WaIcon name="arrow-up" variant="regular"/>
                    </WaButton>
                    <WaButton appearance="plain" size="s" disabled={!canMoveDown} onClick={event => {
                        event.stopPropagation()
                        onMove(slot, index, 1)
                    }}
                              aria-label="Move clip down">
                        <WaIcon name="arrow-down" variant="regular"/>
                    </WaButton>
                    <WaButton appearance="plain" size="s" variant="danger" onClick={event => {
                        event.stopPropagation()
                        onRemove(slot, index)
                    }}
                              aria-label="Remove clip">
                        <WaIcon name="trash-can" variant="regular"/>
                    </WaButton>
                </span>
            </span>

            <div className="replay-clip-body">
                <div
                    className="replay-clips-editor-fields"
                    onClickCapture={stopEventPropagation}
                    onFocusCapture={stopEventPropagation}
                    onMouseDownCapture={stopEventPropagation}
                    onPointerDownCapture={stopEventPropagation}
                >
                    {definition?.fields?.map(field => (
                        <ClipField
                            key={field.key}
                            field={field}
                            value={clip.params?.[field.key] ?? definition.defaults?.[field.key] ?? ''}
                            unitSystem={unitSystem}
                            onChange={value => onUpdate(slot, index, {
                                params: {
                                    ...(clip.params ?? {}),
                                    [field.key]: value,
                                },
                            })}
                        />
                    ))}
                </div>
            </div>
        </WaDetails>
    )
}

const ClipList = ({
                        title,
                        slot,
                        clips,
                        list,
                        onAdd,
                        onRemove,
                        onMove,
                        onUpdate,
                        addAnchorIdPrefix,
                        openClipIds,
                        setOpenClipIds,
                    }) => {
    const listRef = useRef(null)
    const sortableRef = useRef(null)
    const availableDefinitions = useMemo(() => readClipDefinitions(clips, slot), [clips, slot])
    const hasAvailableDefinitions = (availableDefinitions?.length ?? 0) > 0

    useEffect(() => {
        const listElement = listRef.current
        if (!listElement || list.length === 0) {
            return undefined
        }

        sortableRef.current?.destroy?.()
        sortableRef.current = new Sortable(listElement, {
            animation:     150,
            forceFallback: true,
            handle:        '.replay-clip-summary',
            dataIdAttr:    'data-id',
            filter:        '.replay-clip-summary-actions, .replay-clips-field-control, wa-button, wa-number-input, wa-select',
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
        <section className="replay-clips-section">
            <div className="replay-clips-section-header">
                <div className="replay-clips-section-header-row">
                    <span className="replay-clips-section-title">{title}</span>
                    <WaButton
                        disabled={!hasAvailableDefinitions}
                        appearance="outlined"
                        variant="brand"
                        size="s"
                        onClick={() => {
                            onAdd({slot, anchorId: addAnchorIdPrefix})
                        }}
                    >
                        <WaIcon name="plus" variant="regular"/>
                        {'Add clip'}
                    </WaButton>
                </div>
                <PopupAnchor id={addAnchorIdPrefix}/>

            </div>

            <div ref={listRef} className="lgs--details-list replay-clips-list">
                {list.length === 0 ? (
                    <p className="replay-empty-state">{`No ${title.toLowerCase()} clip configured.`}</p>
                ) : list.map((clip, index) => {
                    const definition = clips?.catalog?.[clip.clipId]
                    return (
                        <ClipDetails
                            key={clip.id}
                            clip={clip}
                            definition={definition}
                            index={index}
                            slot={slot}
                            onRemove={onRemove}
                            onMove={onMove}
                            onUpdate={onUpdate}
                            canMoveUp={index > 0}
                            canMoveDown={index < list.length - 1}
                            isOpen={openClipIds.has(clip.id)}
                            onOpen={() => setOpenClipIds(current => new Set(current).add(clip.id))}
                            onClose={() => setOpenClipIds(current => {
                                const next = new Set(current)
                                next.delete(clip.id)
                                return next
                            })}
                        />
                    )
                })}
            </div>
        </section>
    )
}

export const JourneyReplayClipsTab = memo(({settings}) => {
    const [addState, setAddState] = useState(emptyAddState())
    const [openClipIds, setOpenClipIds] = useState(() => new Set())
    const mainStore = useSnapshot(lgs.stores.main)
    const currentJourney = mainStore?.theJourney ?? lgs.theJourney ?? lgs.stores.main?.theJourney
    const currentClips = readCurrentClips(settings, currentJourney)

    const saveClips = useCallback((nextClips) => {
        syncClips(nextClips)
    }, [])

    const openAdd = useCallback(({slot, anchorId}) => {
        setAddState({
                        open: true,
                        slot,
                        anchorId,
                    })
    }, [])

    const addClip = useCallback((slot, definition) => {
        const current = readCurrentClips(settings, currentJourney)
        const listKey = listNameForSlot(slot)
        const list = [...(current[listKey] ?? [])]
        if (!canAddJourneyReplayClip(current, definition, slot)) {
            return
        }

        const instance = createJourneyReplayClipInstance(definition, slot, {params: {...definition.defaults}})
        if (!instance) {
            return
        }

        list.push(instance)
        saveClips({
                      ...current,
                      [listKey]: list,
                  })
        setOpenClipIds(currentIds => new Set(currentIds).add(instance.id))
    }, [currentJourney, saveClips, settings])

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

    const updateClip = useCallback((slot, index, patch = {}) => {
        const current = readCurrentClips(settings, currentJourney)
        const listKey = listNameForSlot(slot)
        const list = [...(current[listKey] ?? [])]
        if (!list[index]) {
            return
        }

        list[index] = {
            ...list[index],
            ...patch,
            params: {
                ...(list[index]?.params ?? {}),
                ...(patch?.params ?? {}),
            },
        }

        saveClips({
                      ...current,
                      [listKey]: list,
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
        const existing = current[listKey] ?? []
        const removed = existing[index]
        const list = existing.filter((_, currentIndex) => currentIndex !== index)
        saveClips({
                        ...current,
                        [listKey]:             list,
                    })
        if (removed?.id) {
            setOpenClipIds(currentIds => {
                const next = new Set(currentIds)
                next.delete(removed.id)
                return next
            })
        }
    }, [currentJourney, saveClips, settings])

    const startList = currentClips.start
    const stopList = currentClips.stop

    return (
        <div className="replay-clips-tab">
            <ClipList
                title="Start"
                slot={REPLAY_CLIP_SLOT_START}
                clips={currentClips}
                list={startList}
                onAdd={openAdd}
                onRemove={removeClip}
                onMove={moveClip}
                onUpdate={updateClip}
                addAnchorIdPrefix={`${REPLAY_CLIP_SLOT_START}-${ADD_POPUP_SUFFIX}`}
                openClipIds={openClipIds}
                setOpenClipIds={setOpenClipIds}
            />
            <ClipList
                title="Stop"
                slot={REPLAY_CLIP_SLOT_STOP}
                clips={currentClips}
                list={stopList}
                onAdd={openAdd}
                onRemove={removeClip}
                onMove={moveClip}
                onUpdate={updateClip}
                addAnchorIdPrefix={`${REPLAY_CLIP_SLOT_STOP}-${ADD_POPUP_SUFFIX}`}
                openClipIds={openClipIds}
                setOpenClipIds={setOpenClipIds}
            />
            <ClipAddPopup
                clips={currentClips}
                addState={addState}
                setAddState={setAddState}
                onAddClip={addClip}
            />
        </div>
    )
})
