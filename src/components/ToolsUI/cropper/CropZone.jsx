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

/**
 * CropZone.jsx
 * A React component for an interactive crop area with resizable handles
 * Renders a draggable and resizable crop zone with position info and handles
 * @module CropZone
 * @requires react
 * @requires @shoelace-style/shoelace
 * @requires @fortawesome/react-fontawesome
 * @requires @fortawesome/pro-regular-svg-icons
 * @requires ./CropperManager
 */

import { DraggableUIWidget }                  from '@Components/MainUI/DraggableUIWidget'
import { CropZoneInfo }                       from '@Components/ToolsUI/cropper/CropZoneInfo'
import { memo, useCallback, useMemo, useRef } from 'react'

/**
 * A memoized React component that renders an interactive crop zone with handles
 * @param {Object} props - Component props
 * @param {Object} props.cssCrop - Crop dimensions and position in CSS units { x, y, width, height }
 * @param {Object} props.manager - CropperHandler instance for handling interactions
 * @param {Object} props.cropper - Cropper state from store
 * @param {Object} props.interactionState - Current interaction state
 * @param {string} [props.className=''] - Additional CSS classes for the crop zone
 * @param {Function} props.onStart - Handler for drag/resize start events
 * @param {Function} props.onMove - Handler for drag/resize move events
 * @param {Function} props.onEnd - Handler for drag/resize end events
 * @param {Function} props.onDoubleClick - Handler for double-click events
 * @param {Object} [props.innerRef] - Ref for the crop zone element
 * @param {JSX.Element} [props.infoComponent=null] - Custom component for additional crop info
 * @param {boolean} [props.infoPosition=true] - Whether to show position info
 * @returns {JSX.Element} The interactive crop zone with handles
 */
export const CropZone = memo(({
                                  className = '',
                                  onDoubleClick,
                                  infoComponent = null,
                                  infoPosition = true,
                                  overlay,
                              }) => {
    // Ref to track the crop zone element if innerRef is not provided
    const _cropZone = useRef(null)


    /**
     * Prevents default context menu behavior
     * @param {Event} event - The context menu event
     * @private
     */
    const handleContextMenu = useCallback(event => {
        event.preventDefault()
        event.stopPropagation()
    }, [])

    const config = useMemo(() => {
        return {
            left:             '20%',
            top:              '30%',
            attachTo:         'top-left',
            isCropper:        true,
            resizable:        true,
            draggable:        true,
            outsideOverlay:   overlay ?? false,
            containerPadding: lgs.gutter.xs,
        }
    }, [overlay])

    return (
        <DraggableUIWidget isVisible={true} config={config} className={className}>
            <div
                ref={_cropZone}
                className={`crop-zone`}
                onDoubleClick={onDoubleClick}
                onContextMenu={handleContextMenu}
            >
                {/* Position information display */}
                {infoPosition && (
                    <div className="crop-info lgs-one-line-card on-map small">
                        <CropZoneInfo info={{left: 0, top: 0, width: 0, height: 0}}/>
                    </div>
                )}

                {/* Custom info component */}
                {infoComponent && (
                    <div className="crop-info-custom lgs-one-line-card on-map small">
                        {infoComponent}
                    </div>
                )}
            </div>
        </DraggableUIWidget>
    )
})