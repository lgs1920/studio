/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Toast.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/* oxlint-disable react/only-export-components */

import { SECOND } from '@Core/constants'
import parse from 'html-react-parser'
import { useEffect, useState } from 'react'
import { WaIcon, WaToast, WaToastItem } from '@web.awesome.me/webawesome-pro/dist/react'

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

let toastSequence = 0
const pendingToasts = []
const TOAST_EVENT = 'lgs-toast:create'

/**
 * Normalizes the supported notification input shapes.
 * @param {string|Object} message Notification content.
 * @returns {{caption: *, text: *}} Normalized notification content.
 */
const normalizeMessage = (message) => {
    if (typeof message === 'string') {
        return {caption: message, text: ''}
    }

    return message || {caption: '', text: ''}
}

/**
 * Converts an HTML string to React content while preserving existing rich toast messages.
 * @param {*} content Notification content.
 * @returns {*} Renderable React content.
 */
const renderContent = (content) => {
    if (content === undefined || content === null || content === '') {
        return null
    }

    return typeof content === 'string' ? parse(content) : content
}

/**
 * Creates a notification request for the mounted toast host.
 * @param {string|Object} message Notification content.
 * @param {string} type Notification variant.
 * @param {number} duration Display duration in milliseconds.
 * @returns {number} Notification identifier.
 */
export const showToast = (message, type = LGS_INFORMATION_TOAST, duration = LGS_TOAST_DURATION) => {
    const notification = {
        duration,
        id:       ++toastSequence,
        message,
        type,
    }

    if (typeof window === 'undefined') {
        pendingToasts.push(notification)
    }
    else {
        window.dispatchEvent(new CustomEvent(TOAST_EVENT, {detail: notification}))
    }

    return notification.id
}

/**
 * Renders the content of one notification item.
 * @param {Object} message Notification content.
 * @returns {JSX.Element} Notification content.
 */
export const CalloutToast = ({message}) => {
    const normalizedMessage = normalizeMessage(message)
    const caption = renderContent(normalizedMessage.caption)
    const text = renderContent(normalizedMessage.text)

    return (
        <>
            {caption && <div className="toast-caption">{caption}</div>}
            {text && <div className="toast-text">{text}</div>}
        </>
    )
}

/**
 * Renders the application-wide Web Awesome toast host.
 * @returns {JSX.Element} Toast host and active notification items.
 */
export const Toast = () => {
    const [notifications, setNotifications] = useState(() => pendingToasts.splice(0))
    const [hidingToastIds, setHidingToastIds] = useState(() => new Set())

    useEffect(() => {
        /**
         * Adds an emitted notification to the visible toast list.
         * @param {CustomEvent} event Toast creation event.
         * @returns {void}
         */
        const handleToast = (event) => {
            setNotifications((current) => [...current, event.detail])
        }

        window.addEventListener(TOAST_EVENT, handleToast)

        return () => window.removeEventListener(TOAST_EVENT, handleToast)
    }, [])

    /**
     * Removes a notification after the React-owned hide animation completes.
     * @param {number} id Notification identifier.
     * @returns {void}
     */
    const removeToast = (id) => {
        setNotifications((current) => current.filter(notification => notification.id !== id))
        setHidingToastIds((current) => {
            const next = new Set(current)
            next.delete(id)
            return next
        })
    }

    /**
     * Starts the exit animation and prevents Web Awesome from removing the React-owned item.
     * @param {Event} event Web Awesome hide event.
     * @param {number} id Notification identifier.
     * @returns {void}
     */
    const hideToast = (event, id) => {
        event.preventDefault()
        setHidingToastIds((current) => new Set(current).add(id))

        window.setTimeout(() => removeToast(id), 220)
    }

    return (
        <WaToast className="lgs-toaster" placement="bottom-start">
            {notifications.map(({duration, id, message, type}) => (
                <WaToastItem
                    key={id}
                    className={`lgs-toast lgs-toast--${type}${hidingToastIds.has(id) ? ' lgs-toast--hiding' : ''}`}
                    duration={duration}
                    onWaHide={(event) => hideToast(event, id)}
                    size="s"
                    variant={LGS_TOAST_VARIANTS[type] || 'brand'}
                    withIcon
                >
                    <WaIcon slot="icon" name={LGS_TOAST_ICONS[type] || LGS_TOAST_ICONS[LGS_INFORMATION_TOAST]}
                            variant="regular"/>
                    <CalloutToast message={message}/>
                </WaToastItem>
            ))}
        </WaToast>
    )
}

/**
 * Provides the legacy hook-shaped toast trigger API.
 * @param {Object} options Default notification options.
 * @returns {[null, Function]} Placeholder state and notification trigger.
 */
export const useToast = ({message, type = LGS_INFORMATION_TOAST, duration = LGS_TOAST_DURATION} = {}) => {
    const trigger = () => showToast(message, type, duration)
    return [null, trigger]
}
