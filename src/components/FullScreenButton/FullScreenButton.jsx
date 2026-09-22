/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FullScreenButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-03-07
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useProxyValue }               from '@Utils/ValtioUtils'
import { useEffect }                   from 'react'

export const FullScreenButton = (props) => {

    const mainStore = lgs.stores.main
    const fullSize = useProxyValue(mainStore, main => main.fullSize === true, false)

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
            <WaTooltip for="full-screen-button"
                       placement={props.tooltip}>{fullSize ? 'Exit Full screen' : 'Full Screen'}</WaTooltip>
            <WaButton id="full-screen-button"
                      onClick={toggleFullScreen}
                      className={'square-button'}
                      variant={'brand'}
                      appearance="Filled">
                      <WaIcon name={fullSize ? 'compress' : 'expand'} variant="regular"/>
            </WaButton>
        </>)
}
