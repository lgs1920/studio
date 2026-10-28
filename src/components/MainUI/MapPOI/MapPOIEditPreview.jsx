/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditPreview.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-27
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIContent } from '@Components/MainUI/MapPOI/MapPOIContent'
import { POIUtils } from '@Utils/cesium/POIUtils'
import { WaButton, WaIcon } from '@awesome.me/webawesome/dist/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'

const PREVIEW_MAX_CANVAS_WIDTH = 1024
const MIN_PREVIEW_HEIGHT = 125

/** Copy the current Cesium canvas without the edited POI into a preview image. */
const buildPOIEditPreviewBackground = poiId => {
    try {
        const source = lgs.canvas ?? lgs.viewer?.canvas
        if (!source?.width || !source?.height) {
            return null
        }

        const scene = lgs.scene ?? lgs.viewer?.scene
        const currentPOI = lgs.stores.main.components.pois.list.get(poiId)
        const entity = currentPOI?.id
            ? POIUtils.getEntityContainer(currentPOI)?.getById(currentPOI.id)
            : null
        const previousEntityShow = entity?.show
        const previousBillboardShow = entity?.billboard?.show

        try {
            if (entity) {
                entity.show = false
                if (entity.billboard) entity.billboard.show = false
            }
            scene?.render?.()

            const width = Math.min(source.width, PREVIEW_MAX_CANVAS_WIDTH)
            const height = Math.max(1, Math.round(width * source.height / source.width))
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            canvas.getContext('2d')?.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height)
            return canvas.toDataURL('image/webp', 0.8)
        }
        finally {
            if (entity) {
                entity.show = previousEntityShow
                if (entity.billboard) entity.billboard.show = previousBillboardShow
                scene?.requestRender?.()
            }
        }
    }
    catch {
        return null
    }
}

/**
 * Render the live POI over a copy of the current map canvas.
 *
 * @param {{poi: string}} props - POI identifier for the editor preview.
 * @returns {import('react').ReactNode} Open and collapsed POI previews.
 */
