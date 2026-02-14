/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Cropper.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-14
 * Last modified: 2026-02-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
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
import { JOURNEY_WIDGETS, MULTI_PURPOSE_WIDGETS, SCENE_WIDGETS_BOARD, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import React, { memo, useEffect, useMemo, useRef, useState }                                from 'react'
import { useSnapshot }                                                                      from 'valtio'
import { CropZoneWidget }        from './widgets/CropZoneWidget'
import './style.css'

export const Cropper = memo(({overlay = false, className = '', context, options = {}, children}) => {

    const _cropperContainer = useRef(null)
    const _overlay = useRef(null)
    const cropper = useSnapshot(context)
    const $widget = lgs.stores.ui.widget
    const {list} = useSnapshot($widget)
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
                            context={context}
                        />
                    </>
                ) : overlayElement ? (
                    <DefinedCropZone
                        className={className}
                        infoPosition={options.infoPosition}
                        infoComponent={options.infoComponent}
                        overlay={overlayElement}
                        context={context}>
                    </DefinedCropZone>
                ) : null}
                {overlay && <div className="crop-overlay" ref={_overlay}/>}
                {children}
                <WidgetsPanel id="widget-deck" context={context} groups={[MULTI_PURPOSE_WIDGETS, JOURNEY_WIDGETS]}/>

                {
                    Array.from(list.entries())
                        .filter(([key, props]) => props?.widgetsBoard === VIDEO_WIDGETS_BOARD)
                        .map(([key, props]) => (
                            <DynamicWidget key={key} id={key} props={props} context={context}/>
                        ))
                }
            </div>
        </>
    )
})
