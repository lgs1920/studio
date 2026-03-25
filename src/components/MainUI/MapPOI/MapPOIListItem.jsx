/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-25
 * Last modified: 2026-03-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 ******************************************************************************/

import { MapPOIContent }           from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapPOIEditContent }       from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { MapPOISummary } from '@Components/MainUI/MapPOI/MapPOISummary'
import { POI_STARTER_TYPE, POI_TMP_TYPE, POIS_EDITOR_DRAWER } from '@Core/constants'
import { SlDetails }               from '@shoelace-style/shoelace/dist/react'
import { FontAwesomeIcon }         from '@fortawesome/react-fontawesome'
import { faSquareCheck, faSquare } from '@fortawesome/pro-duotone-svg-icons'
import { WaDetails, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                  from 'classnames'
import { memo, useCallback, useMemo } from 'react'
import { useSnapshot }             from 'valtio'

const POIBulkToggle = memo(({id}) => {
    const $pois = lgs.stores.main.components.pois
    const {bulkList} = useSnapshot($pois, {sync: true})
    const isSelected = bulkList.has(id)

    const toggle = useCallback((e) => {
        e.stopPropagation()
        if (isSelected) {
            $pois.bulkList.delete(id)
        }
        else {
            $pois.bulkList.set(id, true)
        }
    }, [id, isSelected, $pois.bulkList])

    return (
        <div className="map-poi-item-checkbox" onClick={toggle}>
            <WaIcon name={isSelected ? 'square-check' : 'square'}
                    variant="regular"
                className={classNames({'is-active': isSelected})}
            />
        </div>
    )
})

POIBulkToggle.displayName = 'POIBulkToggle'

export const MapPOIListItem = memo(({id, canSelect}) => {
    const $pois = lgs.stores.main.components.pois
    const $poi = $pois.list.get(id)
    const {current, bulkList} = useSnapshot($pois)
    const {open: drawerOpen} = useSnapshot(lgs.stores.ui.drawers)
    const poi = useSnapshot($poi || {})

    const isCurrent = current === id
    const isSelected = bulkList.has(id)

    const handleSummaryClick = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        $pois.current = isCurrent ? false : id
        // engine focus logic omitted for brevity, keep your existing selectPOI here
    }, [isCurrent, id, $pois])

    const styles = useMemo(() => {
        if (!poi.id) {
            return {}
        }
        const bg = poi.bgColor ?? lgs.colors.poiDefaultBackground
        return {
            '--map-poi-bg-header':  __.ui.ui.hexToRGBA(bg, 'rgba', 0.2),
            '--fa-primary-color':   poi.color,
            '--fa-secondary-color': bg,
        }
    }, [poi.id, poi.bgColor, poi.color])

    if (!poi.id) {
        return null
    }

    return (
        <div className={classNames('edit-map-poi-item-wrapper', {'is-selected': isSelected})}>
            {canSelect && <POIBulkToggle id={id}/>}
            <WaDetails
                className={classNames('edit-map-poi-item', {'map-poi-hidden': !poi.visible}, 'lgs--details-hoverable')}
                open={isCurrent}
            >
                <div slot="summary" onClick={handleSummaryClick}>
                    <MapPOISummary poi={id} useInMenu={true}/>
                </div>
                {isCurrent && <MapPOIEditContent poi={id}/>}
            </WaDetails>
        </div>
    )
})

MapPOIListItem.displayName = 'MapPOIListItem'