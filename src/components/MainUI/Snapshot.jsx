import { faRegularCameraCircleArrowDown } from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { faImage, faVectorSquare }                                     from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDropdown, SlIcon, SlMenu, SlMenuItem, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                       from '@Utils/FA2SL'
import { useSnapshot }                                                 from 'valtio'

export const SnapshotMenu = (props) => {
    return(
        <SlMenu>
            {props.snapshot?.png &&
                <SlMenuItem onClick={props.snapshot.png}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faImage)}></SlIcon>
                    {'Image'}
                </SlMenuItem>
            }

            {props.snapshot?.svg &&
                <SlMenuItem onClick={props.snapshot.svg}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faVectorSquare)}></SlIcon>
                    {'Vector'}
                </SlMenuItem>
            }
        </SlMenu>
    )
}

export const SnapshotTrigger = (props=> {
    return (<SlTooltip hoist placement={props.tooltip} content="Snapshot">
        <SlButton size={'small'} className={'square-button snapshot'}>
            <SlIcon slot="prefix" library="fa"
                    name={FA2SL.set(faRegularCameraCircleArrowDown)}>
            </SlIcon>
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
