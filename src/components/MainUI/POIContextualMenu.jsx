import {
    faArrowsFromLine, faArrowsToLine, faCopy, faLocationDot, faLocationDotSlash,
}                                  from '@fortawesome/pro-regular-svg-icons'
import { faMask, faPen }           from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlPopup }         from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                   from '@Utils/FA2SL'
import React, { useRef, useState } from 'react'
import Timeout                     from 'smart-timeout'
import { useSnapshot }             from 'valtio'

export const POIContextualMenu = ({point}) => {

    const anchor = useRef(null)
    const snap = useSnapshot(lgs.mainProxy.components.pois)
    const [timeoutId, setTimeoutId] = useState(null)

    const hideMenu = () => {
        Timeout.resume(lgs.mainProxy.components.pois.context.timer)
        lgs.mainProxy.components.pois.context.visible = false
        lgs.mainProxy.components.pois.current = false
    }


    return (
        <>
            {snap.current &&
                <SlPopup placement="right-start"
                         hover-bridge flip
                         ref={anchor}
                         anchor={snap.current.id}
                         active={snap.context.visible}
                >
                    <div className="lgs-context-menu poi-on-map-menu lgs-card on-map"
                         onPointerLeave={() => Timeout.restart(lgs.mainProxy.components.pois.context.timer)}
                         onPointerEnter={() => Timeout.pause(lgs.mainProxy.components.pois.context.timer)}
                    >
                        <ul>
                            <li>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationDot)}></SlIcon>
                                <span>Save as POI</span>
                            </li>
                            <li>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationDotSlash)}></SlIcon>
                                <span>Remove</span>
                            </li>
                            <li>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPen)}></SlIcon>
                                <span>Edit</span>
                            </li>
                            <li>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsToLine)}></SlIcon>
                                <span>Shrink</span>
                            </li>
                            <li>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsFromLine)}></SlIcon>
                                <span>Expand</span>
                            </li>
                            <li>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMask)}></SlIcon>
                                <span>Hide</span>
                            </li>
                            <li>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCopy)}></SlIcon>
                                <span>Copy Coords</span>
                            </li>
                        </ul>
                    </div>
                </SlPopup>
            }
        </>
    )
}