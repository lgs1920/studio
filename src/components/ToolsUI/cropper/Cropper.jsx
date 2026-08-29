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
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { buildCropOverlayBlockers } from './cropOverlayBlockers'
import { CropZoneWidget }        from './widgets/CropZoneWidget'
import { CropZoneInfoPopup }     from './widgets/CropZoneInfoPopup'
import './style.css'

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
    const [selectionRequestKey, setSelectionRequestKey] = useState(0)
    const hideWidgetPanel = Boolean(video.preRecording || video.recording || video.snapshot || video.finalizing)

    /**
     * Activates crop editing when the user double-clicks inside the visible crop zone.
     * @param {MouseEvent} event - Double-click event from the map or document
     */
    const handleCropDoubleClick = useCallback((event) => {
        if (hideWidgetPanel || typeof document === 'undefined') {
            return
        }

        const eventPath = event.composedPath?.() ?? [event.target]
        const isOverlayControl = eventPath.some(element => element?.closest?.('wa-drawer, .sl-backdrop'))
        if (isOverlayControl) {
            return
        }

        const cropElement = _cropperContainer.current?.querySelector('.crop-zone')
        const rect = cropElement?.getBoundingClientRect?.()
        const clientX = Number(event.clientX)
        const clientY = Number(event.clientY)
        const isInsideCrop = Boolean(rect && rect.width > 0 && rect.height > 0
            && Number.isFinite(clientX) && Number.isFinite(clientY)
            && clientX >= rect.left && clientX <= rect.right
            && clientY >= rect.top && clientY <= rect.bottom)
        if (!isInsideCrop) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        Object.assign(context, {
            presetEditor: true,
            ratioEditor:  true,
            widgetEditor: true,
        })
        setSelectionRequestKey(current => current + 1)
    }, [context, hideWidgetPanel])

    useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined
        }

        const canvas = globalThis.lgs?.canvas
        const targets = [canvas, document].filter((target, index, items) => target?.addEventListener && items.indexOf(target) === index)
        targets.forEach(target => target.addEventListener('dblclick', handleCropDoubleClick, true))
        return () => targets.forEach(target => target.removeEventListener('dblclick', handleCropDoubleClick, true))
    }, [handleCropDoubleClick])

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
                            selectionRequestKey={selectionRequestKey}
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
                    />
                )}
                {overlay && cropOverlayBlockers.length > 0 && (
                    <div className="crop-overlay-blockers" aria-hidden="true">
                        {cropOverlayBlockers.map(blocker => (
                            <div key={blocker.className} className={blocker.className} style={blocker.style}/>
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
