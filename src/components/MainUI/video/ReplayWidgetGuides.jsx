/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayWidgetGuides.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-22
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {VIDEO_WIDGETS_BOARD, WIDGET_LAYER_START} from '@Core/constants'
import {
    journeyReplayExpertWidgetGuides,
    normalizeReplayWidgetGuides,
    nextReplayWidgetGuidePosition,
    replayWidgetGuidePositionFromPointer,
    setReplayWidgetGuidePlacement,
    setReplayWidgetGuides,
    snapReplayWidgetGuidePosition,
    syncJourneyReplayExpertWidgetGuides,
} from '@Core/ui/replay/ReplayWidgetGuideUtils'
import {REPLAY_USER_MODE_EXPERT, resolveJourneyReplayUserMode} from '@Core/ui/replay/ReplayUserModeConstants'
import {WaIcon} from '@awesome.me/webawesome/dist/react'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {useSnapshot} from 'valtio'

const EMPTY_GRID = {enabled: false, snap: false, size: 30}
const GUIDE_SNAP_THRESHOLD = 10

/**
 * Compare the geometry used to position the guide overlay.
 *
 * @param {Object|null} a - Previous board rectangle.
 * @param {Object|null} b - Current board rectangle.
 * @returns {boolean} Whether both rectangles have identical geometry.
 */
const sameRect = (a, b) => a?.left === b?.left
    && a?.top === b?.top
    && a?.width === b?.width
    && a?.height === b?.height

/**
 * Read a usable viewport rectangle from the Replay widget board.
 *
 * @param {HTMLElement|null} board - Replay widget board element.
 * @returns {Object|null} Board bounds or null when the board has no area.
 */
const getBoardRect = board => {
    const rect = board?.getBoundingClientRect?.()
    if (!rect || rect.width <= 0 || rect.height <= 0) {
        return null
    }

    return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
    }
}

