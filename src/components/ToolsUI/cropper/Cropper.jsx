/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-02-17
 * Last modified: 2026-02-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoSceneWidgetsPortal } from '@Components/MainUI/video/VideoSceneWidgetsPortal'
import { WidgetsPanel } from '@Components/MainUI/widgets/WidgetsPanel'
import { CropRatioEditorWidget } from '@Components/ToolsUI/cropper/widgets/CropRatioEditorWidget'
/**
 * Cropper component for interactive crop region selection over canvas, video, or image elements.
 * Provides a draggable and resizable crop area with visual feedback and center alignment guides.
 * @component
 * @param {Object} props - Component properties
 * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} props.source - Element to crop
 * @param {HTMLElement} [props.container] - Container for bounds (defaults to source)
 * @param {string} [props.className=''] - Additional CSS classes for crop zone
 * @param {Object} props.store - Valtio store for cropper state
 * @param {Object} [props.options={}] - Configuration options for CropperHandler
 * @param {JSX.Element|string} [props.children] - Additional UI elements (e.g., CTA buttons)
 * @param {boolean} [props.renderRatioWidget=true] - Whether to render the standalone ratio widget.
 * @returns {JSX.Element|null} Cropper UI or null if source is not loaded
 */
import { DefinedCropZone }                                                                  from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import { JOURNEY_WIDGETS, MULTI_PURPOSE_WIDGETS } from '@Core/constants'
import { memo, useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { CropZoneWidget }        from './widgets/CropZoneWidget'
import { CropZoneInfoPopup }     from './widgets/CropZoneInfoPopup'
import './style.css'

/**
 * Builds the four blockers surrounding the crop window.
 *
 * These blockers keep Cesium input disabled outside the visible crop area
 * while leaving the crop window itself transparent to pointer events.
 *
 * @param {Object} crop - Crop dimensions.
 * @returns {Array<{className: string, style: Object}>} Blocker descriptors.
 */
const buildCropOverlayBlockers = crop => {
    const left = Number.isFinite(crop?.left) ? Math.max(0, Math.round(crop.left)) : 0
    const top = Number.isFinite(crop?.top) ? Math.max(0, Math.round(crop.top)) : 0
    const width = Number.isFinite(crop?.width) ? Math.max(0, Math.round(crop.width)) : 0
    const height = Number.isFinite(crop?.height) ? Math.max(0, Math.round(crop.height)) : 0

    if (width <= 0 || height <= 0) {
        return []
    }

    return [
        {
            className: 'crop-overlay-blocker crop-overlay-blocker-top',
            style: {
                left:   0,
                top:    0,
                right:  0,
                height: `${top}px`,
            },
        },
        {
            className: 'crop-overlay-blocker crop-overlay-blocker-left',
            style: {
                left:   0,
                top:    `${top}px`,
                width:  `${left}px`,
                height: `${height}px`,
            },
        },
        {
            className: 'crop-overlay-blocker crop-overlay-blocker-right',
            style: {
                left:   `${left + width}px`,
                top:    `${top}px`,
                right:  0,
                height: `${height}px`,
            },
        },
        {
            className: 'crop-overlay-blocker crop-overlay-blocker-bottom',
            style: {
                left:   0,
                top:    `${top + height}px`,
                right:  0,
                bottom: 0,
            },
        },
    ]
}

export const Cropper = memo(({overlay = false, className = '', context, options = {}, children, renderRatioWidget = true}) => {

    const _cropperContainer = useRef(null)
    const _overlay = useRef(null)
    const cropper = useSnapshot(context)
    const video = useSnapshot(lgs.stores.ui.video)
    const [overlayElement, setOverlayElement] = useState(null)
    const [crop, setCrop] = useState(() => {
        const config = __.ui.widgetManager.getWidgetConfig(context.id)
        return config?.cropDimensions
               ? {...config.cropDimensions}
               : {left: 0, top: 0, width: 0, height: 0}
    })
    const hideWidgetPanel = Boolean(video.preRecording || video.recording || video.snapshot || video.finalizing)

    useEffect(() => {
        if (_overlay.current) {
            setOverlayElement(_overlay.current)
        }
    }, [overlay])

    useEffect(() => {
        const syncCrop = () => {
            const config = __.ui.widgetManager.getWidgetConfig(context.id)
            const next = config?.cropDimensions
                         ? {...config.cropDimensions}
                         : {left: 0, top: 0, width: 0, height: 0}
            setCrop(current => (
                                   current.left === next.left &&
                                   current.top === next.top &&
                                   current.width === next.width &&
                                   current.height === next.height
                               ) ? current : next)
        }

        syncCrop()

        const handleCropUpdate = (event) => {
            if (!event?.detail || event.detail.id === context.id) {
                syncCrop()
            }
        }

        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [context.id])

    const cropOverlayBlockers = buildCropOverlayBlockers(crop)

    return (
        <>
            {overlayElement && cropper.ratioEditor && renderRatioWidget &&
                <CropRatioEditorWidget context={context} id="crop-ratio-editor"/>
            }

            <div
                ref={_cropperContainer}
                className="crop-container lgs-on-map-theme-vars"
                style={{
                    // Keep the cropper pass-through so Cesium only receives input inside the crop window.
                    pointerEvents: 'none',
                }}
            >
                {overlayElement && !cropper.ratioEditor && (
                    <DefinedCropZone
                        className={[className, cropper.ratioEditor ? 'defined-crop-zone-hidden' : ''].filter(Boolean).join(' ')}
                        infoPosition={options.infoPosition}
                        infoComponent={options.infoComponent}
                        overlay={overlayElement}
                        context={context}>
                    </DefinedCropZone>
                )}
                {overlayElement && cropper.ratioEditor && (
                        <CropZoneWidget
                            className={className}
                            containerClassName="crop-moveable-container-on-map"
                            moveableClassName="lgs-on-map-theme-vars crop-moveable-on-map"
                            infoPosition={options.infoPosition}
                            infoComponent={options.infoComponent}
                            overlay={overlayElement}
                            context={context}
                        />
                )}
                {overlay && (
                    <div
                        className="crop-overlay wa-theme-lgs1920-on-map"
                        ref={_overlay}
                        style={{
                            // The overlay remains visual only. Transparent blockers handle hit-testing outside the crop.
                            pointerEvents: 'none',
                        }}
                    >
                        {cropOverlayBlockers.map(blocker => (
                            <div
                                key={blocker.className}
                                className={blocker.className}
                                style={blocker.style}
                            />
                        ))}
                    </div>
                )}
                {children}
                {!hideWidgetPanel && (
                    <WidgetsPanel id="widget-deck" context={context} groups={[MULTI_PURPOSE_WIDGETS, JOURNEY_WIDGETS]}/>
                )}
            </div>
            {(options.infoPosition || options.infoComponent) && (
                <CropZoneInfoPopup id={context.id} infoComponent={options.infoComponent} showDimensions={options.infoPosition}/>
            )}
            {/* Crop and video widgets remain mounted together during composition. */}
            <VideoSceneWidgetsPortal context={context}/>
        </>
    )
})
