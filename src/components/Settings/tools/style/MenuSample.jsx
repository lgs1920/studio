import { LEFT }                       from '@Core/constants'
import { faCircleCheck }              from '@fortawesome/pro-duotone-svg-icons'
import { FontAwesomeIcon }            from '@fortawesome/react-fontawesome'
import { SlTooltip }                  from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useState } from 'react'
import { useSnapshot }                from 'valtio'

export const MenuSample = (props) => {

    const menu = useSnapshot(lgs.settings.ui.menu)
    const classes = ['lgs-card', props.align ?? '']

    /**
     * Check if it is the elected position.
     * We compare the position with the settings
     *
     * @return {boolean}
     */
    const checkSelection = () => {
        const positions = props.align.split('-')
        return lgs.settings.ui.menu.drawers.onLeft === (positions[0] === LEFT)
            && lgs.settings.ui.menu.toolBar.onLeft === (positions[1] === LEFT)
    }
    const [check, setCheck] = useState(checkSelection())

    useEffect(() => {
        setCheck(checkSelection())
    }, [menu])

    return (
        <SlTooltip placement="top" content={props.tooltip}>
            <div className="menu-sample" onClick={(event) => props.onSelect(event, props.align)}
            >
                <div className={classes.join(' ') + ' ' + (check ? 'selected' : '')}>
                    <div className={'sample-drawer lgs-card'}/>
                    <div className={'sample-toolbar'}>
                        <div className="lgs-card"></div>
                        <div className="lgs-card"></div>
                        <div className="lgs-card"></div>
                    </div>
                    {check &&
                        <div className={'sample-checkbox'}>
                            <FontAwesomeIcon icon={faCircleCheck}/>
                        </div>}
                </div>
            </div>
        </SlTooltip>
    )
}