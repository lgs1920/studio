/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-13
 * Last modified: 2025-10-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Widget }                       from '@Components/MainUI/Widget'
import { CROP_TOOLS_WIDGET_GROUP }      from '@Core/constants'
import React, { memo, useMemo, useRef } from 'react'
import { useSnapshot }                  from 'valtio'
import { CropZone }                     from './CropZone'

/**
 * CropZoneWidget component to display a crop zone in the widget editor
 * @param {Object} props - Component props
 * @param {string} [props.className=''] - Additional CSS class for the widget
 * @param {Function} [props.onDoubleClick] - Handler for double-click events
 * @param {React.ReactNode} [props.infoComponent=null] - Component to display additional information
 * @param {boolean} [props.infoPosition=true] - Whether to show the info component at the default position
 * @param {boolean} [props.overlay=false] - Whether to display an overlay outside the crop zone
 * @param {Object} props.context - Valtio proxy context containing crop zone configuration
 * @param {string} props.context.id - Unique identifier for the widget
 * @param {boolean} [props.context.forceEven=false] - Whether to force even dimensions for the crop zone
 * @returns {JSX.Element} The crop zone widget
 */
export const CropZoneWidget = memo(({
                                        className = '',
                                        onDoubleClick,
                                        infoComponent = null,
                                        infoPosition = true,
                                        overlay = false,
                                        context,
                                    }) => {
    // Reference to the CropZone DOM element
    const _cropZone = useRef(null)

    // Snapshot of the Valtio context
    const $context = useSnapshot(context)

    // Memoized configuration for the Widget component
    const config = useMemo(() => ({
        left:             '20%',
        top:              '30%',
        attachTo:         'center',
        isCropper:        true,
        resizable:        true,
        draggable:        true,
        outsideOverlay:   overlay,
        margin: lgs?.gutter?.xs ?? 8,
        resizeFromCenter: true,
        id:               $context.id,
        forceEven:        $context.forceEven ?? false,
        persistInTable: true,
        group:            CROP_TOOLS_WIDGET_GROUP,
    }), [$context.id, $context.forceEven, overlay])

    // Render the widget with the CropZone component
    return (
        <Widget isVisible={true} config={config} className={className}>
            <CropZone
                onDoubleClick={onDoubleClick}
                infoComponent={infoComponent}
                infoPosition={infoPosition}
                overlay={overlay}
                ref={_cropZone}
                context={context}
            />
        </Widget>
    )
})