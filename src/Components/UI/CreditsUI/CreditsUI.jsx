import {faCircleInfo}                  from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlDrawer, SlInclude} from '@shoelace-style/shoelace/dist/react'
import {forwardRef, useState}          from 'react'
import {UIUtils as UI}                 from '../../../Utils/UIUtils'
import './style.css'


export const CreditsUI = forwardRef(function CreditsUI(props, ref) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <SlDrawer className="ui-element transparent" id="credits-pane" open={open}
                      onSlAfterHide={() => setOpen(false)}>
                <SlInclude src="/src/assets/pages/credits.html"/>
                <div id="credits-pane-footer" slot={'footer'}>

                </div>
            </SlDrawer>
            <SlButton size="small" id={'open-credits-pane'} onClick={() => setOpen(true)}>
                <sl-icon src={UI.useFAIcon(faCircleInfo)}></sl-icon>
            </SlButton>

        </>)
})
