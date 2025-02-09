import { faMapLocationDot }            from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import { useSnapshot }                 from 'valtio'


export const GeocodingButton = (props) => {
    const store = lgs.mainProxy.components.geocoder
    const snap = useSnapshot(store)

    const handleClick = () => {
        store.dialog.visible = !store.dialog.visible

        __.ui.geocoder.init()
        store.list.clear()

        if (!store.dialog.visible) {
            document.getElementById('geocoder-search-location').value = ''
        }
        store.dialog.submitDisabled = true

    }
    return (
        <>
            <SlTooltip hoist placement={props.tooltip} content="Search location">
                <SlButton size={'small'} className={'square-icon'} id={'launch-the-geocoder'} onClick={handleClick}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMapLocationDot)}></SlIcon>
                </SlButton>
            </SlTooltip>
        </>
    )
}
