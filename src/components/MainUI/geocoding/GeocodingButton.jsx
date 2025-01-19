import { faMagnifyingGlassLocation }   from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import { useSnapshot }                 from 'valtio'


export const GeocodingButton = (props) => {
    const store = lgs.mainProxy.components.geocoder
    const snap = useSnapshot(store)
    return (
        <>
            <SlTooltip hoist placement={props.tooltip} content="Search location">
                <SlButton size={'small'} className={'square-icon'} id={'launch-the-geocoder'}
                          onClick={() => store.dialog.visible = !store.dialog.visible}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMagnifyingGlassLocation)}/>
                </SlButton>
            </SlTooltip>
            {/* <SlPopup active={snap.dialog.visible} */}
            {/*          id={'geocoder-dialog'} */}
            {/*          className={'lgs-theme'} */}
            {/*          anchor="launch-the-geocoder" */}
            {/*          placement={"right"} */}
            {/* > */}

            {/*     <div> */}
            {/*         <div className="buttons-bar"> */}
            {/*             <SlButton autofocus variant="primary" onClick={() => store.dialog.visible = false}> */}
            {/*                 <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}></SlIcon>{'Close'} */}
            {/*             </SlButton> */}
            {/*         </div> */}
            {/*     </div> */}

            {/* </SlPopup> */}
        </>
    )
}
