/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FilterEntities.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-14
 * Last modified: 2026-03-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ALL, LOCKED, UNLOCKED } from '@Core/constants'
import {
    WaButton, WaIcon, WaInput, WaOption, WaRadio, WaRadioGroup, WaSelect, WaTooltip,
}                                from '@web.awesome.me/webawesome-pro/dist/react'
import { useRef }                from 'react'
import { useSnapshot }           from 'valtio/index'

/**
 * FilterEntities component for managing layer filtering criteria.
 * Ensures consistent state between filter inputs and the active filter flag.
 */
export const FilterEntities = (props) => {
    const $editor = lgs.editorSettingsProxy
    const editor = useSnapshot($editor)

    const $layers = lgs.settings.layers
    const layers = useSnapshot($layers)
    const _byCountries = useRef(null)

    /**
     * Re-evaluates the active filter state based on current criteria.
     */
    const updateActiveState = () => {
        const isActive = $layers.filter.byUsage !== ALL ||
            $layers.filter.byName !== '' ||
            ($layers.filter.byCountries && $layers.filter.byCountries.length > 0)

        $layers.filter.active = isActive
    }

    const handleUsage = (event) => {
        $layers.filter.byUsage = event.target.value
        updateActiveState()
    }

    const handleName = (event) => {
        $layers.filter.byName = event.target.value
        updateActiveState()
    }

    const handleCountries = (event) => {
        $layers.filter.byCountries = event.target.value
        updateActiveState()
    }

    /**
     * Resets all filters to initial state.
     */
    const disableFilter = () => {
        $layers.filter.byUsage = ALL
        $layers.filter.byName = ''
        $layers.filter.byCountries = []
        $layers.filter.active = false
    }

    return (
        <>
            {editor.openFilter &&
                <wa-card id={'filter-entities'} key={'filter-entities'} className={'lgs-slide-down'}>
                    <WaTooltip for={'lgs--layers-filter-by-usage'}>{'By Layer Usage'}</WaTooltip>
                    <WaRadioGroup name={'a'} orientation={'horizontal'} label-at-start
                                  id={'lgs--layers-filter-by-usage'}
                                  onChange={handleUsage}
                                  value={layers.filter.byUsage} size={'small'}>
                        <span slot={'label'}>{'By Usage'}</span>
                        <WaRadio value={ALL} appearance={'button'}>{'All'}</WaRadio>
                        <WaRadio value={UNLOCKED} appearance={'button'}>{'Unlocked'}</WaRadio>
                        <WaRadio value={LOCKED} appearance={'button'}>{'Locked'}</WaRadio>
                    </WaRadioGroup>

                    <WaTooltip for={'lgs--layers-filter-by-countries'}>{'By Countries'}</WaTooltip>
                    <WaSelect multiple with-clear ref={_byCountries}
                              onChange={handleCountries} size={'small'}
                              id={'lgs--layers-filter-by-countries'}
                              value={layers.filter.byCountries ?? []}
                              key={'filter-by-countries'}
                              placeholder={'By countries'}
                    >
                        {__.layersAndTerrainManager.countries.map((country) => {
                            const info = __.countries.get(country)
                            if (info) {
                                return (
                                    <WaOption key={info.code} value={info.code}>
                                        <img src={__.ui.ui.countryFlag(info.code)} alt={info.name}
                                             slot={'start'} className={'country-flag'}/>
                                        {info.name}
                                    </WaOption>
                                )
                            }
                            return null
                        })}
                    </WaSelect>

                    <div>
                        <WaTooltip for={'lgs--layers-filter-by-name'}>{'By Layer Name'}</WaTooltip>
                        <WaInput placeholder={'By name'}
                                 id={'lgs--layers-filter-by-name'}
                                 onInput={handleName} size={'small'}
                                 value={layers.filter.byName}
                                 key={'filter-by-name'}
                        />

                        <WaTooltip for={'lgs--layers-filter-content-reset'}>{'Reset Filters'}</WaTooltip>
                        <WaButton size={'small'}
                                  id={'lgs--layers-filter-content-reset'}
                                  appearance={'plain'} variant={'brand'}
                                  disabled={!layers.filter.active}
                                  onClick={disableFilter}>
                            <WaIcon name={'filter-circle-xmark'} size={'small'} variant={'regular'}/>
                            {'Reset Filters'}
                        </WaButton>
                    </div>
                </wa-card>
            }
        </>
    )
}