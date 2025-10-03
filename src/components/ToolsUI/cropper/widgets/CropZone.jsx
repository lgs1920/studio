/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-03
 * Last modified: 2025-10-03
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import React, { forwardRef, useEffect, useRef, useCallback } from 'react'
import { CropZoneInfo }                                      from './CropZoneInfo'

/**
 * CropZone component for rendering the crop zone content with imperative API.
 * @param {Object} props - Component properties
 * @param {Function} [props.onDoubleClick] - Handler for double click events
 * @param {React.ReactNode} [props.infoComponent] - Custom info component
 * @param {boolean} [props.infoPosition] - Show default info position
 * @param {React.Ref} ref - Forwarded ref for imperative API
 * @returns {JSX.Element} The rendered crop zone content
 */
export const CropZone = forwardRef(function CropZone(props, ref) {
    const {onDoubleClick, infoComponent, infoPosition} = props
    const _root = useRef(null)

    // Prevent default context menu behavior
    const handleContextMenu = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    // Expose imperative API through ref
    useEffect(() => {
        if (!ref) {
            return
        }
        const api = {
            handleDrag:      (event) => console.log('CropZone handleDrag', event),
            handleResize:    (event) => console.log('CropZone handleResize', event),
            handleDragStart: (event) => console.log('CropZone handleDragStart', event),
            handleDragEnd:   (event) => console.log('CropZone handleDragEnd', event),
        }
        if (typeof ref === 'function') {
            ref(api)
            return () => ref(null)
        }
        else {
            ref.current = api
            return () => {
                ref.current = null
            }
        }
    }, [ref])

    return (
        <div
            ref={_root}
            className="crop-zone"
            onDoubleClick={onDoubleClick}
            onContextMenu={handleContextMenu}
        >
            {infoPosition && (
                <div className="crop-info lgs-one-line-card on-map small">
                    <CropZoneInfo info={{left: 0, top: 0, width: 0, height: 0}}/>
                </div>
            )}
            {infoComponent && (
                <div className="crop-info-custom lgs-one-line-card on-map small">
                    {infoComponent}
                </div>
            )}
        </div>
    )
})