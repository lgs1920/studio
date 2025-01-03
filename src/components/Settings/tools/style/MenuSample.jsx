import { LEFT }                       from '@Core/constants'
import { faCircleCheck }              from '@fortawesome/pro-duotone-svg-icons'
import { FontAwesomeIcon }            from '@fortawesome/react-fontawesome'
import { SlTooltip }                  from '@shoelace-style/shoelace/dist/react'
import React, { useEffect, useState } from 'react'
import { useSnapshot }                from 'valtio'

export const MenuSample = (props) => {

    const menu = useSnapshot(lgs.settings.ui.menu)
    const [check, setCheck] = useState(false)
    const classes = ['lgs-card', props.align ?? '']

    const checkSelection = () => {
        const positions = props.align.split('-')
        setCheck(lgs.settings.ui.menu.drawers.onLeft === (positions[0] === LEFT)
                     && lgs.settings.ui.menu.toolBar.onLeft === (positions[1] === LEFT))
    }

    useEffect(() => {
        checkSelection()
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