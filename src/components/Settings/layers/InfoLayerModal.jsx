/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: InfoLayerModal.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-14
 * Last modified: 2026-03-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { faCheck }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { WaButton, WaDialog, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React                          from 'react'
import { default as ReactMarkdown }   from 'react-markdown'
import { useSnapshot }                from 'valtio'
import { FA2SL }         from '@Utils/FA2SL'
import { markdown as infoText } from './info-layer.md'

export const InfoLayerModal = () => {
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const closeInfoModal = () => editor.layer.infoDialog = false

    return (
        <WaDialog open={snap.layer.infoDialog}
                  onAfterHide={closeInfoModal}
                  className={'lgs-theme'}
                  id={'info-layer-modal'}>
            <span slot="label">
                <WaIcon name="bell-exclamation" variant={'regular'}/>{'Disclaimer'}
            </span>
            <LGSScrollbars>
                <div>
            <ReactMarkdown children={infoText}/>
                </div>
            </LGSScrollbars>
            <WaButton slot="footer" variant="brand" onClick={closeInfoModal}>
                <WaIcon name="check" variant={'regular'}/>{'Close'}
            </WaButton>
        </WaDialog>
    )


}