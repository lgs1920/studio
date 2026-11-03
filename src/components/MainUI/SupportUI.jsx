/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SupportUI.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-06-04
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaDialog, WaIcon } from '@awesome.me/webawesome/dist/react'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import { default as ReactMarkdown }   from 'react-markdown'
import { useSnapshot }                from 'valtio'
import { markdown as support } from '../../../src/assets/modals/support.md'


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
                                <WaIcon slot="start" {...UI_ACTIONS.close.icon}/>{UI_ACTIONS.close.label}</WaButton>
                        </div>
                </div>

            </WaDialog>
        </>
    )
}
