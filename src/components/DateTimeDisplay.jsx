/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DateTimeDisplay.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
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

const isSameDateRange = items => items.length === 2
                                && items[0].date
                                && items[0].date === items[1].date
                                && items[0].time
                                && items[1].time

export const DateTimeDisplay = ({
                                    value = null,
                                    items = null,
                                    className = '',
                                    dateFormat = defaultDateFormat,
                                    timeFormat = defaultTimeFormat,
                                    separator = '-',
                                    forceStack = false,
                                    stackItems = null,
                                    stackDateTime = null,
                                    leading = null,
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
    const sameDateRange = isSameDateRange(normalizedItems)
    const hasLeading = Boolean(leading)
    const shouldStackItems = !sameDateRange && (forceStack || (stackItems ?? normalizedItems.length > 1))
    const shouldStackDateTime = forceStack || (stackDateTime ?? autoStack)

    useLayoutEffect(() => {
        if (forceStack || normalizedItems.length === 0) {
            return undefined
        }

        const updateLayout = () => {
            const root = rootRef.current
            const measure = measureRef.current
            if (!root || !measure) {
                return
            }

            const availableWidth = root.getBoundingClientRect().width
            const requiredWidth = Array.from(measure.children)
                                       .reduce((width, child) => Math.max(width, child.scrollWidth), 0)
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
    }, [forceStack, normalizedItems, stackDateTime])

    if (normalizedItems.length === 0) {
        return null
    }

    const renderTimePart = (item, index) => (
        <span className="lgs-date-time-display-time-part" key={`${item.time}-${index}`}>
            {item.leading && <span className="lgs-date-time-display-leading">{item.leading}</span>}
            <span className="lgs-date-time-display-time">{item.time}</span>
        </span>
    )

    const renderItem = (item, index, {measuring = false} = {}) => (
        <span className="lgs-date-time-display-item" key={`${item.date}-${item.time}-${index}`}>
            {item.leading && <span className="lgs-date-time-display-leading">{item.leading}</span>}
            <span className="lgs-date-time-display-date">{item.date}</span>
            {item.date && item.time && !shouldStackDateTime && !measuring && (
                <span className="lgs-date-time-display-separator">{separator}</span>
            )}
            {item.date && item.time && measuring && <span className="lgs-date-time-display-separator">{separator}</span>}
            {item.time && <span className="lgs-date-time-display-time">{item.time}</span>}
        </span>
    )

    const renderSameDateRange = () => (
        <span className="lgs-date-time-display-item lgs-date-time-display-range">
            <span className="lgs-date-time-display-date">{normalizedItems[0].date}</span>
            <span className="lgs-date-time-display-time-range">
                {renderTimePart(normalizedItems[0], 0)}
                <span className="lgs-date-time-display-separator">{separator}</span>
                {renderTimePart(normalizedItems[1], 1)}
            </span>
        </span>
    )

    const renderedContent = sameDateRange
                            ? renderSameDateRange()
                            : normalizedItems.map((item, index) => renderItem(item, index))
    const renderedMeasure = sameDateRange
                            ? renderSameDateRange()
                            : normalizedItems.map((item, index) => renderItem(item, index, {measuring: true}))

    return (
        <span
            className={`lgs-date-time-display ${className}`.trim()}
            data-items-stacked={shouldStackItems ? 'true' : 'false'}
            data-date-time-stacked={shouldStackDateTime ? 'true' : 'false'}
            data-leading={hasLeading ? 'true' : 'false'}
            ref={rootRef}
        >
            {hasLeading && (
                <span className="lgs-date-time-display-icon-cell">
                    {leading}
                </span>
            )}
            <span className="lgs-date-time-display-content">
                {renderedContent}
            </span>
            {!forceStack && (
                <span className="lgs-date-time-display-measure" ref={measureRef} aria-hidden="true">
                    {renderedMeasure}
                </span>
            )}
        </span>
    )
}
