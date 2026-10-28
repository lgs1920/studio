/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOISummary.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-25
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
 ******************************************************************************/

import { ICONS_PATH }                from '@Core/constants'
import { applyPOIDuotoneIconStyles } from '@Components/MainUI/MapPOI/duotoneIconUtils'
import { WaIcon }                    from '@awesome.me/webawesome/dist/react'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot }               from 'valtio'
import './style.css'

export const MapPOISummary = ({poi}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const point = useMemo(() => pois.list.get(poi), [pois.list, poi])
    const displayTitle = `${point?.title ?? point?.name ?? point?.id ?? 'POI'}`.trim() || 'POI'
    const badgeExpiresAt = Number(point?.newBadgeExpiresAt)
    const [now, setNow] = useState(() => Date.now())
    const showNewBadge = Number.isFinite(badgeExpiresAt) && badgeExpiresAt > now

    useEffect(() => {
        const delay = badgeExpiresAt - Date.now()
        if (!Number.isFinite(badgeExpiresAt) || delay <= 0) {
            return undefined
        }

        const timeout = window.setTimeout(() => setNow(Date.now()), delay)
        return () => window.clearTimeout(timeout)
    }, [badgeExpiresAt])

    const iconName = point?.categoryIcon?.(point.category)
    const isSvg = iconName?.endsWith('.svg')

    return (
        <div className="map-poi-edit-summary">
            <span>
                <WaIcon name={point?.visible ? (!isSvg ? iconName : '') : 'mask'}
                        src={isSvg ? `${ICONS_PATH}/${iconName}` : ''}
                        className="poi-duotone-icon"
                        variant="regular" family="duotone"
                        onWaLoad={applyPOIDuotoneIconStyles}
                />
                <span className="map-poi-summary-title">{displayTitle}</span>
            </span>
            <span className="map-poi-summary-indicators">
                    {showNewBadge && <span className="map-poi-new-badge" aria-label="New POI" title="New POI">N</span>}
                    {point?.visible && <>
                        <WaIcon name="square" style={{color: point.bgColor}} variant="solid"/>
                        <WaIcon name="square" style={{color: point.color}} variant="solid"/>
                    </>}
            </span>

        </div>
    )
}
