import './style.css'
import { faRegularRouteCirclePlus }                             from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { FAButton }                                             from '@Components/FAButton'
import { faArrowRotateRight, faCrosshairsSimple, faSquarePlus } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip }                          from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                from '@Utils/FA2SL'
import classNames                                               from 'classnames'
import React                                                    from 'react'

export const JourneyLoaderButton = (props) => {


    const journeyLoaderStore=lgs.mainProxy.components.mainUI.journeyLoader

    const toggleVisibilityLoader = () => {
        journeyLoaderStore.visible = !journeyLoaderStore.visible
    }

    return (
        <>
            <SlTooltip hoist placement={props.tooltip} content="Add a Journey">
                {props.mini &&
                    <FAButton onClick={toggleVisibilityLoader} icon={faRegularRouteCirclePlus}
                              className={props.className}/>
                }
                {!props.mini &&
                    <SlButton size={'small'} className={classNames('square-button', props.className)}
                              onClick={toggleVisibilityLoader}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faRegularRouteCirclePlus)}/>
                </SlButton>
                }
            </SlTooltip>
        </>
    )

}

