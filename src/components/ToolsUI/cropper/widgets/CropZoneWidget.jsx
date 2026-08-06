/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget } from '@Components/MainUI/widgets/Widget'
import { CROP_TOOLS_WIDGETS, HOUR, LGS_VISUAL_WIDGET } from '@Core/constants'
import { memo, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }           from 'valtio'
import { CropZone }              from './CropZone'

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
                                        moveableClassName = '',
                                        containerClassName = '',
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
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const lockToCenter = Boolean(video.editing && replay.recordingSync === true)

    // Memoized configuration for the Widget component
    const config = useMemo(() => {
        const savedRatio = lgs.settings.ui.video?.ratio
        const fallbackRatio = __.device.isPortrait ? '9x16' : '16x9'
        const initialRatio = lgs.configuration.videoFormats.find(preset => preset.value === savedRatio)?.value
            ?? lgs.configuration.videoFormats.find(preset => preset.value === fallbackRatio)?.value
            ?? lgs.configuration.videoFormats[0]?.value
            ?? '1x1'

        return {
            left:             '20%',
            top:              '30%',
            attachTo:         'center',
            type:             LGS_VISUAL_WIDGET,
            isCropper:        true,
            resizable:        true,
            draggable:        !lockToCenter,
            snappable:        true,
            outsideOverlay:   overlay,
            margin:           lgs?.gutter?.xs ?? 8,
            resizeFromCenter: true,
            throttleResize: 1,
            id:               $context.id,
            forceEven:        $context.forceEven ?? false,
            persist:          true,
            transient:        true,
            ttl:              HOUR,
            group:            CROP_TOOLS_WIDGETS,
            ratio:            initialRatio,
        }
    }, [$context.id, $context.forceEven, lockToCenter, overlay])

    useEffect(() => {
        if (!lockToCenter || typeof document === 'undefined') {
            return
        }

        const centerCropZone = () => {
            const element = __.ui.widgetManager.getElementById($context.id)
            if (!element) {
                return false
            }
            __.ui.widgetManager.toCenter(element, 0)
            return true
        }

        if (centerCropZone()) {
            return
        }

        const raf = requestAnimationFrame(centerCropZone)
        return () => cancelAnimationFrame(raf)
    }, [$context.id, lockToCenter])

    useEffect(() => {
        // In composition mode this is the only crop representation mounted.
        // Keep the shared context anchored to the interactive crop board so
        // widgets and board-specific controls use the same reference.
        context.widgetsBoard = $context.id
    }, [context, $context.id])

    // Render the widget with the CropZone component
    return (
        <Widget
            isVisible={true}
            config={config}
            className={className}
            moveableClassName={moveableClassName}
            containerClassName={containerClassName}
        >
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
