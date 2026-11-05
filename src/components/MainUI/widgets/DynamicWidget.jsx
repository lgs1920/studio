/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DynamicWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-11-07
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WidgetDynamicRenderer }         from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {resolveWidgetCatalogGroup} from '@Core/ui/widget-manager/resolveWidgetCatalogGroup'
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { WidgetContentOnlyContext } from '@Components/MainUI/widgets/WidgetContexts'
import { WaSpinner } from '@awesome.me/webawesome/dist/react'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { Suspense, useEffect, useRef, useState } from 'react'

/**
 * Resolves the concrete widget instance associated with a requested widget key.
 *
 * @param {string} id - Requested base or concrete widget identifier.
 * @param {string|null} widgetsBoard - Optional widget board filter.
 * @returns {string} Concrete widget identifier when one exists.
 */
const resolveWidgetInstanceId = (id, widgetsBoard = null) => {
    const widgetList = lgs.stores.ui.widget.list
    const exactEntry = widgetList.get(id)
    if (exactEntry && (!widgetsBoard || exactEntry.widgetsBoard === widgetsBoard)) {
        return id
    }

    return Array.from(widgetList.entries()).find(([widgetId, entry]) => {
        return widgetId.startsWith(`${id}#`) && (!widgetsBoard || entry?.widgetsBoard === widgetsBoard)
    })?.[0] ?? id
}

/**
 * Resolve a localized catalogue label for a loading widget.
 *
 * @param {string} widgetId - Base or concrete widget identifier.
 * @param {string|null} group - Preferred catalogue group.
 * @returns {string} Widget label or its base identifier.
 */
const resolveWidgetName = (widgetId, group = null) => {
    const baseId = String(widgetId ?? '').split('#')[0]
    const catalog = globalThis.__?.widgets
    const preferred = group ? catalog?.get?.(group)?.widgets?.get?.(baseId) : null
    if (preferred?.name) {
        return preferred.name
    }

    const definition = Array.from(catalog?.values?.() ?? [])
        .map(entry => entry?.widgets?.get?.(baseId))
        .find(candidate => candidate?.name)
    return definition?.name ?? baseId
}

/**
 * Report a pending widget component to its board or render the legacy inline spinner.
 *
 * @param {Object} props - Loading widget and board callback inputs.
 * @returns {import('react').ReactElement|null} Loading fallback for the active board.
 */
const WidgetLoadingFallback = ({id, props, onLoadingChange}) => {
    const isVideoBoard = props.widgetsBoard === VIDEO_WIDGETS_BOARD
                          && typeof onLoadingChange === 'function'
    const group = props.group ?? lgs.stores.ui.widget.list.get(id)?.group ?? null
    const widgetName = resolveWidgetName(id, group)

    useEffect(() => {
        if (!isVideoBoard) {
            return undefined
        }

        onLoadingChange(id, widgetName)
        return () => onLoadingChange(id, null)
    }, [id, isVideoBoard, onLoadingChange, widgetName])

    if (isVideoBoard) {
        return null
    }

    return <WaSpinner style={{fontSize: '2rem'}}/>
}

/**
 * Clear the board loading status after the lazy widget has committed successfully.
 *
 * @param {Object} props - Loaded widget and callback inputs.
 * @returns {import('react').ReactNode} Loaded widget content.
 */
const WidgetLoadingResolved = ({id, props, onLoadingChange, children}) => {
    useEffect(() => {
        if (props.widgetsBoard === VIDEO_WIDGETS_BOARD) {
            onLoadingChange?.(id, null)
        }
    }, [id, onLoadingChange, props.widgetsBoard])

    return children
}

/**
 * Dynamically renders a registered widget using React Suspense for lazy loading.
 * Displays a loading fallback while the registered widget component resolves.
 *
 * @param {Object} props
 * @param {string} props.id - Unique widget identifier (key in __.ui.widgetCache)
 * @param {Object} [props.context] - Contextual data passed down to the widget
 * @param {Object} [props.props={}] - Additional props forwarded to the widget
 * @param {Function|null} [props.onLoadingChange] - Reports loading video-board widgets to their portal.
 * @returns {import('react').ReactElement|null} Suspense-wrapped widget or null if not registered
 */
export const DynamicWidget = ({id, context, props = {}, onLoadingChange = null}) => (
    <DynamicWidgetInstance key={`${id}:${props.widgetsBoard ?? ''}`}
        id={id} context={context} props={props} onLoadingChange={onLoadingChange}/>
)

/**
 * Load one widget identity while allowing its presentation props to keep changing.
 * @param {Object} options - Widget identity, context, and current presentation props.
 * @returns {import('react').ReactElement|null} Resolved widget instance.
 */
