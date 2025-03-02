/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditFilter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-03-02
 * Last modified: 2025-03-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { ToggleStateIcon }                                       from '@Components/ToggleStateIcon'
import { faArrowDownAZ, faArrowDownZA, faFilter, faFilterSlash } from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlIconButton, SlInput, SlTooltip }           from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                 from '@Utils/FA2SL'
import React, { useEffect }                                      from 'react'
import { useSnapshot }                                           from 'valtio/index'

export const MapPOIEditFilter = () => {

    const settings = useSnapshot(lgs.settings.poi)

    const handleFilter = () => {
        lgs.settings.poi.filter.open = !lgs.settings.poi.filter.open
    }

    const handleFilterByName = (event) => {
        lgs.settings.poi.filter.byName = event.target.value
    }

    const handleAlphabetic = (event) => {
        lgs.settings.poi.filter.alphabetic = !lgs.settings.poi.filter.alphabetic
    }

    useEffect(() => {
        lgs.settings.poi.filter.active = lgs.settings.poi.filter.byName !== '' || !lgs.settings.poi.filter.alphabetic
    }, [settings.filter])
    return (
        <div className="map-poi-edit-filter">
            <div className="map-poi-edit-toggle-filter">
                <SlTooltip content={settings.filter.open ? 'Hide Filters' : 'Show Filters'}>
                    <SlIconButton id="map-poi-edit-filter-trigger" onClick={handleFilter}
                                  library="fa"
                                  name={FA2SL.set(settings.filter.open ? faFilterSlash : faFilter)}
                                  className={settings.filter.active ? 'map-poi-filter-active' : 'map-poi-filter-inactive'}
                    />
                </SlTooltip>
                <SlDivider/>
            </div>

            {settings.filter.open &&
                <>
                    <div className="map-poi-filter-by-name">
                        <SlInput size="small" value={settings.filter.byName}
                                 onSlChange={handleFilterByName}
                                 onInput={handleFilterByName}
                                 placeholder={'Filter by Name'}
                                 className="edit-map-poi-input">
                        </SlInput>
                        <SlTooltip hoist content={settings.filter.alphabetic ? 'Reverse Alphabetic' : 'Alphabetic'}>
                            <ToggleStateIcon id="map-poi-filter-alphabetic"
                                             icons={{shown: faArrowDownAZ, hidden: faArrowDownZA}}
                                             initial={settings.filter.alphabetic}
                                             onChange={handleAlphabetic}
                            />
                        </SlTooltip>
                        {/*     <SlInput size="small" */}
                        {/*                                          onSlChange={handleFilterByName} */}
                        {/*                                          onInput={handleFilterByName} */}
                        {/*                                          className="edit-title-map-poi-input"> */}
                        {/*     <span slot="label">{'By Categories'}</span> */}
                        {/* </SlInput> */}
                    </div>
                    <SlDivider/>
                </>
            }
        </div>
    )
}