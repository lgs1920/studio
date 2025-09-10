/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualitySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-10
 * Last modified: 2025-09-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoQualitySelector allows users to select a video quality
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.manager - CropperManager instance for crop opeQualityns
 * @param {Object} props.manager.store - Valtio store with crop state (qualityEditor, etc.)
 * @returns {JSX.Element} Draggable crop Quality selector UI
 */
import { DragHandler }                                    from '@Core/ui/drag-handler/DragHandler'
import { VideoRecorder }                                  from '@Core/ui/video/recorder/VideoRecorder'
import { faGripDots }                                     from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlTooltip }                              from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                          from '@Utils/FA2SL'
import classNames                                         from 'classnames'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                    from 'valtio'
import './style.css'


/**
 * CropQualitySelector component
 */
export const VideoQualitySelector = memo(({manager}) => {
    // Access reactive cropper and toolbar states
    const $cropper = manager?.store
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})
    const [forceRender, setForceRender] = useState(0)
    // Reference to the cropper menu DOM element
    const _toolbar = useRef(null)

    // Track selected quality, defaulting to first video format
    const defaultQuality = VideoRecorder.DEFAULT_QUALITY


    // Initialize position and drag handler, handle resize
    useEffect(() => {
        if (!manager || !cropper.qualityEditor || !_toolbar.current) {
            return
        }
        const timeoutId = setTimeout(() => {
                                         // Store drag handler on the toolbar element
                                         _toolbar.current._dragHandler = new DragHandler({
                                                                                             target:    _toolbar.current,
                                                                                             container: lgs.canvas,
                                                                                             position:  {
                                                                                                 left:      (__.device.isMobile && __.device.isPortrait ? '15%' : '30%'),
                                                                                                 top:       '50%',
                                                                                                 placement: 'left',
                                                                                             },
                                                                                         })
                                         // Update opacity
                                         _toolbar.current.style.opacity = toolbars.opacity || 1
                                     },
                                     100,
        )

        return () => {
            clearTimeout(timeoutId)
            if (_toolbar.current?._dragHandler) {
                _toolbar.current._dragHandler.destroy()
            }
        }
    }, [manager, cropper.qualityEditor])

    /**
     * Handles selection of a crop quality key
     *
     * @function
     * @param {Object} key - Video format key (value, label, description, locked)
     * @param {Event} event - Click event from icon
     */
    const handleChangeQuality = useCallback((index, event) => {
        if (!_toolbar.current || !manager) {
            return
        }
        // Update store to keep qualityEditor active
        $cropper.qualityEditor = true
        $video.quality = index
    }, [manager, $cropper])

    useEffect(() => {
        $video.quality = lgs.settings.ui.video.quality
    }, [])

    // Render draggable toolbar with quality
    return (
        <>
            {cropper.qualityEditor && (
                <div className="lgs-toolbar-container" ref={_toolbar}>
                    <div className="video-quality-selector lgs-toolbar lgs-card on-map">
                        {/* Drag handle for moving the toolbar */}
                        <SlTooltip content="Drag me">
                            <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
                        </SlTooltip>
                        <div className="buttons-bar-on-map">
                            {VideoRecorder.QUALITY.map(({value, name, short}, index) => (
                                <SlTooltip
                                    key={index}
                                    content={name}
                                    placement="left"
                                >
                                    <div
                                        className={classNames('lgs-one-line-card on-map', {'selected': index === video.quality})}
                                        onClick={event => handleChangeQuality(index, event)}>
                                        {short}
                                    </div>
                                </SlTooltip>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
})