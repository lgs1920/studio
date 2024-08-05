import { faArrowsMaximize, faArrowsMinimize } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip }        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                              from '@Utils/FA2SL'
import { useEffect }                         from 'react'
import { useSnapshot }                        from 'valtio'

//read version


export const FullScreenButton = () => {

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)

        const toggleFullSize = () => {
            mainStore.fullSize = document.fullscreenElement !== null
        }

        const toggleFullScreen = () => {
            toggleFullSize()
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen()
            }
            if (mainStore.fullSize && document.exitFullscreen) {
                document.exitFullscreen()
            }
        }

        const handleFullscreenchange = (event) => {
            if (event.type === 'fullscreenchange') {
                toggleFullSize()
            }
        }

        useEffect(() => {
            document.documentElement.addEventListener('fullscreenchange', handleFullscreenchange);
            return () => {
                document.removeEventListener('fullscreenchange', handleFullscreenchange)
            }
        }, [])

        return (<>
            <SlTooltip hoist placement="right" content={mainSnap.fullSize ? 'Exit Full screen' : 'Full Screen'}>
                <SlButton size="small" onClick={toggleFullScreen} className={'square-icon'}>
                    {!mainSnap.fullSize &&
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsMaximize)}></SlIcon>}
                    {mainSnap.fullSize &&
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsMinimize)}></SlIcon>}
                </SlButton>
            </SlTooltip>

        </>)
}