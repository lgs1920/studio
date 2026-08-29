/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanelContent.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    CREDITS_WIDGET, LOGO_WIDGET, SCENE_WIDGETS_BOARD, VIDEO_WIDGETS_BOARD, LGS_VISUAL_WIDGET, TEXT_WIDGET, WIDGET_LAYER_START, WIDGET_LAYER_STEP,
}                                from '@Core/constants'
import { getNextTextWidgetPosition } from '@Components/Text/textWidgetPosition'
import {
    getManageableWidgets,
    openWidgetManagementDrawer,
} from '@Components/MainUI/widgets/openWidgetManagementDrawer'
import { WidgetGridOverlay }     from '@Components/MainUI/widgets/WidgetGridOverlay'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {
    DEFAULT_WIDGET_GRID_SETTINGS,
    getWidgetGridSettings,
    MAX_WIDGET_GRID_SIZE,
    MIN_WIDGET_GRID_SIZE,
    normalizeWidgetGridSize,
    WIDGET_GRID_SIZE_STEP,
}                                from '@Core/ui/widget-manager/widgetGridUtils'
import { isWidgetAvailable }     from '@Core/ui/widget-manager/widgetAvailability'
import { useOptionalSnapshot }    from '@Utils/ValtioUtils'
import { WaDivider, WaIcon, WaNumberInput, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                from 'classnames'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }           from 'valtio'

/**
 * Widget panel that shows available widgets grouped by category.
 * Handles event propagation to avoid conflicts with draggable parent containers.
 *
 * @param {Object} props
 * @param {Iterable<string>} props.groups - Group IDs to show in the panel
 * @returns {JSX.Element | null}
 */
