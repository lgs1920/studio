/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-06
 * Last modified: 2025-10-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VIDEO_CROP_ZONE } from '@Core/constants'
import React, { forwardRef, useEffect, useRef, useCallback, useState } from 'react'
import { CropZoneInfo }                                                from './CropZoneInfo'

const toClipPath = ({left, top, width, height}) => {
    const x1 = Math.floor(left)
    const y1 = Math.floor(top)
    const x2 = Math.floor(left + width)
    const y2 = Math.floor(top + height)
    return `polygon(
    0% 0%, 100% 0%, 100% 100%, 0% 100%,
    0% ${y1}px,
    ${x1}px ${y1}px,
    ${x1}px ${y2}px,
    ${x2}px ${y2}px,
    ${x2}px ${y1}px,
    0% ${y1}px
  )`
}

/**
 * CropZone component for rendering the crop zone content with imperative API.
 */
export const CropZone = forwardRef(function CropZone(props, ref) {
    const {onDoubleClick, infoComponent, infoPosition, overlay} = props
    const _root = useRef(null)
    const [info, setInfo] = useState(null)

    const handleContextMenu = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    // Expose imperative API through ref for DraggableUIWidget
    useEffect(() => {
        if (!ref) {
            return
        }

        const setPosition = event => {
            const position = {left: event.left, top: event.top, width: event.width, height: event.height}
            // Live sync overlay during drag/resize for smoothness
            if (overlay) {
                overlay.style.clipPath = toClipPath(position)
            }
            setInfo({...position})
        }

        const api = {
            handleDrag:      (event) => {
                setPosition(event)
            },
            handleResize:    (event) => {
                setPosition(event)
            },
            handleDragStart: () => {
            },
            handleDragEnd:   () => {
            },
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
    }, [ref, overlay])

    return (
        <div
            ref={_root}
            className="crop-zone"
            onDoubleClick={onDoubleClick}
            onContextMenu={handleContextMenu}
        >
            {infoPosition && (
                <div className="crop-info lgs-one-line-card on-map small">
                    <CropZoneInfo id={VIDEO_CROP_ZONE}/>
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