export const MapPOIEditPreview = ({poi}) => {
    const poiList = useSnapshot(lgs.stores.main.components.pois.list)
    const point = poiList.get(poi)
    const _openArea = useRef(null)
    const _openContent = useRef(null)
    const _preview = useRef(null)
    const _resizeGesture = useRef(null)
    const [background, setBackground] = useState(null)
    const [fitRequested, setFitRequested] = useState(false)
    const [requiresFit, setRequiresFit] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [previewScale, setPreviewScale] = useState(1)
    const [previewHeight, setPreviewHeight] = useState(null)

    /** Measure the POI overflow and keep the fit scale and resize affordance current. */
    const updatePreviewSizing = useCallback(() => {
        const area = _openArea.current
        const card = _openContent.current?.querySelector('.poi-card-inner')
        const leaderSpace = _openContent.current?.querySelector('.poi-expanded-leader-space')
        const poiWrapper = _openContent.current?.querySelector('.poi-icon-wrapper')
        const width = card?.offsetWidth
        const height = card?.offsetHeight
        const availableWidth = area?.clientWidth
        const availableHeight = area?.clientHeight
        if (!width || !height || !availableWidth || !area) {
            return
        }

        const angle = Number.parseFloat(poiWrapper?.style.getPropertyValue('--poi-expanded-leader-angle')) || 0
        const length = Number.parseFloat(poiWrapper?.style.getPropertyValue('--poi-expanded-leader-length')) || 0
        const horizontalExtension = Math.abs(Math.sin(angle * Math.PI / 180) * length)
        const contentWidth = width + Math.max(0, horizontalExtension - width / 2)
        const contentHeight = height + (leaderSpace?.offsetHeight ?? 0)
        const overflows = contentWidth > availableWidth || contentHeight > availableHeight
        setRequiresFit(previous => previous === overflows ? previous : overflows)
        const nextScale = fitRequested
            ? Math.min(1, availableWidth / contentWidth, availableHeight > 0 ? availableHeight / contentHeight : 1)
            : 1
        setPreviewScale(previous => Math.abs(previous - nextScale) < 0.001 ? previous : nextScale)
    }, [fitRequested])

    /** Toggle between the natural POI size and a scale that fits the preview frame. */
    const handleFitToggle = useCallback(() => {
        setFitRequested(previous => !previous)
    }, [])

    /** Restore the preview frame to its initial minimum height. */
    const handleResetPreviewSize = useCallback(() => {
        setPreviewHeight(null)
    }, [])

    /**
     * Start resizing the preview from its lower edge.
     *
     * @param {import('react').PointerEvent<HTMLDivElement>} event - Pointer press event.
     * @returns {void}
     */
    const handleResizePointerDown = event => {
        if (event.button !== 0 || !_preview.current) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        _resizeGesture.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: _preview.current.getBoundingClientRect().height,
        }
        setIsResizing(true)
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }

    /**
     * Resize the preview while the pointer is held.
     *
     * @param {import('react').PointerEvent<HTMLDivElement>} event - Pointer movement event.
     * @returns {void}
     */
    const handleResizePointerMove = event => {
        const gesture = _resizeGesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        setPreviewHeight(Math.max(
            MIN_PREVIEW_HEIGHT,
            Math.min(window.innerHeight * 0.5, gesture.startHeight + event.clientY - gesture.startY),
        ))
    }

    /**
     * Finish the preview resize gesture.
     *
     * @param {import('react').PointerEvent<HTMLDivElement>} event - Pointer release or cancellation event.
     * @returns {void}
     */
    const handleResizePointerEnd = event => {
        if (!_resizeGesture.current || _resizeGesture.current.pointerId !== event.pointerId) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        _resizeGesture.current = null
        setIsResizing(false)
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
    }

    /**
     * Resize the preview with keyboard commands.
     *
     * @param {import('react').KeyboardEvent<HTMLDivElement>} event - Keyboard interaction event.
     * @returns {void}
     */
    const handleResizeKeyDown = event => {
        const step = event.shiftKey ? 80 : 20
        const currentHeight = previewHeight ?? MIN_PREVIEW_HEIGHT
        let nextHeight = currentHeight

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            nextHeight += step
        }
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            nextHeight -= step
        }
        else if (event.key === 'Home') {
            nextHeight = MIN_PREVIEW_HEIGHT
        }
        else if (event.key === 'End') {
            nextHeight = window.innerHeight * 0.5
        }
        else {
            return
        }

        event.preventDefault()
        setPreviewHeight(Math.max(MIN_PREVIEW_HEIGHT, Math.min(window.innerHeight * 0.5, nextHeight)))
    }

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setBackground(buildPOIEditPreviewBackground(poi))
        })
        return () => cancelAnimationFrame(frame)
    }, [poi])

    useLayoutEffect(() => {
        updatePreviewSizing()
        const observer = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(updatePreviewSizing)
        if (_openArea.current) observer?.observe(_openArea.current)
        if (_openContent.current) observer?.observe(_openContent.current)
        return () => observer?.disconnect()
    }, [point, updatePreviewSizing])

    if (!point?.id) {
        return null
    }

    const canIncreaseHeight = typeof window !== 'undefined'
        && (previewHeight ?? MIN_PREVIEW_HEIGHT) < window.innerHeight * 0.5

    return (
        <section
            ref={_preview}
            className="map-poi-edit-preview"
            aria-label="POI preview"
            style={{
                ...(background ? {backgroundImage: `url(${String(background)})`} : {}),
                ...(previewHeight ? {height: `${Number(previewHeight)}px`} : {}),
            }}
        >
            <div className="map-poi-edit-preview-open-area" ref={_openArea}>
                <div className="map-poi-edit-preview-open" ref={_openContent}>
                    <MapPOIContent
                        poi={poi}
                        domPreview
                        style={{
                            position: 'relative',
                            top: 0,
                            left: 0,
                            transform: `scale(${previewScale})`,
                            transformOrigin: 'center center',
                            pointerEvents: 'none',
                            '--poi-expanded-dimension': `${point.display?.maxWidth ?? 200}px`,
                        }}
                    />
                </div>
            </div>
            <div className="map-poi-edit-preview-closed" aria-hidden="true">
                <MapPOIContent
                    poi={poi}
                    collapsedPreview
                    style={{position: 'relative', top: 0, left: 0}}
                />
            </div>
            {requiresFit && (
                <WaButton
                    className="map-poi-edit-preview-fit square-button small"
                    size="s"
                    variant="brand"
                    appearance="filled-outlined"
                    aria-label={fitRequested ? 'Restore POI preview size' : 'Scale POI to fit preview'}
                    title={fitRequested ? 'Restore POI preview size' : 'Scale POI to fit preview'}
                    onClick={handleFitToggle}
                >
                    <WaIcon name={fitRequested ? 'expand' : 'compress'} variant="regular"/>
                </WaButton>
            )}
            {previewHeight > MIN_PREVIEW_HEIGHT && (
                <WaButton
                    className="map-poi-edit-preview-reset square-button small"
                    size="s"
                    variant="brand"
                    appearance="filled-outlined"
                    aria-label="Restore initial POI preview height"
                    title="Restore initial POI preview height"
                    onClick={handleResetPreviewSize}
                >
                    <WaIcon name="arrow-rotate-left" variant="regular"/>
                </WaButton>
            )}
            {(canIncreaseHeight || isResizing) && (
                <div
                    className="map-poi-edit-preview-resize"
                    role="separator"
                    aria-label="Resize POI preview"
                    aria-orientation="horizontal"
                    aria-valuemin={MIN_PREVIEW_HEIGHT}
                    aria-valuemax={typeof window === 'undefined' ? MIN_PREVIEW_HEIGHT : Math.max(MIN_PREVIEW_HEIGHT, window.innerHeight * 0.5)}
                    aria-valuenow={Math.round(previewHeight ?? MIN_PREVIEW_HEIGHT)}
                    tabIndex={0}
                    onKeyDown={handleResizeKeyDown}
                    onPointerDown={handleResizePointerDown}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerEnd}
                    onPointerCancel={handleResizePointerEnd}
                >
                    <WaIcon name="grip-lines" variant="regular" aria-hidden="true"/>
                </div>
            )}
        </section>
    )
}
