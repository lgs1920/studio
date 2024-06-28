import './style.css'
import { faFileCirclePlus, faLocationPlus, faXmark } from '@fortawesome/pro-regular-svg-icons'
import {
    faBan, faChevronRight, faFileCircleCheck, faFileCircleExclamation, faLocationSmile,
}                                                    from '@fortawesome/pro-solid-svg-icons'

import { SlButton, SlDialog, SlIcon, SlInput, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                          from '@Utils/FA2SL'
import { useState }                                       from 'react'
import { Scrollbars }                                     from 'react-custom-scrollbars'
import { useDropzone }                                    from 'react-dropzone'
import { useSnapshot }                                    from 'valtio'
import { ACCEPTED_TRACK_FILES }                           from '../../Utils/cesium/TrackUtils'


const allJourneyFiles = []


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

