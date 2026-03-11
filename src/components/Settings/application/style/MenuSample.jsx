/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MenuSample.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { BOTTOM, START }              from '@Core/constants'
import { faCircleCheck }              from '@fortawesome/duotone-light-svg-icons'
import { FontAwesomeIcon }            from '@fortawesome/react-fontawesome'
import { SlTooltip }                  from '@shoelace-style/shoelace/dist/react'
import { WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useEffect, useState } from 'react'
import { useSnapshot }                from 'valtio'

export const MenuSample = (props) => {

    const menu = useSnapshot(lgs.settings.ui.menu)
    const classes = ['lgs-card', props.align ?? '']
    const isMobile = props.device === 'mobile'

    /**
     * Check if it is the elected position.
     * We compare the position with the settings
     *
     * @return {boolean}
     */
    const checkSelection = () => {
        const positions = props.align.split('-')
        if (isMobile) {
            return lgs.settings.ui.menu.drawers.fromBottom === (positions[0] === BOTTOM)
                && lgs.settings.ui.menu.toolBar.fromStart === (positions[1] === START)
        }
        return lgs.settings.ui.menu.drawers.fromStart === (positions[0] === START)
            && lgs.settings.ui.menu.toolBar.fromStart === (positions[1] === START)
    }
    const [check, setCheck] = useState(checkSelection())

    useEffect(() => {
        setCheck(checkSelection())
    }, [menu])

    return (
        <div className="lgs--main-menu-sample"
                 onClick={(event) => props.onSelect(event, props.align)}
            >
                <div className={classes.join(' ') + ' ' + (check ? 'selected' : '')}>
                    <div className="lgs--main-menu-sample-drawer lgs-card"/>
                    <div className="lgs--main-menu-sample-toolbar">
                        <div className="lgs-card"></div>
                        <div className="lgs-card"></div>
                        <div className="lgs-card"></div>
                    </div>
                    {check && <WaIcon className="lgs--max-menu-sample-checkbox" name="circle-check" variant="solid"/>}
                </div>
            </div>
    )
}