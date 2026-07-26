/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneInfoPopup.jsx
 *
 ******************************************************************************/

import { useEffect, useId, useRef, useState } from 'react'
import { CropZoneInfo } from './CropZoneInfo'

/**
 * Draggable crop information widget displayed in the lower-right corner of the scene.
 */
export const CropZoneInfoPopup = ({id, infoComponent, showDimensions = true}) => {
    const generatedId = useId().replace(/:/g, '')
    const anchorId = `crop-zone-info-trigger-${generatedId}`
    const controlRef = useRef(null)
    const dragRef = useRef({moved: false, offsetX: 0, offsetY: 0})
    const [active, setActive] = useState(false)
    const [dragging, setDragging] = useState(false)

    useEffect(() => {
        if (!active) {
            return undefined
        }

        const closeOnOutsidePointerDown = (event) => {
            if (!controlRef.current?.contains(event.target)) {
                setActive(false)
            }
        }
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') {
                setActive(false)
            }
        }

        document.addEventListener('pointerdown', closeOnOutsidePointerDown)
        window.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointerDown)
            window.removeEventListener('keydown', closeOnEscape)
        }
    }, [active])

    const handlePointerDown = (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
            return
        }

        // The button keeps its click semantics; the surrounding widget remains draggable.
        if (event.target.closest?.('wa-button')) {
            return
        }

        const element = controlRef.current
        if (!element) {
            return
        }

        const rect = element.getBoundingClientRect()
        dragRef.current = {
            moved:   false,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
        }
        element.style.left = `${rect.left}px`
        element.style.top = `${rect.top}px`
        element.style.right = 'auto'
        element.style.bottom = 'auto'
        element.setPointerCapture?.(event.pointerId)
        setDragging(true)
    }

    const handlePointerMove = (event) => {
        if (!dragging || !controlRef.current) {
            return
        }

        const drag = dragRef.current
        const element = controlRef.current
        const rect = element.getBoundingClientRect()
        const left = Math.min(Math.max(0, event.clientX - drag.offsetX), window.innerWidth - rect.width)
        const top = Math.min(Math.max(0, event.clientY - drag.offsetY), window.innerHeight - rect.height)
        if (Math.abs(event.clientX - (rect.left + drag.offsetX)) > 2 || Math.abs(event.clientY - (rect.top + drag.offsetY)) > 2) {
            drag.moved = true
        }
        element.style.left = `${left}px`
        element.style.top = `${top}px`
        event.preventDefault()
    }

    const handlePointerUp = (event) => {
        if (!dragging) {
            return
        }
        controlRef.current?.releasePointerCapture?.(event.pointerId)
        setDragging(false)
    }

    return (
        <div
            ref={controlRef}
            className={`crop-info-popup-widget-shell wa-theme-lgs1920-on-map${dragging ? ' dragging' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
            }}
        >
            <div className="crop-info-popup-control">
                <wa-button
                    id={anchorId}
                    appearance="outlined"
                    type="button"
                    aria-label="Afficher les informations de la zone de recadrage"
                    aria-expanded={active}
                    onClick={() => {
                        if (dragRef.current.moved) {
                            dragRef.current.moved = false
                            return
                        }
                        setActive(value => !value)
                    }}
                >
                    <wa-icon name="circle-info" variant="regular" label="Afficher les informations de la zone de recadrage"/>
                </wa-button>
                {active && (
                    <div className="crop-info-popup-card lgs-card wa-theme-lgs1920-on-map small" role="dialog" aria-label="Informations de la zone de recadrage">
                        {showDimensions && (
                            <div className="crop-info-popup-dimensions">
                                <CropZoneInfo id={id}/>
                            </div>
                        )}
                        {infoComponent && (
                            <div className="crop-info-popup-custom">
                                {infoComponent}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
