/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SupportUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faXmark }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { default as ReactMarkdown }   from 'react-markdown'
import { useSnapshot }                from 'valtio'
import support                        from '../../../src/assets/modals/support.md'
import { FA2SL } from '@Utils/FA2SL'


export const SupportUI = () => {
    const setSupport = lgs.stores.ui.mainUI.support
    const getSupport = useSnapshot(setSupport)
    return (
        <>
            <SlDialog open={getSupport.visible}
                      no-header
                      id={'support-modal'}
                      className={'lgs-theme'}
                      onSlAfterHide={() => setSupport.visible = false}
            >
                <ReactMarkdown children={support}/>

                <div slot="footer">
                    <div id={'footer'}>
                        <div className="buttons-bar">
                            <SlButton autofocus variant="primary" onClick={() => setSupport.visible = false}>
                                <SlIcon slot="prefix"library="fa" name={FA2SL.set(faXmark)}></SlIcon>{'Close'}
                            </SlButton>
                        </div>
                    </div>
                </div>

            </SlDialog>
        </>
    )
}
