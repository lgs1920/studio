/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGSPopup.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaPopup as WaPopupBase }                                          from '@web.awesome.me/webawesome-pro/dist/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

const resolveAnchorElement = (anchor) => {
    if (!anchor || typeof Element === 'undefined') {
        return null
    }

    if (typeof anchor === 'string') {
        return document.getElementById(anchor)
    }

    if (anchor instanceof Element) {
        return anchor
    }

    return anchor.contextElement instanceof Element ? anchor.contextElement : null
}

export const LGSPopup = forwardRef(function LGSPopup(props, ref) {
    const innerRef = useRef(null)
    const {
              active                    = false,
              anchor,
              closeOnOutsidePointerDown = true,
              closeOnEscape             = true,
              outsideAnchors            = [],
              onRequestClose,
              flip                      = true,
              shift                     = true,
              ...restProps
          } = props

    useImperativeHandle(ref, () => innerRef.current, [])

    const requestClose = useCallback((event) => {
        onRequestClose?.(event)
    }, [onRequestClose])

    useEffect(() => {
        if (!active || typeof onRequestClose !== 'function') {
            return
        }

        const handlePointerDown = (event) => {
            if (!closeOnOutsidePointerDown) {
                return
            }

            const popup = innerRef.current
            if (!popup) {
                return
            }

            const composedPath = event.composedPath?.() ?? []
            const path = composedPath.length > 0 ? composedPath : [event.target]
            const anchorElement = resolveAnchorElement(anchor)
            const outsideAnchorElements = outsideAnchors
                .map(resolveAnchorElement)
                .filter(Boolean)

            if (
                path.includes(popup)
                || path.includes(popup.popup)
                || (anchorElement && path.includes(anchorElement))
                || outsideAnchorElements.some(element => path.includes(element))
            ) {
                return
            }

            requestClose(event)
        }

        const handleKeyDown = (event) => {
            if (closeOnEscape && event.key === 'Escape') {
                requestClose(event)
            }
        }

        if (closeOnOutsidePointerDown) {
            document.addEventListener('pointerdown', handlePointerDown, true)
        }

        if (closeOnEscape) {
            window.addEventListener('keydown', handleKeyDown, true)
        }

        return () => {
            if (closeOnOutsidePointerDown) {
                document.removeEventListener('pointerdown', handlePointerDown, true)
            }

            if (closeOnEscape) {
                window.removeEventListener('keydown', handleKeyDown, true)
            }
        }
    }, [active, anchor, closeOnEscape, closeOnOutsidePointerDown, onRequestClose, outsideAnchors, requestClose])

    return <WaPopupBase ref={innerRef} active={active} anchor={anchor} flip={flip} shift={shift} {...restProps} />
})

export default LGSPopup
