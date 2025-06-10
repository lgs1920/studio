/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditFilter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-10
 * Last modified: 2025-06-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { MapPOICategorySelectorFilter }                                    from '@Components/MainUI/MapPOI/MapPOICategorySelectorFilter'
import { ToggleStateIcon }                                                 from '@Components/ToggleStateIcon'
import { JOURNEY_EDITOR_DRAWER }                                           from '@Core/constants'
import { faArrowDownAZ, faArrowDownZA, faEraser, faFilter, faFilterSlash } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDivider, SlIconButton, SlInput, SlSwitch, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                           from '@Utils/FA2SL'
import React, { useEffect }                                                from 'react'
import { useSnapshot }                                                     from 'valtio/index'

export const MapPOIEditFilter = () => {

    const settings = useSnapshot(lgs.settings.poi)
    const store = lgs.mainProxy.components.pois
    const pois = useSnapshot(store)

    const drawers = useSnapshot(lgs.mainProxy.drawers)
    const onlyJourney = drawers.open === JOURNEY_EDITOR_DRAWER

    const handleFilter = () => {
        lgs.settings.poi.filter.open = !lgs.settings.poi.filter.open
    }

    const handleFilterByName = (event) => {
        lgs.settings.poi.filter.byName = event.target.value
    }

    const handleAlphabetic = (event) => {
        lgs.settings.poi.filter.alphabetic = !lgs.settings.poi.filter.alphabetic
    }

    const enoughPOIs = () => {
        return Array.from(pois.list.values()).reduce((count, obj) => count + (obj.type !== undefined), 0) >= 1
    }
    const handleCategories = async (event) => {
        if (event.target.nodeName !== 'SL-SWITCH') {
            lgs.settings.poi.filter.byCategories = event.target.value ?? []
        }
    }

    const handleExclusion = () => {
        lgs.settings.poi.filter.exclude = !lgs.settings.poi.filter.exclude
    }

    const handleGlobal = () => {
        lgs.settings.poi.filter.global = !lgs.settings.poi.filter.global
        setTimeout(() => {
            if (!lgs.settings.poi.filter.global && !lgs.settings.poi.filter.journey) {
                lgs.settings.poi.filter.global = true
            }
        }, 0)
    }

    const handleJourney = () => {
        lgs.settings.poi.filter.journey = !lgs.settings.poi.filter.journey
        setTimeout(() => {
            if (!lgs.settings.poi.filter.global && !lgs.settings.poi.filter.journey) {
                lgs.settings.poi.filter.global = true
            }
        }, 0)
    }

    const applyFilter = () => {
        if (!enoughPOIs()) {
            lgs.settings.poi.filter.active = false
            lgs.settings.poi.filter.open = false
            return
        }
        lgs.settings.poi.filter.active = lgs.settings.poi.filter.byName !== ''
            || !lgs.settings.poi.filter.alphabetic
            || lgs.settings.poi.filter.byCategories.length > 0

        if (!onlyJourney) {
            lgs.settings.poi.filter.active = lgs.settings.poi.filter.active || !lgs.settings.poi.filter.global || lgs.settings.poi.filter.journey
        }
    }

    const resetFilter = () => {
        lgs.settings.poi.filter.byName = ''
        lgs.settings.poi.filter.alphabetic = true
        lgs.settings.poi.filter.byCategories = []
        if (!onlyJourney) {
            lgs.settings.poi.filter.global = true
            lgs.settings.poi.filter.journey = false
        }
    }

    useEffect(() => {
        applyFilter()
    }, [settings.filter, pois.list.size])


    return (
        <div className="map-poi-edit-filter">
            <div className="map-poi-edit-toggle-filter">
                <header>
                    {settings.filter.active && <span>{'Filters are active'}</span>}
                    <SlTooltip content={settings.filter.open ? 'Hide Filters' : 'Show Filters'}>
                        <div id="map-poi-edit-filter-trigger" onClick={handleFilter}
                             className={settings.filter.active ? 'map-poi-filter-active' : 'map-poi-filter-inactive'}>
                            {settings.filter.open ? 'Hide' : 'Show'}&nbsp;{'Filters'}
                            <SlIconButton
                                library="fa" disabled={!enoughPOIs()}
                                name={FA2SL.set(settings.filter.open ? faFilterSlash : faFilter)}
                                className={settings.filter.active ? 'map-poi-filter-active' : 'map-poi-filter-inactive'}
                            />
                        </div>

                    </SlTooltip>
                </header>

                <SlDivider/>
            </div>

            {settings.filter.open &&
                <div className="map-poi-edit-toggle-filter lgs-card">
                    <div className="map-poi-filter-by-name">
                        <SlInput label={'By Name'} type="text" size="small" value={settings.filter.byName}
                                 onSlChange={handleFilterByName}
                                 onInput={handleFilterByName}
                                 className="edit-map-poi-input">
                        </SlInput>
                        <SlTooltip hoist content={settings.filter.alphabetic ? 'Reverse Alphabetic' : 'Alphabetic'}>
                            <ToggleStateIcon id="map-poi-filter-alphabetic"
                                             icons={{shown: faArrowDownAZ, hidden: faArrowDownZA}}
                                             initial={settings.filter.alphabetic}
                                             onChange={handleAlphabetic}
                            />
                        </SlTooltip>

                        {settings.filter.active &&
                            <SlButton size="small" className="map-poi-clear-filter" onClick={resetFilter}>
                                <SlIconButton size="small" library="fa" name={FA2SL.set(faEraser)}/>{'Reset Filters'}
                            </SlButton>
                        }
                    </div>
                    <MapPOICategorySelectorFilter handleExclusion={handleExclusion}
                                                  handleCategories={handleCategories}
                                                  onChange={applyFilter}
                    />
                    <SlDivider/>

                    <div className="map-poi-filter-by-type">
                        {!onlyJourney &&
                            <>
                                <SlSwitch size="small" align-right checked={settings.filter.global}
                                          onSlChange={handleGlobal}>
                                    {'Display Global POIs'}
                                </SlSwitch>

                                {lgs.theJourney &&
                                    <SlSwitch size="small" align-right checked={settings.filter.journey}
                                              onSlChange={handleJourney}>
                                        {'Display Journey POIs'}
                                    </SlSwitch>
                                }
                            </>
                        }
                    </div>

                </div>
            }
        </div>
    )
}