/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-04
 * Last modified: 2025-10-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DraggableUIWidget } from '@Components/MainUI/DraggableUIWidget'
import React, { memo, useMemo } from 'react'
import { CropZone }             from './CropZone'

/**
 * CropZoneWidget component for rendering a draggable and resizable crop zone.
 * @param {Object} props - Component properties
 * @param {string} [props.className=''] - Additional CSS class names
 * @param {Function} [props.onDoubleClick] - Handler for double click events
 * @param {React.ReactNode} [props.infoComponent=null] - Custom info component
 * @param {boolean} [props.infoPosition=true] - Show default info position
 * @param {boolean} [props.overlay] - Enable/disable overlay
 * @returns {JSX.Element} The rendered crop zone widget
 */
export const CropZoneWidget = memo(function CropZoneWidget({
                                                               className = '',
                                                               onDoubleClick,
                                                               infoComponent = null,
                                                               infoPosition = true,
                                                               overlay,
                                                           }) {
    // Memoized configuration for DraggableUIWidget
    const config = useMemo(() => ({
        left:             '20%',
        top:              '30%',
        attachTo:         'top-left',
        isCropper:        true,
        resizable:        true,
        draggable:        true,
        outsideOverlay:   overlay ?? false,
        containerPadding: (lgs?.gutter?.xs ?? 8),
    }), [overlay])

    return (
        <DraggableUIWidget isVisible={true} config={config} className={className}>
            <CropZone onDoubleClick={onDoubleClick}
                      infoComponent={infoComponent}
                      infoPosition={infoPosition}
                      overlay={overlay}/>
        </DraggableUIWidget>
    )
})