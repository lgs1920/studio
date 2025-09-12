/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZone.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-12
 * Last modified: 2025-09-12
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

import { memo, useRef }    from 'react'
import { SlCard }          from '@shoelace-style/shoelace/dist/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInfoCircle }    from '@fortawesome/pro-regular-svg-icons'
import { CropperManager }  from './CropperManager'

/**
 * A memoized React component that renders an interactive crop zone with handles
 * @param {Object} props - Component props
 * @param {Object} props.cssCrop - Crop dimensions and position in CSS units { x, y, width, height }
 * @param {Object} props.manager - CropperManager instance for handling interactions
 * @param {Object} props.cropper - Cropper state from store
 * @param {Object} props.interactionState - Current interaction state
 * @param {string} [props.className=''] - Additional CSS classes for the crop zone
 * @param {Function} props.onStart - Handler for drag/resize start events
 * @param {Function} props.onDoubleClick - Handler for double-click events
 * @param {Object} [props.innerRef] - Ref for the crop zone element
 * @param {JSX.Element} [props.infoComponent=null] - Custom component for additional crop info
 * @param {boolean} [props.infoPosition=true] - Whether to show position info
 * @returns {JSX.Element} The interactive crop zone with handles
 */
export const CropZone = memo(({
                                  cssCrop,
                                  manager,
                                  cropper,
                                  interactionState,
                                  className = '',
                                  onStart,
                                  onDoubleClick,
                                  innerRef,
                                  infoComponent = null,
                                  infoPosition = true,
                              }) => {
    // Ref to track the crop zone element if innerRef is not provided
    const _cropZone = useRef(null)

    /**
     * Prevents default context menu behavior
     * @param {Event} event - The context menu event
     * @private
     */
    const #handleContextMenu = (event) => {
        event.preventDefault()
        event.stopPropagation()
    }

    /**
     * Initiates resizing on pointer down
     * @param {string} direction - The handle direction (e.g., 'top-left')
     * @returns {Function} Event handler for pointer down
     * @private
     */
    const #handlePointerDown = (direction) => (event) => {
        event.stopPropagation()
        onStart(`resize-${direction}`, event)
    }

    /**
     * Initiates resizing on touch start
     * @param {string} direction - The handle direction (e.g., 'top-left')
     * @returns {Function} Event handler for touch start
     * @private
     */
    const #handleTouchStart = (direction) => (event) => {
        event.stopPropagation()
        onStart(`resize-${direction}`, event)
    }

    /**
     * Handles end of pointer or touch interactions
     * @param {Event} event - The pointer or touch event
     * @private
     */
    const #handleEnd = (event) => {
        event.stopPropagation()
        manager.handleEnd(event)
    }

    return (
        <div
            ref={innerRef || _cropZone}
            className={`crop-zone ${className}`}
            onDoubleClick={onDoubleClick}
            onContextMenu={#handleContextMenu}
        >
            {/* Position information display */}
            {infoPosition && (
                <SlCard className="crop-info lgs-one-line-card on-map small">
                    <FontAwesomeIcon icon={faInfoCircle} style={{marginRight: '4px'}}/>
                    {Math.round(cssCrop.x)}×{Math.round(cssCrop.y)} | {Math.round(cssCrop.width)}×{Math.round(cssCrop.height)}
                </SlCard>
            )}

            {/* Custom info component */}
            {infoComponent && (
                <SlCard className="cromp-info-custom lgs-one-line-card on-map small">
                    {infoComponent}
                </SlCard>
            )}

            {/* Horizontal center line */}
            {interactionState.showHCenterLine && <div className="center-line-inner-horizontal" />}

            {/* Vertical center line */}
            {interactionState.showVCenterLine && <div className="center-line-inner-vertical" />}

            {/* Resizable handles */}
            {cropper.resizable &&
                CropperManager.handleMap.map(([dir, cursor]) => (
                    <div
                        key={dir}
                        className={`crop-handle handle-${dir}`}
                        style={{ cursor }}
                        onPointerDown={#handlePointerDown(dir)}
                        onTouchStart={#handleTouchStart(dir)}
                        onPointerUp={#handleEnd}
                        onTouchEnd={#handleEnd}
                        onPointerCancel={#handleEnd}
                        onTouchCancel={#handleEnd}
                    />
                ))}
        </div>
    )
})