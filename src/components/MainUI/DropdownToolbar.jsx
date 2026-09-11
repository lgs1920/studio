/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DropdownToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-06-07
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ProfileButton }                                               from '@Components/Profile/ProfileButton'
import { SlButton, SlDropdown, SlMenu, SlMenuItem, SlTooltip }           from '@shoelace-style/shoelace/dist/react'
import { WaIcon }                                                        from '@web.awesome.me/webawesome-pro/dist/react'
import { JourneyLoaderButton }                           from '../FileLoader/JourneyLoaderButton'
import { SnapshotMenu, SnapshotTrigger } from './Snapshot'

export const DropdownToolbar = (props) => {

    return (
        <div
            className={['lgs-ui-toolbar', 'lgs-ui-dropdown-toolbar', props.mode, props.icons ? 'just-icons' : ''].join(' ')}>
            <SlDropdown  distance={-10}>
                <div slot="trigger">
                    <SlTooltip hoist placement={props.tooltip} content="Toolbar">
                        <SlButton size={'small'} className={'square-button'}>
                            <WaIcon slot="prefix" name="ellipsis-vertical" variant="regular"/>
                        </SlButton>
                    </SlTooltip>
                </div>
                <SlMenu>
                    {props.fileLoader &&
                        <SlMenuItem><JourneyLoaderButton tooltip={props.tooltip}/></SlMenuItem>
                    }

                    {props.profile &&
                        <SlMenuItem><ProfileButton tooltip={props.tooltip}/></SlMenuItem>
                    }
                    {props.center &&
                        <>
                            {props.center}
                        </>
                    }
                    {props.snapshot &&
                        <SlMenuItem>
                            <SnapshotTrigger tooltip={'top-start'}/>
                            <SlMenu slot="submenu">
                                <SnapshotMenu {...props}/>
                            </SlMenu>
                        </SlMenuItem>
                    }
                </SlMenu>
            </SlDropdown>
        </div>
    )
}
