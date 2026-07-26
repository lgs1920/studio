/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
 * @returns {JSX.Element|null} Cropper UI or null if source is not loaded
 */
import { DefinedCropZone }                                                                  from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import { JOURNEY_WIDGETS, MULTI_PURPOSE_WIDGETS } from '@Core/constants'
import { memo, useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { CropZoneWidget }        from './widgets/CropZoneWidget'
import { CropZoneInfoPopup }     from './widgets/CropZoneInfoPopup'
import './style.css'

export const Cropper = memo(({overlay = false, className = '', context, options = {}, children}) => {

    const _cropperContainer = useRef(null)
    const _overlay = useRef(null)
    const cropper = useSnapshot(context)
    const video = useSnapshot(lgs.stores.ui.video)
    const [overlayElement, setOverlayElement] = useState(null)
    const hideWidgetPanel = Boolean(video.preRecording || video.recording || video.snapshot || video.finalizing)

    useEffect(() => {
        if (_overlay.current) {
            setOverlayElement(_overlay.current)
        }
    }, [overlay])

    return (
        <>
            {overlayElement && cropper.ratioEditor &&
                <CropRatioEditorWidget context={context} id="crop-ratio-editor"/>
            }

            <div ref={_cropperContainer} className="crop-container lgs-on-map-theme-vars">
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
                {overlay && <div className="crop-overlay wa-theme-lgs1920-on-map" ref={_overlay}/>}
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
