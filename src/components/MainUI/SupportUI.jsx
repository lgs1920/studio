import { faLocationPlus, faMessageQuestion, faXmark } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon, SlTooltip }      from '@shoelace-style/shoelace/dist/react'
import { useState }                              from 'react'
import { default as ReactMarkdown }              from 'react-markdown'
import support                                   from '../../../public/assets/modals/support.md'
import { FA2SL }                                 from '../../Utils/FA2SL.js'


export const SupportUI = () => {
    const [open, setOpen] = useState(false)
    return (
        <>
            <SlDialog open={open}
                      modal
                      no-header
                      id={'support-modal'}
                      onSlAfterHide={() => setOpen(false)}>

                <ReactMarkdown children={support}/>

                <div slot="footer">
                    <div id={'footer'}>
                        <div className="buttons-bar">
                            <SlButton autofocus variant="primary"  onClick={() => setOpen(false)}>
                                <SlIcon slot="prefix" slot="prefix" library="fa" name={FA2SL.set(faXmark)}></SlIcon>{'Close'}
                            </SlButton>
                        </div>
                    </div>
                </div>

            </SlDialog>

            <SlTooltip hoist placement="right" content="Open Help">
                <SlButton size={'small'} className={'square-icon'} id={'launch-the-support'} onClick={() => setOpen(true)}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMessageQuestion)}/>
                </SlButton>
            </SlTooltip>
        </>
    )
}
