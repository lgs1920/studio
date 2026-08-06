/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
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

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIListItem.jsx
 ******************************************************************************/

import { MapPOIEditContent }                               from '@Components/MainUI/MapPOI/MapPOIEditContent'
import { MapPOISummary }                                   from '@Components/MainUI/MapPOI/MapPOISummary'
import { POI_FLAG_START, POI_FLAG_STOP, POI_STARTER_TYPE } from '@Core/constants'
import { WaDetails, WaIcon }                               from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                                          from 'classnames'
import { memo, useCallback, useRef } from 'react'
import { proxy, useSnapshot } from 'valtio'

const EMPTY_POI_PROXY = proxy({})

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
    const poi = useSnapshot($poi ?? EMPTY_POI_PROXY)
    const itemRef = useRef(null)

    const isCurrent = current === id
    const isSelected = bulkList.has(id)

    const scrollIntoView = useCallback(() => {
        itemRef.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'})
    }, [])

    const handleDetailsShow = useCallback((event) => {
        if (event?.target !== event?.currentTarget) {
            return
        }
        if ($pois.current !== id) {
            $pois.current = id
        }
        scrollIntoView()
    }, [$pois, id, scrollIntoView])

    const handleDetailsHide = useCallback((event) => {
        if (event?.target !== event?.currentTarget) {
            return
        }
        queueMicrotask(() => {
            if ($pois.current === id) {
                $pois.current = false
            }
        })
    }, [$pois, id])

    if (!poi.id) {
        return null
    }

    return (
        <div
            id={`edit-map-poi-${id}`}
            ref={itemRef}
            className={classNames('edit-map-poi-item-wrapper', {'is-selected': isSelected})}
        >
            {canSelect && <POIBulkToggle id={id}/>}
            <WaDetails
                className={classNames('edit-map-poi-item', {'map-poi-hidden': !poi.visible}, 'lgs--details-hoverable')}
                open={isCurrent}
                onWaShow={handleDetailsShow}
                onWaAfterShow={scrollIntoView}
                onWaHide={handleDetailsHide}
            >
                <div slot="summary">
                    <MapPOISummary poi={id} useInMenu={true}/>
                </div>
                {isCurrent && <MapPOIEditContent poi={id}/>}
            </WaDetails>
        </div>
    )
})

MapPOIListItem.displayName = 'MapPOIListItem'
