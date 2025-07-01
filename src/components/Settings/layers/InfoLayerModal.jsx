/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: InfoLayerModal.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-01
 * Last modified: 2025-07-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { faCheck }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import React                          from 'react'
import { default as ReactMarkdown }   from 'react-markdown'
import { useSnapshot }                from 'valtio'
import { FA2SL }         from '@Utils/FA2SL'
import infoText                       from './info-layer.md'

export const InfoLayerModal = () => {
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const closeInfoModal = () => editor.layer.infoDialog = false

    return (
        <SlDialog label={'Important Notice'}
                  open={snap.layer.infoDialog}
                  onSlRequestClose={closeInfoModal}
                  className={'lgs-theme'}
                  id={'info-layer-modal'}>
            <LGSScrollbars>
                <div>
            <ReactMarkdown children={infoText}/>
                </div>
            </LGSScrollbars>
            <SlButton slot="footer" variant="primary" onClick={closeInfoModal}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCheck)}/>
                Close
            </SlButton>
        </SlDialog>
    )


}