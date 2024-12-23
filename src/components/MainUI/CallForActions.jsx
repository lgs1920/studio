import { faRegularRouteCirclePlus } from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { faGlobePointer }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon }         from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                    from '@Utils/FA2SL'
import { useEffect, useRef }        from 'react'

export const CallForActions = (props) => {
    const cfa = useRef(null)
    const main = lgs.mainProxy

    const loadJourney = () => {
        hide()
        lgs.mainUIStore.journeyLoader.visible = true
    }
    const hide = () => {
        cfa.current.style.opacity = 0
    }

    useEffect(() => {
        // We check if we click outside. If it is the case,
        // We hide CFAs
        const handleClickOutside = (event) => {
            if (cfa.current && !cfa.current.contains(event.target)) {
                hide()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    return (
        <>
            {main.readyForTheShow && !main.theJourney &&
                <div className="call-for-actions" ref={cfa}>
                    <SlButton onClick={hide} href={__.app.buildUrl(lgs.configuration.website)} target="_blank" outline>
                        <SlIcon slot="prefix" library="fa"
                                name={FA2SL.set(faGlobePointer)}/>
                        {'Visit Our Site'}
                    </SlButton>


                    <SlButton variant="primary" onClick={loadJourney}>
                        <SlIcon slot="prefix" library="fa"
                                name={FA2SL.set(faRegularRouteCirclePlus)}/>
                        <span>Load your first Journey</span>

                    </SlButton>

                </div>
            }
        </>
    )
}