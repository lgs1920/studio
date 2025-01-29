import { faArrowRotateLeft }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import React                           from 'react'
import { useSnapshot }                 from 'valtio'


export const RotateButton = (props) => {
    const proxy = lgs.mainProxy.components.mainUI
    const rotate = useSnapshot(proxy).rotate

    const handleRotation = () => {
        proxy.rotate.running = proxy.rotate.running ? __.ui.sceneManager.stopRotate
                                                    : __.ui.sceneManager.startRotate
    }

    return (
        <>
            <SlTooltip hoist placement={props.tooltip}
                       content={rotate.running ? 'Stop Map Rotation' : 'Start Map Rotation'}>
                <SlButton size={'small'} className={'square-icon'} id={'launch-rotation'}
                          onClick={handleRotation} loading={rotate.running}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowRotateLeft)}/>

                </SlButton>
            </SlTooltip>
        </>
    )
}
