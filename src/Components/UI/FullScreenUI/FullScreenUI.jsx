import { faArrowsMaximize, faArrowsMinimize } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip }        from '@shoelace-style/shoelace/dist/react'
import { forwardRef }                         from 'react'
import { useSnapshot }                        from 'valtio'
import { FA2SL }                              from '../../../Utils/FA2SL'

//read version


export const FullScreenUI = forwardRef(function FullScreenUI() {

    const mainStore = vt3d.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const toggleFullSize = () => {
        mainStore.fullSize = !mainStore.fullSize
        if (mainStore.fullSize) {
            document.documentElement.requestFullscreen()
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            }
        }
    }

    return (<>
        <SlTooltip placement={'right'} content={mainSnap.fullSize ? 'Exit Full screen' : 'Full Screen'}>
            <SlButton size="small" onClick={toggleFullSize} className={'square-icon'}>
                {!mainSnap.fullSize && <SlIcon library="fa" name={FA2SL.set(faArrowsMaximize)}></SlIcon>}
                {mainSnap.fullSize && <SlIcon library="fa" name={FA2SL.set(faArrowsMinimize)}></SlIcon>}
            </SlButton>
        </SlTooltip>

    </>)
})
