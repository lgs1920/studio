/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DockedWidgetResizeHandle.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    DOCKED_WIDGET_MIN_SIZE,
    getDockedWidgetMaxSize,
    normalizeDockSize,
} from '@Core/ui/widget-manager/WidgetDockManager'
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'

/**
 * Render and manage the resize handle attached to the top edge of the dock drawer.
 *
 * @param {Object} props - Resize handle properties.
 * @param {HTMLElement|null} props.drawer - Drawer element whose size is controlled.
 * @param {number} props.size - Current drawer height in pixels.
 * @param {(size: number) => void} props.onSizeChange - Callback receiving the clamped height.
 * @returns {JSX.Element|null} Portaled resize handle or null before the drawer dialog exists.
 */
export const DockedWidgetResizeHandle = ({drawer, size, onSizeChange}) => {
    const handleRef = useRef(null)
    const gestureRef = useRef(null)
    const [portalTarget, setPortalTarget] = useState(null)
    const [dragging, setDragging] = useState(false)
    const [, setViewportHeight] = useState(() => typeof window === 'undefined' ? 0 : window.innerHeight)
    const maximumSize = getDockedWidgetMaxSize()

    useEffect(() => {
        /**
         * Re-render the handle when the viewport changes so its maximum stays current.
         *
         * @returns {void}
         */
        const handleViewportResize = () => {
            setViewportHeight(window.innerHeight)
        }

        window.addEventListener('resize', handleViewportResize)
        return () => window.removeEventListener('resize', handleViewportResize)
    }, [])

    useEffect(() => {
        const boundedSize = normalizeDockSize(size, size, maximumSize)
        if (boundedSize !== size) {
            onSizeChange(boundedSize)
        }
    }, [maximumSize, onSizeChange, size])

    useLayoutEffect(() => {
        drawer?.style?.setProperty('--size', `${size}px`)
    }, [drawer, size])

    useEffect(() => {
        /**
         * Find the Web Awesome dialog that receives the resize handle.
         *
         * @returns {void}
         */
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

    /**
     * Clamp and publish a requested drawer height.
     *
     * @param {number} value - Requested drawer height in pixels.
     * @returns {void}
     */
    const updateSize = useCallback(value => {
        onSizeChange(normalizeDockSize(value, size, maximumSize))
    }, [maximumSize, onSizeChange, size])

    /**
     * Start a pointer resize gesture.
     *
     * @param {PointerEvent} event - Pointer press event.
     * @returns {void}
     */
    const handlePointerDown = event => {
        if (event.button !== 0) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        gestureRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startSize: size,
        }
        setDragging(true)
        handleRef.current?.setPointerCapture?.(event.pointerId)
    }

    /**
     * Update the drawer height during a pointer resize gesture.
     *
     * @param {PointerEvent} event - Pointer movement event.
     * @returns {void}
     */
    const handlePointerMove = event => {
        const gesture = gestureRef.current
        if (!gesture || gesture.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        updateSize(gesture.startSize - (event.clientY - gesture.startY))
    }

    /**
     * Finish or cancel a pointer resize gesture.
     *
     * @param {PointerEvent} event - Pointer release or cancellation event.
     * @returns {void}
     */
    const handlePointerEnd = event => {
        if (!gestureRef.current || gestureRef.current.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        gestureRef.current = null
        setDragging(false)
        handleRef.current?.releasePointerCapture?.(event.pointerId)
    }

    /**
     * Resize the drawer with keyboard commands.
     *
     * @param {KeyboardEvent} event - Keyboard interaction event.
     * @returns {void}
     */
    const handleKeyDown = event => {
        const step = event.shiftKey ? 80 : 20
        let nextSize = size
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
            nextSize += step
        }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
            nextSize -= step
        }
        else if (event.key === 'Home') {
            nextSize = DOCKED_WIDGET_MIN_SIZE
        }
        else if (event.key === 'End') {
            nextSize = maximumSize
        }
        else {
            return
        }

        event.preventDefault()
        updateSize(nextSize)
    }

    if (!portalTarget) {
        return null
    }

    return createPortal(
        <div
            ref={handleRef}
            className={`widget-dock-resize-handle${dragging ? ' is-dragging' : ''}`}
            role="separator"
            aria-label="Resize docked widget panel"
            aria-orientation="horizontal"
            aria-valuemin={DOCKED_WIDGET_MIN_SIZE}
            aria-valuemax={maximumSize}
            aria-valuenow={size}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            style={{
                position:       'absolute',
                zIndex:          2,
                right:          0,
                top:            0,
                left:           0,
                height:         '6px',
                cursor:         'row-resize',
                touchAction:    'none',
                background:     dragging ? 'var(--wa-color-brand-60)' : 'transparent',
            }}
        />,
        portalTarget,
    )
}
