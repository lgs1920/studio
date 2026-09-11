/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Snapshot.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-05-08
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlButton, SlDropdown, SlMenu, SlMenuItem, SlTooltip }           from '@shoelace-style/shoelace/dist/react'
import { WaIcon }                                                        from '@web.awesome.me/webawesome-pro/dist/react'

export const SnapshotMenu = (props) => {
    return(
        <SlMenu>
            {props.snapshot?.png &&
                <SlMenuItem onClick={props.snapshot.png}>
                    <WaIcon slot="prefix" name="image" variant="regular"/>
                    {'Image'}
                </SlMenuItem>
            }

            {props.snapshot?.svg &&
                <SlMenuItem onClick={props.snapshot.svg}>
                    <WaIcon slot="prefix" name="vector-square" variant="regular"/>
                    {'Vector'}
                </SlMenuItem>
            }
        </SlMenu>
    )
}

export const SnapshotTrigger = (props=> {
    return (<SlTooltip hoist placement={props.tooltip} content="Snapshot">
        <SlButton size={'small'} className={'square-button snapshot'}>
            <WaIcon slot="prefix" name="camera-circle-arrow-down" variant="regular"/>
        </SlButton>
    </SlTooltip>)
})

export const SnapshotButton = props  => {

    const items = Object.keys(props.snapshot).length

    if (!props.snapshot || items === 0) {
        return ('')
    }

    return (
        <div className={['lgs-ui-toolbar', props.mode, props.icons ? 'just-icons' : ''].join(' ')}>
            <SlDropdown distance={-10}>
                <div slot="trigger">
                    <SnapshotTrigger {...props}/>
                </div>
                <SnapshotMenu {...props}/>
            </SlDropdown>
        </div>
    )
}
