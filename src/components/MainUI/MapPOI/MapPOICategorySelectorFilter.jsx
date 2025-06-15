/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICategorySelectorFilter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-15
 * Last modified: 2025-06-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { memo, useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                           from 'valtio'
import { FontAwesomeIcon }                       from '@Components/FontAwesomeIcon'
import { POI_CATEGORY_ICONS }                    from '@Core/constants'
import { faTrashCan }                            from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlOption, SlSelect, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'

/**
 * A memoized React component for selecting and filtering POI categories.
 * @param {Object} props - Component props
 * @param {Function} props.onChange - Callback for filter changes
 * @param {Function} props.handleCategories - Handler for category selection changes
 * @param {Function} props.handleExclusion - Handler for exclusion toggle changes
 * @param {string} [props.size='small'] - Size of the select component
 * @returns {JSX.Element} The rendered category selector filter
 */
export const MapPOICategorySelectorFilter = memo(({onChange, handleCategories, handleExclusion, size = 'small'}) => {
    const settings = useSnapshot(lgs.settings.poi)
    const $pois = lgs.mainProxy.components.pois
    const pois = useSnapshot($pois)

    // Memoized clear icon
    const clearIcon = useMemo(() => (
        <FontAwesomeIcon slot="clear-icon" icon={faTrashCan}/>
    ), [])

    // Memoized category options
    const categoryOptions = useMemo(() => {
        return Array.from(pois.categories).map(([slug, category]) => (
            <SlOption key={slug} value={slug}>
                <FontAwesomeIcon
                    slot="prefix"
                    icon={Object.values(POI_CATEGORY_ICONS.get(slug))[0]}
                    style={{
                        '--fa-secondary-color':   'var(--lgs-light-color)',
                        '--fa-secondary-opacity': 1,
                        '--fa-primary-color':     'var(--lgs-dark-color)',
                        '--fa-primary-opacity':   1,
                    }}
                />
                {category.title}
            </SlOption>
        ))
    }, [pois.categories])

    // Memoized label slot
    const labelSlot = useMemo(() => (
        <div className="map-poi-category-filter" slot="label">
            <span>By Categories</span>
            {settings.filter.byCategories.length > 0 && (
                <SlSwitch
                    size="small"
                    align-right
                    checked={settings.filter.exclude}
                    onSlChange={handleExclusion}
                >
                    Exclude
                </SlSwitch>
            )}
        </div>
    ), [settings.filter.byCategories.length, settings.filter.exclude, handleExclusion])

    // Optimize useEffect to avoid unnecessary onChange calls
    useEffect(() => {
        if (!settings.filter.byCategories) {
            lgs.settings.poi.filter.byCategories = []
        }
        onChange()
    }, [settings.filter.byCategories, settings.filter.exclude, onChange])

    return (
        <SlSelect
            value={settings.filter.byCategories}
            size={size}
            className="map-poi-category-selector-filter"
            multiple
            onSlChange={handleCategories}
            placeholder="Select categories"
            clearable
        >
            {clearIcon}
            {categoryOptions}
            {labelSlot}
        </SlSelect>
    )
})