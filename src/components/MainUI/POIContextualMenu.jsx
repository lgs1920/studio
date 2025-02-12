import { SlMenu, SlMenuItem, SlPopup } from '@shoelace-style/shoelace/dist/react'
import { useRef, useState }            from 'react'
import Timeout                         from 'smart-timeout'
import { useSnapshot }                 from 'valtio'

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
                    <div className="poi-on-map-menu lgs-card on-map"
                         onPointerLeave={() => Timeout.restart(lgs.mainProxy.components.pois.context.timer)}
                         onPointerEnter={() => Timeout.pause(lgs.mainProxy.components.pois.context.timer)}
                    >
                        <SlMenu>
                            <SlMenuItem value="undo">Undo</SlMenuItem>
                            <SlMenuItem value="redo">Redo</SlMenuItem>
                            <SlMenuItem value="cut">Cut</SlMenuItem>
                            <SlMenuItem value="copy">Copy</SlMenuItem>
                            <SlMenuItem value="paste">Paste</SlMenuItem>
                        </SlMenu>
                    </div>
                </SlPopup>
            }
        </>
    )
}