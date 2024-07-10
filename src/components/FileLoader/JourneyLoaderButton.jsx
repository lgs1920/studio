import './style.css'
import { faLocationPlus}  from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                          from '@Utils/FA2SL'

export const JourneyLoaderButton = (props) => {


    const journeyLoaderStore=lgs.mainProxy.components.mainUI.journeyLoader

    return (
        <>
            <SlTooltip hoist placement={props.tooltip} content="Add a new Journey">
                <SlButton size={'small'} className={'square-icon'} onClick={()=>journeyLoaderStore.visible =!journeyLoaderStore.visible}>
                    <SlIcon  slot="prefix" library="fa" name={FA2SL.set(faLocationPlus)}/>
                </SlButton>
            </SlTooltip>
        </>
    )

}

