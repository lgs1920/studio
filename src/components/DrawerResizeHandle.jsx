/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DrawerResizeHandle.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-31
 * Last modified: 2026-09-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MOBILE_MAX, START } from '@Core/constants'
import {
    clampDrawerWidth,
    DRAWER_RESIZE_DEFAULT_WIDTH,
    DRAWER_RESIZE_HANDLE_WIDTH,
    DRAWER_RESIZE_KEYBOARD_LARGE_STEP,
    DRAWER_RESIZE_KEYBOARD_STEP,
    getDrawerResizeBounds,
    getDrawerResizeDelta,
    isResizableDrawerPlacement,
} from '@Core/ui/panels/drawerResize'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Reads the current drawer width or falls back to the shared desktop default.
 *
 * @param {HTMLElement} drawer - Drawer custom element.
 * @returns {number} Initial drawer width in pixels.
 */
const getInitialDrawerWidth = drawer => {
    const dialogWidth = drawer?.shadowRoot?.querySelector('[part~="dialog"]')
        ?.getBoundingClientRect?.().width
    const drawerWidth = drawer?.getBoundingClientRect?.().width
    const width = [dialogWidth, drawerWidth].find(value => Number.isFinite(value) && value > 0)
    return width ?? DRAWER_RESIZE_DEFAULT_WIDTH
}

/**
 * Returns whether the current document is using the mobile layout.
 *
 * @returns {boolean} Whether desktop side-drawer resizing must be disabled.
 */
const isMobileLayout = () => typeof document !== 'undefined'
    && (document.body?.classList.contains('mobile')
        || (typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX))

/**
 * Resizable overlay handle for a desktop side drawer.
 *
 * @param {Object} props - Component properties.
 * @param {HTMLElement} props.drawer - Drawer custom element.
 * @param {string} props.drawerId - Drawer identifier used for accessible text.
 * @param {string} props.placement - Web Awesome drawer placement.
 * @param {number|string} [props.resizeMax] - Optional drawer-specific maximum width.
 * @returns {Object|null} Resize handle or nothing for unsupported layouts.
 */