const DynamicWidgetInstance = ({id, context, props, onLoadingChange}) => {
    const widgetStore = useOptionalSnapshot(lgs.stores.ui.widget)
    const _loadOptions = useRef(props)
    _loadOptions.current = props
    const resolvedWidgetId = resolveWidgetInstanceId(id, props.widgetsBoard)
    const [widgetState, setWidgetState] = useState(() => ({
        component: __.ui.widgetCache.get(id)?.component ?? null,
        widgetId:  resolvedWidgetId,
        resolved:  Boolean(__.ui.widgetCache.get(id)?.component),
    }))
    const LazyWidget = widgetState.component
    const reattachSelection = widgetStore.reattachSelection

    useEffect(() => {
        let cancelled = false

        if (!LazyWidget) {
            ensureWidget(id, _loadOptions.current)
                .then(result => {
                    if (!cancelled) {
                        setWidgetState({...result, resolved: true})
                    }
                })
                .catch(error => {
                    if (!cancelled) {
                        console.error(`[DynamicWidget] Failed to render widget "${id}":`, error)
                        onLoadingChange?.(id, null)
                        setWidgetState({component: null, widgetId: id, resolved: true})
                    }
                })
        }

        return () => {
            cancelled = true
        }
    }, [id, LazyWidget, onLoadingChange])

    useEffect(() => {
        const requestMatches = reattachSelection?.id === widgetState.widgetId
                              || reattachSelection?.id === id
        if (props.detached || !LazyWidget || !requestMatches) {
            return undefined
        }

        const frame = requestAnimationFrame(() => {
            if (lgs.stores.ui.widget.undocked?.id) {
                return
            }

            const config = __.ui.widgetManager.getWidgetConfig(widgetState.widgetId)
            const rotation = Number(config?.rotate)
            lgs.stores.ui.widget.current = {
                ...(lgs.stores.ui.widget.current ?? {}),
                id:     widgetState.widgetId,
                rotate: Number.isFinite(rotation) ? rotation : 0,
            }

            const currentRequest = lgs.stores.ui.widget.reattachSelection
            if (currentRequest?.id === reattachSelection.id
                && currentRequest.request === reattachSelection.request) {
                lgs.stores.ui.widget.reattachSelection = {id: null, request: 0}
            }
        })

        return () => cancelAnimationFrame(frame)
    }, [LazyWidget, id, props.detached, reattachSelection?.id, reattachSelection?.request, widgetState.widgetId])

    if (!props.detached && widgetStore.undocked?.id === widgetState.widgetId) {
        return null
    }

    if (!LazyWidget) {
        if (widgetState.resolved) {
            return null
        }

        if (props.widgetsBoard !== VIDEO_WIDGETS_BOARD || typeof onLoadingChange !== 'function') {
            return null
        }

        return <WidgetLoadingFallback id={id} props={props} onLoadingChange={onLoadingChange}/>
    }

    // Explicit component reference for clarity and potential future debugging/hooks
    const Component = LazyWidget

    return (
        <WidgetContentOnlyContext.Provider value={{detached: Boolean(props.detached)}}>
            <Suspense fallback={<WidgetLoadingFallback id={id} props={props} onLoadingChange={onLoadingChange}/> }>
                <WidgetLoadingResolved id={id} props={props} onLoadingChange={onLoadingChange}>
                    <Component id={widgetState.widgetId} {...props} context={context || props}/>
                </WidgetLoadingResolved>
            </Suspense>
        </WidgetContentOnlyContext.Provider>
    )
}

/**
 * Loads a widget component and returns the concrete instance identifier selected by the renderer.
 *
 * @param {string} id - Requested widget identifier.
 * @param {Object} props - Widget rendering properties.
 * @returns {Promise<{component: Function|null, widgetId: string}>} Loaded widget state.
 */
const ensureWidget = async (id, props = {}) => {
    const cache = __.ui.widgetCache.get(id)
    if (cache?.component) {
        return {
            component: cache.component,
            widgetId:  resolveWidgetInstanceId(id, props.widgetsBoard),
        }
    }

    const entity = lgs.stores.ui.widget.list.get(id) ?? {}
    const group = resolveWidgetCatalogGroup(id, {
        widgetsBoard: entity.widgetsBoard ?? props.widgetsBoard ?? cache?.widgetsBoard,
        group: cache?.group ?? entity.group ?? props.group,
    }) ?? cache?.group ?? entity.group ?? props.group
    if (!group) {
        // Some imperative widgets own their DOM through a regular Widget host
        // and only appear in the reactive list for selection or positioning.
        // They are not entries in the dynamic widget catalog.
        return {component: null, widgetId: id}
    }

    const renderer = WidgetDynamicRenderer.instance
    const widgetsBoard = entity.widgetsBoard ?? props.widgetsBoard ?? cache?.widgetsBoard
    const zIndex = entity.zIndex ?? props.zIndex ?? cache?.zIndex
    const LazyWidget = await renderer.renderWidget(group, id, {widgetsBoard, forceRefresh: true, zIndex})
    if (LazyWidget) {
        const widgetId = resolveWidgetInstanceId(id, widgetsBoard)
        return {component: LazyWidget, widgetId}
    }

    return {component: null, widgetId: id}
}
