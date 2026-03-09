/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FullScreenButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-09
 * Last modified: 2026-03-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect }                   from 'react'
import { useSnapshot }                        from 'valtio'

export const FullScreenButton = (props) => {

    const mainStore = lgs.stores.main
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
            <WaTooltip for="full-screen-button"
                       placement={props.tooltip}>{mainSnap.fullSize ? 'Exit Full screen' : 'Full Screen'}</WaTooltip>
            <WaButton id="full-screen-button"
                      onClick={toggleFullScreen}
                      className={'square-button'}
                      variant={'brand'}
                      appearance="Filled">
                <WaIcon name={mainSnap.fullSize ? 'compress' : 'expand'} variant="regular"/>
            </WaButton>
        </>)
}