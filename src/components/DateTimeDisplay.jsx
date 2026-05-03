/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DateTimeDisplay.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-05-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DateTime } from 'luxon'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import './DateTimeDisplay.css'

const defaultDateFormat = DateTime.DATE_FULL
const defaultTimeFormat = DateTime.TIME_SIMPLE

const toDateTime = value => {
    if (!value) {
        return null
    }
    if (DateTime.isDateTime(value)) {
        return value.isValid ? value : null
    }

    const dateTime = DateTime.fromISO(value)

    return dateTime.isValid ? dateTime : null
}

const normalizeItem = (item, {dateFormat = defaultDateFormat, timeFormat = defaultTimeFormat} = {}) => {
    if (!item) {
        return null
    }
    const base = typeof item === 'object' && !DateTime.isDateTime(item) ? item : {}

    if (base.date || base.time) {
        return {
            ...base,
            date: base.date ?? '',
            time: base.time ?? '',
        }
    }

    const dateTime = toDateTime(base.value ?? item)

    if (!dateTime) {
        return null
    }

    return {
        ...base,
        date: dateTime.toLocaleString(dateFormat),
        time: dateTime.toLocaleString(timeFormat),
    }
}

export const DateTimeDisplay = ({
                                    value = null,
                                    items = null,
                                    className = '',
                                    dateFormat = defaultDateFormat,
                                    timeFormat = defaultTimeFormat,
                                    separator = '-',
                                    forceStack = false,
                                }) => {
    const rootRef = useRef(null)
    const measureRef = useRef(null)
    const [autoStack, setAutoStack] = useState(false)
    const normalizedItems = useMemo(() => {
        const source = items ?? (value ? [value] : [])

        return source
            .map(item => normalizeItem(item, {dateFormat, timeFormat}))
            .filter(Boolean)
    }, [dateFormat, items, timeFormat, value])
    const shouldStack = forceStack || normalizedItems.length > 1 || autoStack

    useLayoutEffect(() => {
        if (forceStack || normalizedItems.length !== 1) {
            setAutoStack(false)
            return undefined
        }

        const updateLayout = () => {
            const root = rootRef.current
            const measure = measureRef.current
            if (!root || !measure) {
                return
            }

            const availableWidth = root.getBoundingClientRect().width
            const requiredWidth = measure.scrollWidth
            setAutoStack(requiredWidth > availableWidth && availableWidth > 0)
        }

        updateLayout()

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateLayout)
            return () => window.removeEventListener('resize', updateLayout)
        }

        const resizeObserver = new ResizeObserver(updateLayout)
        resizeObserver.observe(rootRef.current)

        return () => resizeObserver.disconnect()
    }, [forceStack, normalizedItems])

    if (normalizedItems.length === 0) {
        return null
    }

    const renderItem = (item, index, {measuring = false} = {}) => (
        <span className="lgs-date-time-display-item" key={`${item.date}-${item.time}-${index}`}>
            {item.leading && <span className="lgs-date-time-display-leading">{item.leading}</span>}
            <span className="lgs-date-time-display-date">{item.date}</span>
            {item.date && item.time && !shouldStack && !measuring && (
                <span className="lgs-date-time-display-separator">{separator}</span>
            )}
            {item.date && item.time && measuring && <span className="lgs-date-time-display-separator">{separator}</span>}
            {item.time && <span className="lgs-date-time-display-time">{item.time}</span>}
        </span>
    )

    return (
        <span
            className={`lgs-date-time-display ${className}`.trim()}
            data-stacked={shouldStack ? 'true' : 'false'}
            ref={rootRef}
        >
            <span className="lgs-date-time-display-content">
                {normalizedItems.map((item, index) => renderItem(item, index))}
            </span>
            {normalizedItems.length === 1 && (
                <span className="lgs-date-time-display-measure" ref={measureRef} aria-hidden="true">
                    {renderItem(normalizedItems[0], 0, {measuring: true})}
                </span>
            )}
        </span>
    )
}
