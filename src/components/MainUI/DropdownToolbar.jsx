import { JourneyLoader }                                               from '@Components/FileLoader/JourneyLoader'
import { ProfileButton }                                               from '@Components/Profile/ProfileButton'
import {
    TracksEditorButton,
}                                                                      from '@Components/TracksEditor/TracksEditorButton'
import { faEllipsisVertical }                                          from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDropdown, SlIcon, SlMenu, SlMenuItem, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                       from '../../Utils/FA2SL.js'
import { SnapshotButton }                                              from './Snapshot'

export const DropdownToolbar = (props) => {
    return (
        <div
            className={['lgs-ui-toolbar', 'lgs-ui-dropdown-toolbar', props.mode, props.icons ? 'just-icons' : ''].join(' ')}>
            <SlDropdown>
                <div slot="trigger">
                    <SlTooltip hoist placement={props.tooltip} content="Edit Tracks">
                        <SlButton size={'small'} className={'square-icon'}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faEllipsisVertical)}></SlIcon>
                        </SlButton>
                    </SlTooltip>
                </div>
                <SlMenu>
                    {props.editor &&
                        <SlMenuItem><TracksEditorButton tooltip={props.tooltip}/></SlMenuItem>
                    }

                    {props.fileLoader &&
                        <SlMenuItem><JourneyLoader tooltip={props.tooltip}/></SlMenuItem>
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
                        <SlMenuItem><SnapshotButton tooltip={props.tooltip} snapshot={props.snapshot}/></SlMenuItem>
                    }
                </SlMenu>
            </SlDropdown>
        </div>
    )
}

