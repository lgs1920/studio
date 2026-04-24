/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Toast.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/* eslint-disable react-refresh/only-export-components */

import { useEffect, useRef }     from 'react'
import { SECOND }                from '@Core/constants'
import parse                     from 'html-react-parser'
import { toast, ToastContainer } from 'react-toastify'
import { WaCallout, WaIcon }     from '@web.awesome.me/webawesome-pro/dist/react'
import 'react-toastify/dist/ReactToastify.css'

export const LGS_INFORMATION_TOAST = 'primary'
export const LGS_SUCCESS_TOAST = 'success'
export const LGS_WARNING_TOAST = 'warning'
export const LGS_ERROR_TOAST = 'danger'
export const LGS_TOAST_DURATION = 5 * SECOND

const LGS_TOAST_ICONS = {
    [LGS_INFORMATION_TOAST]: 'circle-info',
    [LGS_SUCCESS_TOAST]:     'circle-check',
    [LGS_WARNING_TOAST]:     'triangle-exclamation',
    [LGS_ERROR_TOAST]:       'bomb',
}

const LGS_TOAST_VARIANTS = {
    [LGS_INFORMATION_TOAST]: 'brand',
    [LGS_SUCCESS_TOAST]:     'success',
    [LGS_WARNING_TOAST]:     'warning',
    [LGS_ERROR_TOAST]:       'danger',
}

const LGS_TOAST_CLASSES = {
    [LGS_INFORMATION_TOAST]: 'lgs-toast--primary',
    [LGS_SUCCESS_TOAST]:     'lgs-toast--success',
    [LGS_WARNING_TOAST]:     'lgs-toast--warning',
    [LGS_ERROR_TOAST]:       'lgs-toast--danger',
}

let toastLayerHost = null

const isToastLayerOpen = (host = toastLayerHost) => {
    if (!host || typeof host.matches !== 'function') {
        return false
    }

    try {
        return host.matches(':popover-open')
    }
    catch {
        return host.dataset.lgsToastLayerOpen === 'true'
    }
}

const openToastLayer = (host = toastLayerHost) => {
    if (!host) {
        return
    }

    if (typeof host.showPopover === 'function' && !isToastLayerOpen(host)) {
        try {
            host.showPopover()
        }
        catch {
            // Keep the classic fixed-position stack as a fallback when popover is unavailable.
        }
    }

    host.dataset.lgsToastLayerOpen = 'true'
}

const bringToastLayerToFront = (host = toastLayerHost) => {
    if (!host) {
        return
    }

    if (typeof host.showPopover === 'function' && typeof host.hidePopover === 'function') {
        try {
            if (isToastLayerOpen(host)) {
                host.hidePopover()
            }

            host.showPopover()
        }
        catch {
            // Ignore and keep the z-index fallback.
        }
    }

    host.dataset.lgsToastLayerOpen = 'true'
}

const closeToastLayer = (host = toastLayerHost) => {
    if (!host) {
        return
    }

    if (typeof host.hidePopover === 'function' && isToastLayerOpen(host)) {
        try {
            host.hidePopover()
        }
        catch {
            // Nothing else to do here.
        }
    }

    host.dataset.lgsToastLayerOpen = 'false'
}

const normalizeMessage = (message) => {
    if (typeof message === 'string') {
        return {caption: message, text: ''}
    }

    return message || {caption: '', text: ''}
}

const renderContent = (content) => {
    if (content === undefined || content === null || content === '') {
        return null
    }

    return (typeof content === 'string') ? parse(content) : content
}

export const CalloutToast = ({message, type = LGS_INFORMATION_TOAST}) => {
    const normalizedMessage = normalizeMessage(message)
    const caption = renderContent(normalizedMessage.caption)
    const text = renderContent(normalizedMessage.text)
    const toastClass = LGS_TOAST_CLASSES[type] || LGS_TOAST_CLASSES[LGS_INFORMATION_TOAST]

    return (
        <WaCallout
            className={`lgs-toast-callout ${toastClass}`}
            appearance="filled-outlined"
            size="small"
            variant={LGS_TOAST_VARIANTS[type] || 'brand'}
        >
            <WaIcon
                slot="icon"
                name={LGS_TOAST_ICONS[type] || LGS_TOAST_ICONS[LGS_INFORMATION_TOAST]}
                variant="regular"
            />
            {caption && <div className="toast-caption">{caption}</div>}
            {text && <div className="toast-text">{text}</div>}
        </WaCallout>
    )
}

export const showToast = (message, type = LGS_INFORMATION_TOAST, duration = LGS_TOAST_DURATION) => {
    const toastClass = LGS_TOAST_CLASSES[type] || LGS_TOAST_CLASSES[LGS_INFORMATION_TOAST]

    bringToastLayerToFront()

    return toast(<CalloutToast message={message} type={type}/>, {
                                                                    autoClose:         duration,
                                                                    className:         `lgs-toast ${toastClass}`,
                                                                    closeOnClick:      false,
                                                                    closeButton:       true,
                                                                    draggable:         true,
                                                                    hideProgressBar:   false,
                                                                    pauseOnHover:      true,
                                                                    progressClassName: `lgs-toast-progress ${toastClass}`,
                                                                    style:             {
                                                                        background:   'transparent',
                                                                        boxShadow:    'none',
                                                                        padding:      0,
                                                                        minHeight:    0,
                                                                        borderRadius: 0,
                                                                    },
                                                                })
}

export const Toast = () => {
    const _layer = useRef(null)

    useEffect(() => {
        const layer = _layer.current

        if (!layer) {
            return undefined
        }

        toastLayerHost = layer
        openToastLayer(layer)

        return () => {
            closeToastLayer(layer)

            if (toastLayerHost === layer) {
                toastLayerHost = null
            }
        }
    }, [])

    return (
        <div ref={_layer} className="lgs-toast-layer" popover="manual">
            <ToastContainer
                className="lgs-toaster"
                position="bottom-left"
                newestOnTop
                closeOnClick={false}
                draggable
                pauseOnHover
            />
        </div>
    )
}

export const useToast = ({message, type = LGS_INFORMATION_TOAST, duration = LGS_TOAST_DURATION} = {}) => {
    const trigger = () => showToast(message, type, duration)
    return [null, trigger]
}
