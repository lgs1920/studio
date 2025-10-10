/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-10
 * Last modified: 2025-10-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

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
import { DefinedCropZone }       from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import { memo, useEffect, useRef, useState } from 'react'
import { useSnapshot }                       from 'valtio'
import { CropZoneWidget }        from './widgets/CropZoneWidget'
import './style.css'

export const Cropper = memo(({overlay = false, className = '', context, options = {}, children}) => {

    const _cropperContainer = useRef(null)
    const _overlay = useRef(null)
    const cropper = useSnapshot(context)

    const [overlayElement, setOverlayElement] = useState(null)

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

            <div ref={_cropperContainer} className="crop-container">
                {overlayElement && cropper.ratioEditor ? (
                    <>
                        <CropZoneWidget
                            className={className}
                            infoPosition={options.infoPosition}
                            infoComponent={options.infoComponent}
                            overlay={overlayElement}
                            id={context.id}
                        />
                    </>
                ) : overlayElement ? (
                    <DefinedCropZone
                        className={className}
                        infoPosition={options.infoPosition}
                        infoComponent={options.infoComponent}
                        overlay={overlayElement}
                        id={context.id}
                    />
                ) : null}
                {overlay && <div className="crop-overlay" ref={_overlay}/>}
                {children}
            </div>
        </>
    )
})