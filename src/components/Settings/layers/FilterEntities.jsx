/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FilterEntities.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-07
 * Last modified: 2025-07-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { ALL, LOCKED, UNLOCKED, WORLD } from '@Core/constants'
import { faFilterCircleXmark }          from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlIcon,
    SlIconButton, SlInput, SlOption, SlRadioButton, SlRadioGroup, SlSelect, SlTooltip,
}                                       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                         from '@Utils/FA2SL'
import { useRef, useEffect }            from 'react'
import { useSnapshot }                                                   from 'valtio/index'

export const FilterEntities = (props) => {

    const $editor = lgs.editorSettingsProxy
    const editor = useSnapshot($editor)

    const $layers = lgs.settings.layers
    const layers = useSnapshot($layers)
    const _byCountries = useRef(null)

    const handleUsage = (event) => {
        $layers.filter.byUsage = event.target.value
        $layers.filter.active = true
    }

    const handleName = (event) => {
        $layers.filter.byName = event.target.value

        if ($layers.filter.byUsage === ALL && $layers.filter.byName === '') {
            disableFilter(false)
        }
        else {
            $layers.filter.active = true
        }
    }

    const handleCountries = (event) => {
        $layers.filter.byCountries = event.target.value
    }

    const disableFilter = (closeFilter = true) => {
        $layers.filter.byUsage = ALL
        $layers.filter.byName = ''
        $layers.filter.active = false
        $layers.filter.byCountries = []
        $editor.openFilter = !closeFilter
    }
    useEffect(() => {
        const select = _byCountries.current
        if (!select) {
            return
        }

        // Surcharge de la méthode getTag (si disponible)
        select.getTag = (option, index) => {
            // Récupérer l'élément du slot prefix
            const prefixElement = option.querySelector('[slot="prefix"]')

            // Retourner un HTMLElement (sl-tag)
            const tag = document.createElement('sl-tag')
            tag.setAttribute('removable', '')
            tag.setAttribute('size', select.size || 'medium')

            // Ajouter le contenu du prefix cloné (si présent)
            if (prefixElement) {
                tag.appendChild(prefixElement.cloneNode(true))
            }

            // Ajouter le texte de l'option
            const text = document.createTextNode(option.getTextLabel())
            tag.appendChild(text)

            return tag
        }

        // Forcer un rafraîchissement pour appliquer les nouveaux tags
        select.requestUpdate()

        return () => {
            // Nettoyage si nécessaire
            delete select.getTag
        }
    }, [$layers.filter.byCountries])

    return (
        <>
            {
                editor.openFilter &&
                <div id="filter-entities" key={'filter-entities'} className="lgs-slide-down lgs-card">
                    <div>
                    <SlTooltip content={'By Layer Usage'}>
                        <SlRadioGroup name="a"
                                      onSlChange={handleUsage}
                                      value={layers.filter.byUsage} size="small">
                            <SlRadioButton value={ALL} size="small">{'All'}</SlRadioButton>
                            <SlRadioButton value={UNLOCKED} size="small">{'Unlocked'}</SlRadioButton>
                            <SlRadioButton value={LOCKED} size="small">{'Locked'}</SlRadioButton>
                        </SlRadioGroup>
                    </SlTooltip>
                    </div>

                    <SlTooltip content={'By Countries'}>
                        <SlSelect id={'filter-by-countries'} hoist multiple ref={_byCountries}
                                  onSlChange={handleCountries} size="small"
                                  value={layers.filter.byCountries ?? []}
                                  key={'filter-by-countries'}
                                  placeholder={'By countries'}
                        >
                            {__.layersAndTerrainManager.countries.map((country) => {
                                const info = __.countries.get(country)
                                if (info) {
                                    return <SlOption key={info.code} value={info.code}>
                                        <img src={__.ui.ui.countryFlag(info.code)} alt={info.name}
                                             slot="prefix" className="country-flag"/>
                                        {info.name}
                                    </SlOption>
                                }
                            })
                            }
                        </SlSelect>
                    </SlTooltip>
                    <div>
                    <SlTooltip content={'By Layer Name'}>
                        <SlInput placeholder={'By name'} id={'filter-by-name'}
                                 onSlInput={handleName} size="small"
                                 value={layers.filter.byName}
                                 key={'filter-by-name'}
                        />
                    </SlTooltip>
                        <SlTooltip content={'Reset Filters'}>
                            <SlButton size="small" onClick={disableFilter}>
                                <SlIcon library="fa" slot="prefix" size={'small'}
                                        name={FA2SL.set(faFilterCircleXmark)}
                                        disabled={layers.filter.byUsage === ALL && layers.filter.byName === ''}/>
                                {'Reset Filters'}
                            </SlButton>
                        </SlTooltip>
                    </div>

                </div>
            }
        </>
    )
}