export const DrawerResizeHandle = ({drawer, drawerId, placement, resizeMax}) => {
    const _handle = useRef(null)
    const _gesture = useRef(null)
    const _highlightTimeout = useRef(null)
    const [width, setWidth] = useState(() => clampDrawerWidth(
        getInitialDrawerWidth(drawer),
        getDrawerResizeBounds(undefined, resizeMax),
    ))
    const [mobile, setMobile] = useState(isMobileLayout)
    const [portalTarget, setPortalTarget] = useState(() => (
        drawer?.shadowRoot?.querySelector('[part~="dialog"]') ?? null
    ))
    const [highlighted, setHighlighted] = useState(false)
    const [dragging, setDragging] = useState(false)

    const bounds = getDrawerResizeBounds(undefined, resizeMax)

    /**
     * Applies a clamped width to the drawer and updates the accessible value.
     *
     * @param {number} nextWidth - Requested drawer width in pixels.
     * @returns {void}
     */
    const updateWidth = useCallback(nextWidth => {
        const next = clampDrawerWidth(nextWidth, getDrawerResizeBounds(undefined, resizeMax))
        drawer?.style?.setProperty('--size', `${next}px`)
        setWidth(next)
    }, [drawer, resizeMax])

    /**
     * Starts a pointer resize gesture.
     *
     * @param {PointerEvent} event - Pointer interaction event.
     * @returns {void}
     */
    const handlePointerDown = event => {
        if (event.button !== 0 || mobile || !isResizableDrawerPlacement(placement)) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        window.clearTimeout(_highlightTimeout.current)
        setHighlighted(true)
        _gesture.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: width,
        }
        setDragging(true)
        _handle.current?.setPointerCapture?.(event.pointerId)
    }

    /**
     * Updates the drawer width during a pointer resize gesture.
     *
     * @param {PointerEvent} event - Pointer interaction event.
     * @returns {void}
     */
    const handlePointerMove = event => {
        const gesture = _gesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        updateWidth(gesture.startWidth + getDrawerResizeDelta(placement, gesture.startX, event.clientX))
    }

    /**
     * Ends a pointer resize gesture.
     *
     * @param {PointerEvent} event - Pointer interaction event.
     * @returns {void}
     */
    const handlePointerEnd = event => {
        const gesture = _gesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        _gesture.current = null
        setDragging(false)
        _handle.current?.releasePointerCapture?.(event.pointerId)
    }

    /**
     * Toggles the drawer between its minimum and maximum widths on double-click.
     *
     * @param {MouseEvent} event - Double-click interaction event.
     * @returns {void}
     */
    const handleDoubleClick = event => {
        event.preventDefault()
        event.stopPropagation()
        updateWidth(width > bounds.min ? bounds.min : bounds.max)
    }

    /**
     * Adjusts the drawer width from keyboard input.
     *
     * @param {KeyboardEvent} event - Keyboard interaction event.
     * @returns {void}
     */
    const handleKeyDown = event => {
        const step = event.shiftKey ? DRAWER_RESIZE_KEYBOARD_LARGE_STEP : DRAWER_RESIZE_KEYBOARD_STEP
        let nextWidth = width

        if (event.key === 'ArrowRight') {
            nextWidth += step
        }
        else if (event.key === 'ArrowLeft') {
            nextWidth -= step
        }
        else if (event.key === 'Home') {
            nextWidth = bounds.min
        }
        else if (event.key === 'End') {
            nextWidth = bounds.max
        }
        else {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        updateWidth(nextWidth)
    }

    /**
     * Shows the visual grab cue briefly after the pointer reaches the handle.
     *
     * @returns {void}
     */
    const showHighlight = () => {
        window.clearTimeout(_highlightTimeout.current)
        setHighlighted(true)
        _highlightTimeout.current = window.setTimeout(() => {
            setHighlighted(false)
            _highlightTimeout.current = null
        }, 2000)
    }

    /**
     * Hides the visual grab cue when the pointer leaves the handle.
     *
     * @returns {void}
     */
    const hideHighlight = () => {
        window.clearTimeout(_highlightTimeout.current)
        _highlightTimeout.current = null
        if (!dragging) {
            setHighlighted(false)
        }
    }

    useLayoutEffect(() => {
        if (mobile) {
            drawer?.style?.removeProperty('--size')
        }
        else {
            drawer?.style?.setProperty('--size', `${width}px`)
        }
    }, [drawer, mobile, width])

    useEffect(() => {
        const updatePortalTarget = () => {
            setPortalTarget(drawer?.shadowRoot?.querySelector('[part~="dialog"]') ?? null)
        }
        const frame = requestAnimationFrame(updatePortalTarget)
        const observer = drawer?.shadowRoot && typeof MutationObserver !== 'undefined'
            ? new MutationObserver(updatePortalTarget)
            : null

        observer?.observe(drawer.shadowRoot, {childList: true, subtree: true})

        return () => {
            cancelAnimationFrame(frame)
            observer?.disconnect()
        }
    }, [drawer])

    useEffect(() => {
        const updateMobileState = () => setMobile(isMobileLayout())
        const observer = typeof MutationObserver !== 'undefined' && document.body
            ? new MutationObserver(updateMobileState)
            : null

        window.addEventListener('resize', updateMobileState)
        observer?.observe(document.body, {attributes: true, attributeFilter: ['class']})

        return () => {
            window.removeEventListener('resize', updateMobileState)
            observer?.disconnect()
            window.clearTimeout(_highlightTimeout.current)
        }
    }, [drawer])

    if (mobile || !isResizableDrawerPlacement(placement) || !portalTarget) {
        return null
    }

    const handle = (
        <div
            ref={_handle}
            className="drawer-resize-handle"
            data-placement={placement}
            role="separator"
            aria-label={`Resize ${drawerId ?? 'drawer'}`}
            aria-orientation="vertical"
            aria-valuemin={bounds.min}
            aria-valuemax={bounds.max}
            aria-valuenow={width}
            aria-valuetext={`${width} pixels`}
            tabIndex={0}
            style={{
                position: 'absolute',
                zIndex: 1,
                top: 0,
                left: placement === START ? undefined : 0,
                right: placement === START ? 0 : undefined,
                width: `${DRAWER_RESIZE_HANDLE_WIDTH}px`,
                height: '100%',
                pointerEvents: 'auto',
                cursor: 'col-resize',
                touchAction: 'none',
                backgroundColor: 'var(--wa-color-brand)',
                opacity: dragging ? 0.8 : highlighted ? 0.55 : 0,
                transition: 'opacity 120ms ease-out',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            onPointerEnter={showHighlight}
            onPointerLeave={hideHighlight}
            onFocus={() => setHighlighted(true)}
            onBlur={() => setHighlighted(false)}
        />
    )

    return createPortal(handle, portalTarget)
}
