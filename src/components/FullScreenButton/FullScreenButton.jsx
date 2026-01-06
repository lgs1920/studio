/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FullScreenButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faExpand, faCompress } from '@fortawesome/pro-regular-svg-icons'
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
                <SlButton size="small" onClick={toggleFullScreen} className={'square-button'}>
                    {!mainSnap.fullSize &&
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faExpand)}></SlIcon>}
                    {mainSnap.fullSize &&
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCompress)}></SlIcon>}
                </SlButton>
            </SlTooltip>

        </>)
}