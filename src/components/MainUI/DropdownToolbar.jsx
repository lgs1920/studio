import { ProfileButton }                                               from '@Components/Profile/ProfileButton'
import { faEllipsisVertical }                                          from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDropdown, SlIcon, SlMenu, SlMenuItem, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL } from '@Utils/FA2SL.js'
import { JourneyLoaderButton }                           from '../FileLoader/JourneyLoaderButton'
import { SnapshotButton, SnapshotMenu, SnapshotTrigger } from './Snapshot'

export const DropdownToolbar = (props) => {

    return (
        <div
            className={['lgs-ui-toolbar', 'lgs-ui-dropdown-toolbar', props.mode, props.icons ? 'just-icons' : ''].join(' ')}>
            <SlDropdown  distance={-10}>
                <div slot="trigger">
                    <SlTooltip hoist placement={props.tooltip} content="Toolbar">
                        <SlButton size={'small'} className={'square-button'}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faEllipsisVertical)}></SlIcon>
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

