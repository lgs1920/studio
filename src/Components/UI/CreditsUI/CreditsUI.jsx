import {faGithub}                                                       from '@fortawesome/free-brands-svg-icons'
import {faCircleInfo}                                                   from '@fortawesome/pro-regular-svg-icons'
import {SlButton, SlDrawer, SlIcon, SlIconButton, SlInclude, SlTooltip} from '@shoelace-style/shoelace/dist/react'
import {forwardRef, useState}                                           from 'react'
import {UIUtils as UI}                                                  from '../../../Utils/UIUtils'
import info                                                             from '../../../version.json'
import './style.css'

console.log(SlButton)
export const CreditsUI = forwardRef(function CreditsUI(props, ref) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <SlDrawer className="ui-element transparent" id="credits-pane" open={open}
                      onSlAfterHide={() => setOpen(false)}>
                <SlInclude src="/src/assets/pages/credits.html"/>
                #
                <sl-icon library="fa" name={UI.faIconName(faCircleInfo)}></sl-icon>
                #

                <div id="credits-pane-footer" slot={'footer'}>
                    <div>
                        <strong>{window.vt3d.configuration.applicationName}</strong><span>{info.version}</span>
                    </div>
                    <SlTooltip content="Our GitHub repo">
                        <SlIconButton src={UI.faIconName(faGithub)}
                                      target={'_blank'}
                                      href={'https://github.com/ViewTrack3D/vt3d'}
                                      slot={'prefix'}/>
                    </SlTooltip>
                </div>
            </SlDrawer>
            <SlButton size="small" id={'open-credits-pane'} onClick={() => setOpen(true)}>
                <SlIcon src={UI.faIconName(faCircleInfo)}></SlIcon>
            </SlButton>


        </>)
})
