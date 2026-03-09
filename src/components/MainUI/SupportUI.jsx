/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SupportUI.jsx
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

import { faXmark }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { WaButton, WaDialog, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { default as ReactMarkdown }   from 'react-markdown'
import { useSnapshot }                from 'valtio'
import { markdown as support } from '../../../src/assets/modals/support.md'
import { FA2SL } from '@Utils/FA2SL'


export const SupportUI = () => {
    const setSupport = lgs.stores.ui.mainUI.support
    const getSupport = useSnapshot(setSupport)
    return (
        <>
            <WaDialog open={getSupport.visible}
                      id={'support-modal'}
                      onSlAfterHide={() => setSupport.visible = false}
            >
                <div slot="label">{'Need some support ?'}</div>
                <ReactMarkdown children={support}/>

                <div slot="footer">
                        <div className="buttons-bar">
                            <WaButton variant="brand" autofocus onClick={() => setSupport.visible = false}>
                                <WaIcon name="xmark" variant="regular"></WaIcon>{'Close'}</WaButton>
                        </div>
                </div>

            </WaDialog>
        </>
    )
}
