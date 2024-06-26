import { faXmark }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { default as ReactMarkdown }   from 'react-markdown'
import { useSnapshot }                from 'valtio'
import support                        from '../../../public/assets/modals/support.md'
import { FA2SL }                      from '../../Utils/FA2SL'


export const SupportUI = () => {
    const setSupport = lgs.mainProxy.components.mainUI.support
    const getSupport = useSnapshot(setSupport)
    return (
        <>
            <SlDialog open={getSupport.visible}
                      modal
                      no-header
                      id={'support-modal'}
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