export const WidgetsPanelContent = ({groups, themeClassName = 'wa-theme-lgs1920-on-map'}) => {
    const _widgetDeckPanel = useRef(null)
    const widgetDynamicRenderer = WidgetDynamicRenderer.instance
    const widget = useSnapshot(lgs.stores.ui.widget)
    const video = useSnapshot(lgs.stores.ui.video)
    const toolbars = useSnapshot(lgs.settings.ui.toolbars)
    const gridSnapshot = useOptionalSnapshot(lgs.settings?.ui?.widgets?.grid, DEFAULT_WIDGET_GRID_SETTINGS)
    const grid = useMemo(
        () => getWidgetGridSettings(gridSnapshot),
        [gridSnapshot.enabled, gridSnapshot.size, gridSnapshot.snap],
    )
    const [isInitialized, setIsInitialized] = useState(false)
    const isVideoBoardContext = video.editing
        || video.preRecording
        || video.recording
        || video.snapshot
        || video.finalizing
        || video.cropper?.widgetEditor === true
        || video.cropper?.ratioEditor === true
    const widgetsBoard = isVideoBoardContext ? VIDEO_WIDGETS_BOARD : SCENE_WIDGETS_BOARD

    // Counter to ensure new widgets are placed on top of the stack
    const _widgetIndex = useRef(WIDGET_LAYER_START)
    const availableGroups = useMemo(() => widgetDynamicRenderer.theGroups(groups), [groups, widgetDynamicRenderer])
    const canManageVideoWidgets = useMemo(
        () => getManageableWidgets(VIDEO_WIDGETS_BOARD, widget.list).length > 0,
        [widget.list],
    )

    /**
     * Synchronizes the global store map order with the zIndex values.
     * Required for consistent rendering order in Valtio snapshots.
     */
    const sortWidgetStore = useCallback(() => {
        const $list = lgs.stores.ui.widget.list
        const sortedEntries = Array.from($list.entries())
            .sort(([, a], [, b]) => (a.zIndex || 0) - (b.zIndex || 0))

        $list.clear()
        for (const [id, data] of sortedEntries) {
            $list.set(id, data)
        }
    }, [])

    /**
     * Resolve the next z-index above every regular widget on the active board.
     * Logo and Credits keep their dedicated fixed-layer ordering.
     *
     * @returns {number} Z-index for a newly created widget.
     */
    const nextWidgetZIndex = useCallback(() => {
        const currentMax = Array.from(lgs.stores.ui.widget.list.entries())
            .filter(([id, entry]) => {
                const type = id.split('#')[0]
                return entry?.widgetsBoard === widgetsBoard
                    && type !== CREDITS_WIDGET
                    && type !== LOGO_WIDGET
            })
            .reduce((maximum, [, entry]) => {
                const zIndex = Number(entry?.zIndex)
                return Number.isFinite(zIndex) ? Math.max(maximum, zIndex) : maximum
            }, WIDGET_LAYER_START - WIDGET_LAYER_STEP)
        const zIndex = Math.max(_widgetIndex.current, currentMax + WIDGET_LAYER_STEP)
        _widgetIndex.current = zIndex + WIDGET_LAYER_STEP
        return zIndex
    }, [widgetsBoard])

    /**
     * Adds a new instance of a widget to the map.
     * @param {string} group
     * @param {string} key
     * @param {Object} [props={}] - Existing widget properties (e.g. from DB)
     */
    const addWidget = useCallback((group, key, props = {}) => {
        const id = !/#/.test(key) ? __.ui.widgetManager.defineElementId(group, key) : key

        // Fetch definition to determine if zIndex is applicable
        const groupsMap = widgetDynamicRenderer.theGroups([group])
        const groupDef = groupsMap.get(group)
        const widgetDef = groupDef?.widgets.get(key.split('#')[0])

        if (!widgetDef || !isWidgetAvailable(widgetDef, {widgetsBoard})) {
            return
        }

        const isNewTextWidget = key === TEXT_WIDGET && props.left === undefined && props.top === undefined
        const textWidgetPosition = isNewTextWidget ? getNextTextWidgetPosition() : {}

        const additionalProps = {}

        // Only apply zIndex to visual components
        if (widgetDef?.type === LGS_VISUAL_WIDGET) {
            // Preserve imported positions while placing new widgets above the current stack.
            additionalProps.zIndex = props.zIndex ?? nextWidgetZIndex()
        }

        widgetDynamicRenderer.renderWidget(group, id, {
            ...props,
            ...textWidgetPosition,
            widgetsBoard,
            forceRefresh: true,
            ...additionalProps,
        })

        // Ensure the global list Map is ordered correctly after insertion
        sortWidgetStore()
    }, [nextWidgetZIndex, sortWidgetStore, widgetDynamicRenderer, widgetsBoard])

    /**
     * Stops event propagation for both mouse and touch interactions.
     * @param {MouseEvent|TouchEvent} e
     */
    const handleInteraction = (e) => {
        e.stopPropagation()
    }

    const handleKeyboardAction = (event, action) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        action()
    }

    const getWidgetStats = (groupKey, widgetKey, widgetDef = null) => {
        const baseKey = widgetKey.split('#')[0]
        const definition = widgetDef ?? __.widgets.get(groupKey)?.widgets?.get(baseKey)
        const max = definition?.max ?? 1
        let count = 0

        for (const [id, entry] of widget.cache.entries()) {
            if (entry?.group !== groupKey || entry?.widgetsBoard !== widgetsBoard) {
                continue
            }
            if (id.split('#')[0] === baseKey) {
                count++
            }
        }

        return {
            count,
            max,
            remaining:  Math.max(0, max - count),
            maxReached: count >= max,
        }
    }

    const getRemainingLabel = stats =>
        stats.max > 1 && stats.remaining > 0 && stats.remaining < 5 ? `(${stats.remaining})` : ''

    const ensureGridSettings = () => {
        lgs.settings.ui.widgets ??= {}
        lgs.settings.ui.widgets.grid ??= {...DEFAULT_WIDGET_GRID_SETTINGS}
        lgs.settings.ui.widgets.grid.enabled ??= DEFAULT_WIDGET_GRID_SETTINGS.enabled
        lgs.settings.ui.widgets.grid.size ??= DEFAULT_WIDGET_GRID_SETTINGS.size
        lgs.settings.ui.widgets.grid.snap ??= DEFAULT_WIDGET_GRID_SETTINGS.snap
        return lgs.settings.ui.widgets.grid
    }

    const updateGridSettings = (updates) => {
        Object.assign(ensureGridSettings(), updates)
    }

    const updateGridEnabled = (event) => {
        updateGridSettings({enabled: event.target.checked})
    }

    const updateGridSize = (event) => {
        updateGridSettings({size: normalizeWidgetGridSize(event.target.value, grid.size)})
    }

    const updateGridSnap = (event) => {
        updateGridSettings({snap: event.target.checked})
    }

    useEffect(() => {
        /**
         * Load widgets already existing in the state/database.
         */
        const displayWidgetsInBase = async () => {
            for (const [groupId] of availableGroups.entries()) {
                const widgets = await __.ui.widgetManager.getWidgetsByGroup(groupId)
                for (const widgetToRender of widgets) {
                    if (widgetToRender?.widgetsBoard !== widgetsBoard) {
                        continue
                    }
                    // Pass existing widget data to preserve its original zIndex
                    addWidget(groupId, widgetToRender.id, widgetToRender)
                }
            }
        }

        /**
         * Trigger rendering for mandatory widgets not yet present in the list.
         */
        const displayMandatoryWidgets = () => {
            for (const [groupId, group] of availableGroups.entries()) {
                for (const [widgetId, widgetDef] of group.widgets) {
                    const existingMandatory = Array.from(lgs.stores.ui.widget.list.entries()).some(([id, entry]) => {
                        return id.startsWith(widgetId) && entry?.widgetsBoard === widgetsBoard
                    })
                    if (widgetDef.mandatory && !existingMandatory && isWidgetAvailable(widgetDef, {widgetsBoard})) {
                        addWidget(groupId, widgetId)
                    }
                }
            }
        }

        const initializePanel = async () => {
            await displayWidgetsInBase()
            displayMandatoryWidgets()
            setIsInitialized(true)
        }

        initializePanel()
    }, [addWidget, availableGroups, widgetsBoard])

    if (!isInitialized) {
        return null
    }

    const hasJourney = Boolean(lgs.theJourney)

    return (
        <div
            className={`lgs-widget-menu widget-deck-panel lgs-card ${themeClassName}`}
            ref={_widgetDeckPanel}
            style={{opacity: toolbars.opacity}}
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
        >
            <WidgetGridOverlay widgetsBoard={widgetsBoard}/>

            <div className="widget-deck-entry widget-deck-title">
                <WaIcon name="box"/>
                <span>Widgets</span>
            </div>

            <ul className="widget-group widget-grid-settings">
                <li className="widget-deck-entry widget-grid-setting widget-no-hover lgs-widget-no-drag">
                    <WaSwitch
                        className="widget-grid-switch"
                        size="xs"
                        label-at-start
                        checked={grid.enabled}
                        onInput={updateGridEnabled}
                    >
                        <span className="widget-grid-switch-label">
                            <WaIcon name="frame" variant="regular"/>
                            <span>Grid</span>
                        </span>
                    </WaSwitch>

                    {grid.enabled && (
                        <div className="widget-grid-setting-content">
                            <div className="widget-grid-setting-row">
                                <WaNumberInput
                                    className="widget-grid-size-input"
                                    size="s"
                                    appearance="filled"
                                    aria-label="Grid size"
                                    min={MIN_WIDGET_GRID_SIZE}
                                    max={MAX_WIDGET_GRID_SIZE}
                                    step={WIDGET_GRID_SIZE_STEP}
                                    value={`${grid.size}`}
                                    onInput={updateGridSize}
                                >
                                    <span slot="end">px</span>
                                </WaNumberInput>
                            </div>
                            <div className="widget-grid-setting-row">
                                <WaSwitch
                                    className="widget-grid-switch"
                                    size="xs"
                                    label-at-start
                                    checked={grid.snap}
                                    onInput={updateGridSnap}
                                >
                                    <span className="widget-grid-switch-label">
                                        <WaIcon name="magnet" variant="regular"/>
                                        <span>Snap to grid</span>
                                    </span>
                                </WaSwitch>
                            </div>
                        </div>
                    )}
                </li>
            </ul>

            {[...availableGroups.entries()].map(([groupKey, groupValue]) => (
                <ul key={groupKey} className="widget-group">
                    {[...groupValue.widgets.entries()].map(([widgetKey, widgetDef]) => {
                        if (widgetDef.mandatory
                            || (widgetKey === 'journey-stats-widget' && !hasJourney)
                            || !isWidgetAvailable(widgetDef, {widgetsBoard})) {
                            return null
                        }
                        const stats = getWidgetStats(groupKey, widgetKey, widgetDef)
                        const isDisabled = stats.maxReached
                        const remainingLabel = getRemainingLabel(stats)

                        return (
                            <li
                                key={`${groupKey}-${widgetKey}`}
                                role="button"
                                tabIndex={isDisabled ? -1 : 0}
                                aria-disabled={isDisabled}
                                onClick={() => !isDisabled && addWidget(groupKey, widgetKey)}
                                onMouseDown={handleInteraction}
                                onTouchStart={handleInteraction}
                                onKeyDown={(event) => !isDisabled && handleKeyboardAction(event, () => addWidget(groupKey, widgetKey))}
                                className={classNames(
                                    'widget-deck-entry', 'widget-deck-item', 'small',
                                    {'widget-menu-disabled': isDisabled},
                                )}
                            >
                                <WaIcon name={widgetDef.icon} variant="regular"/>
                                <span className="widget-name">{widgetDef.name}</span>
                                {remainingLabel && <span className="widget-remaining">{remainingLabel}</span>}
                            </li>
                        )
                    })}
                </ul>
            ))}

            {canManageVideoWidgets && (
                <ul className="widget-group widget-group-management">
                    <li className="widget-deck-entry widget-deck-divider widget-no-hover">
                        <WaDivider/>
                    </li>
                    <li
                        role="button"
                        tabIndex={0}
                        className={classNames('widget-deck-entry', 'widget-deck-item', 'small', 'widget-deck-management')}
                        onClick={() => openWidgetManagementDrawer(VIDEO_WIDGETS_BOARD)}
                        onKeyDown={(event) => handleKeyboardAction(event, () => openWidgetManagementDrawer(VIDEO_WIDGETS_BOARD))}
                        onMouseDown={handleInteraction}
                        onTouchStart={handleInteraction}
                    >
                        <WaIcon name="layer" variant="regular"/>
                        <span className="widget-name">{'Manage widgets'}</span>
                    </li>
                </ul>
            )}
        </div>
    )
}
