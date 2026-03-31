/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SelectElevationSource.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-28
 * Last modified: 2026-03-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faChevronDown }              from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlOption, SlSelect } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                              from '@Utils/FA2SL'
import { WaCard, WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'

/**
 *
 * @prop {string} label : Associated label
 * @prop {array} servers : which servers will be listed
 * @prop {string} default : which instance is selected by default
 * @prop {function} onChange : On change callback
 *
 * @return {JSX.Element}
 * @constructor
 */
export const SelectElevationSource = (props) => {
    const handleRequestClose = event => {
        event.preventDefault()
    }
    return (
        <WaSelect size="small"
                label={props.label}
                  hint={props.hint ?? ''}
                value={props.default}
                onChange={props.onChange}
                onSelect={handleRequestClose}
            >
                {props.servers.map(server => {
                    const isSelected = props.default === server.id

                    /**
                     * Resolve display values based on selection state
                     */
                    const icon = isSelected ? (server.iconSelection ?? server.icon) : server.icon
                    const label = isSelected ? (server.labelSelection ?? server.label) : server.label
                    return (
                        <WaOption key={server.id} value={server.id} selected={isSelected}>
                            <WaIcon
                                name={icon}
                                slot="start"
                                variant="regular"
                            />
                            {label}
                        </WaOption>
                    )
                })}
            </WaSelect>
    )

}