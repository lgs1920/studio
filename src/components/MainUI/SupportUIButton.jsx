import { faMessageQuestion }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL } from '@Utils/FA2SL.js'


export const SupportUIButton = () => {
    const supportUIStore = lgs.mainProxy.components.mainUI.support
    return (
        <>
            <SlTooltip hoist placement="right" content="Open Help">
                <SlButton size={'small'} className={'square-button'} id={'launch-the-support'}
                          onClick={() => supportUIStore.visible = !supportUIStore.visible}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMessageQuestion)}/>
                </SlButton>
            </SlTooltip>
        </>
    )
}