/** Create a unique identifier for a newly placed guide. */
const createGuideId = () => globalThis.crypto?.randomUUID?.()
    ?? `guide-${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * Renders and edits crop-relative alignment guides during Expert Replay preparation.
 *
 * @returns {JSX.Element|null} The interactive guide overlay.
 */
export const ReplayWidgetGuides = () => {
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot(lgs.stores.ui.video)
    const widgetList = useSnapshot(lgs.stores.ui.widget.list)
    const gridSnapshot = useOptionalSnapshot(lgs.settings?.ui?.widgets?.grid, EMPTY_GRID)
    const grid = useMemo(() => ({
        enabled: Boolean(gridSnapshot.enabled),
        snap: Boolean(gridSnapshot.snap),
        size: gridSnapshot.size,
    }), [gridSnapshot.enabled, gridSnapshot.size, gridSnapshot.snap])
    const journeySlug = useProxyValue(lgs.stores.main, main => main.theJourney?.slug ?? null, null)
    const isActive = video.editing === true
        && replay.recordingSync === true
        && replay.basicPreparationActive !== true
        && resolveJourneyReplayUserMode({replay, settings: lgs.settings?.ui?.replay}) === REPLAY_USER_MODE_EXPERT
    const [rect, setRect] = useState(null)
    const [menu, setMenu] = useState(null)
    const boardRef = useRef(null)
    const dragRef = useRef(null)
    const menuElementRef = useRef(null)

    const journey = lgs.stores.main?.theJourney ?? lgs.theJourney
    const guides = normalizeReplayWidgetGuides(replay.alignmentGuides)

    /**
     * Normalize guides, update Replay runtime state, and save them to the Journey.
     *
     * @param {Array<Object>} nextGuides - Guide list to persist.
     * @returns {Array<Object>} Normalized guides saved to runtime state.
     */
    const persistGuides = useCallback(nextGuides => {
        const normalized = setReplayWidgetGuides(nextGuides)
        syncJourneyReplayExpertWidgetGuides(normalized, lgs.stores.main?.theJourney ?? lgs.theJourney)
    }, [])

    useEffect(() => {
        setReplayWidgetGuidePlacement(null)
        setMenu(null)
        if (isActive) {
            setReplayWidgetGuides(journeyReplayExpertWidgetGuides(journey))
        }
        else {
            setReplayWidgetGuides([])
        }
    }, [isActive, journey, journeySlug])

    useEffect(() => {
        if (!isActive) {
            setRect(null)
            boardRef.current = null
            return undefined
        }

        let frame = null
        let observedBoard = null
        let resizeObserver = null
        /** Schedule a measured update of the active Replay crop bounds. */
        const updateRect = () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            frame = requestAnimationFrame(() => {
                frame = null
                const board = __.ui.widgetManager.resolveWidgetsBoardContainer(VIDEO_WIDGETS_BOARD)
                if (board !== observedBoard) {
                    resizeObserver?.disconnect()
                    observedBoard = board
                    if (observedBoard) {
                        resizeObserver?.observe(observedBoard)
                    }
                }
                boardRef.current = board ?? null
                const nextRect = getBoardRect(board)
                setRect(current => sameRect(current, nextRect) ? current : nextRect)
            })
        }

        resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateRect)
        updateRect()
        const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(updateRect)
        mutationObserver?.observe(document.body, {childList: true, subtree: true})
        window.addEventListener('resize', updateRect)
        window.addEventListener('scroll', updateRect, true)

        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            resizeObserver?.disconnect()
            mutationObserver?.disconnect()
            window.removeEventListener('resize', updateRect)
            window.removeEventListener('scroll', updateRect, true)
        }
    }, [isActive])

    useEffect(() => {
        if (menu) {
            menuElementRef.current?.querySelector('[role="menuitem"]')?.focus()
        }
    }, [menu])

    useEffect(() => {
        if (!isActive) {
            return undefined
        }

        /** Handle Escape by closing the menu or cancelling guide placement. */
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                if (menu) {
                    setMenu(null)
                }
                else {
                    setReplayWidgetGuidePlacement(null)
                }
            }
        }
        /** Close the guide menu when the user clicks outside it. */
        const handlePointerDown = event => {
            if (menu && !event.target.closest?.('.replay-widget-guide-context-menu')) {
                setMenu(null)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('pointerdown', handlePointerDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('pointerdown', handlePointerDown)
        }
    }, [isActive, menu])

    /**
     * Read visible Replay widgets as candidate guide snap targets.
     *
     * @returns {DOMRect[]} Bounds of visible peer widgets on the Replay board.
     */
    const readPeerWidgetRects = useCallback(() => {
        const board = boardRef.current
        if (!board) {
            return []
        }
        const boardWidgets = new Set(Array.from(widgetList.entries())
            .filter(([, entry]) => entry?.widgetsBoard === VIDEO_WIDGETS_BOARD)
            .map(([id]) => id))
        return Array.from(document.querySelectorAll('.lgs-widget-container[data-widget] .lgs-widget'))
            .flatMap(element => {
                const widgetId = element.parentElement?.dataset.widget
                const config = widgetId ? __.ui.widgetManager.getWidgetConfig?.(widgetId) : null
                if (!boardWidgets.has(widgetId) && config?.widgetsBoard !== VIDEO_WIDGETS_BOARD) {
                    return []
                }
                const widgetRect = element.getBoundingClientRect()
                return widgetRect.width > 0 && widgetRect.height > 0 ? [widgetRect] : []
            })
    }, [widgetList])

    /**
     * Convert a pointer coordinate to a crop-relative position and apply guide snapping.
     *
     * @param {'horizontal'|'vertical'} orientation - Guide orientation.
     * @param {number} clientCoordinate - Pointer coordinate along the guide axis.
     * @param {Object} [sourceRect=rect] - Crop board bounds.
     * @returns {number} Snapped crop-relative position.
     */
    const resolvePosition = useCallback((orientation, clientCoordinate, sourceRect = rect) => {
        const position = replayWidgetGuidePositionFromPointer(orientation, clientCoordinate, sourceRect)
        return snapReplayWidgetGuidePosition({
            orientation,
            position,
            rect: sourceRect,
            widgetRects: readPeerWidgetRects(),
            grid,
            threshold: GUIDE_SNAP_THRESHOLD,
        })
    }, [grid, readPeerWidgetRects, rect])

    /** Add a guide at the next default position for the selected orientation. */
    const addGuideAt = () => {
        const orientation = lgs.stores.replay.guidePlacementOrientation
        if (!orientation || !rect) {
            return
        }

        const position = nextReplayWidgetGuidePosition(orientation, guides)
        if (position === null) {
            setReplayWidgetGuidePlacement(null)
            return
        }

        const nextGuides = [...guides, {id: createGuideId(), orientation, position, blocked: false}]
        setReplayWidgetGuidePlacement(null)
        persistGuides(nextGuides)
    }

    /**
     * Move a guide to the pointer's snapped crop-relative position.
     *
     * @param {Object} guide - Guide being moved.
     * @param {PointerEvent} event - Pointer event containing viewport coordinates.
     */
    const updateGuidePosition = (guide, event) => {
        if (!rect) {
            return
        }
        const coordinate = guide.orientation === 'horizontal' ? event.clientY : event.clientX
        const position = resolvePosition(guide.orientation, coordinate)
        setReplayWidgetGuides(guides.map(item => item.id === guide.id ? {...item, position} : item))
    }

    /**
     * Handles movement over a guide and updates its position when a drag is active.
     * @param {Object} guide - Guide currently under the pointer.
     * @param {PointerEvent} event - Pointer event from the guide hit area.
    */
    const handleGuidePointerMove = (guide, event) => {
        if (dragRef.current?.id !== guide.id || dragRef.current.pointerId !== event.pointerId) {
            return
        }
        updateGuidePosition(guide, event)
    }

    /**
     * Begin dragging a movable guide and capture its pointer.
     *
     * @param {Object} guide - Guide receiving the pointer.
     * @param {PointerEvent} event - Pointer event from the guide hit area.
     */
    const handleGuidePointerDown = (guide, event) => {
        event.preventDefault()
        event.stopPropagation()
        if (guide.blocked || event.button !== 0) {
            return
        }
        dragRef.current = {id: guide.id, pointerId: event.pointerId}
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }

    /**
     * Finish the active guide drag and persist its final position.
     *
     * @param {Object} guide - Guide releasing the pointer.
     * @param {PointerEvent} event - Pointer event from the guide hit area.
     */
    const handleGuidePointerUp = (guide, event) => {
        if (dragRef.current?.id !== guide.id || dragRef.current.pointerId !== event.pointerId) {
            return
        }
        dragRef.current = null
        persistGuides(lgs.stores.replay.alignmentGuides)
    }

    /**
     * Open the guide action menu at the pointer location.
     *
     * @param {Object} guide - Guide whose actions are requested.
     * @param {MouseEvent} event - Context menu event from the guide.
     */
    const handleGuideContextMenu = (guide, event) => {
        event.preventDefault()
        event.stopPropagation()
        setMenu({
            guideId: guide.id,
            left: Math.min(event.clientX, window.innerWidth - 170),
            top: Math.min(event.clientY, window.innerHeight - 100),
        })
    }

    /**
     * Apply the selected block or remove action to the active guide.
     *
     * @param {'toggle'|'remove'} action - Guide action selected by the user.
     */
    const runGuideAction = action => {
        const selectedGuide = guides.find(guide => guide.id === menu?.guideId)
        if (!selectedGuide) {
            setMenu(null)
            return
        }

        const nextGuides = action === 'remove'
            ? guides.filter(guide => guide.id !== selectedGuide.id)
            : guides.map(guide => guide.id === selectedGuide.id ? {...guide, blocked: !guide.blocked} : guide)
        persistGuides(nextGuides)
        setMenu(null)
    }

    /**
     * Handles keyboard activation and navigation within the guide context menu.
     * @param {KeyboardEvent} event - Keyboard event from the menu.
     */
    const handleGuideMenuKeyDown = event => {
        const items = Array.from(menuElementRef.current?.querySelectorAll('[role="menuitem"]') ?? [])
        const currentIndex = items.indexOf(event.target.closest?.('[role="menuitem"]'))
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            items[currentIndex]?.click()
            return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const direction = event.key === 'ArrowDown' ? 1 : -1
            const nextIndex = (currentIndex + direction + items.length) % items.length
            items[nextIndex]?.focus()
        }
    }

    if (!isActive || !rect || typeof document === 'undefined') {
        return null
    }

    const placementOrientation = replay.guidePlacementOrientation

    return createPortal(
        <div
            className={`replay-widget-guides-overlay${placementOrientation ? ' is-placing' : ''}`}
            style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                zIndex: WIDGET_LAYER_START + 1002,
                pointerEvents: placementOrientation ? 'auto' : 'none',
            }}
            onClick={event => {
                if (event.target === event.currentTarget) {
                    addGuideAt()
                }
            }}
        >
            {guides.map(guide => (
                <button
                    key={guide.id}
                    type="button"
                    className={`replay-widget-guide replay-widget-guide-${guide.orientation}${guide.blocked ? ' is-blocked' : ''}`}
                    style={guide.orientation === 'vertical'
                        ? {
                            left: `${guide.position * 100}%`,
                            cursor: guide.blocked ? 'context-menu' : 'ew-resize',
                        }
                        : {
                            top: `${guide.position * 100}%`,
                            cursor: guide.blocked ? 'context-menu' : 'ns-resize',
                        }}
                    aria-label={`${guide.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'} guide${guide.blocked ? ', blocked' : ''}`}
                    aria-pressed={guide.blocked}
                    onClick={event => event.stopPropagation()}
                    onPointerDown={event => handleGuidePointerDown(guide, event)}
                    onPointerMove={event => handleGuidePointerMove(guide, event)}
                    onPointerUp={event => handleGuidePointerUp(guide, event)}
                    onPointerCancel={event => handleGuidePointerUp(guide, event)}
                    onContextMenu={event => handleGuideContextMenu(guide, event)}
                    onKeyDown={event => {
                        if (event.key === 'Delete' || event.key === 'Backspace') {
                            event.preventDefault()
                            persistGuides(guides.filter(item => item.id !== guide.id))
                        }
                        else if (event.key === ' ') {
                            event.preventDefault()
                            persistGuides(guides.map(item => item.id === guide.id ? {...item, blocked: !item.blocked} : item))
                        }
                    }}
                />
            ))}
            {menu && (
                <div
                    ref={menuElementRef}
                    className="replay-widget-guide-context-menu lgs-context-menu visible lgs-card wa-theme-lgs1920-on-map"
                    role="menu"
                    aria-label="Guide actions"
                    style={{left: `${menu.left}px`, top: `${menu.top}px`}}
                    onPointerDown={event => event.stopPropagation()}
                    onKeyDown={handleGuideMenuKeyDown}
                >
                    <ul role="none">
                        <li
                            className="replay-widget-guide-context-menu-item"
                            role="menuitem"
                            aria-label={guides.find(guide => guide.id === menu.guideId)?.blocked ? 'Unblock' : 'Block'}
                            tabIndex={0}
                            onClick={() => runGuideAction('toggle')}
                        >
                            <WaIcon
                                name={guides.find(guide => guide.id === menu.guideId)?.blocked ? 'lock-open' : 'lock'}
                                variant="solid"
                                aria-hidden="true"
                            />
                            <span>{guides.find(guide => guide.id === menu.guideId)?.blocked ? 'Unblock' : 'Block'}</span>
                        </li>
                        <li
                            className="replay-widget-guide-context-menu-item"
                            role="menuitem"
                            aria-label="Remove"
                            tabIndex={0}
                            onClick={() => runGuideAction('remove')}
                        >
                            <WaIcon name="trash-can" variant="solid" aria-hidden="true"/>
                            <span>Remove</span>
                        </li>
                    </ul>
                </div>
            )}
        </div>,
        document.body,
    )
}
