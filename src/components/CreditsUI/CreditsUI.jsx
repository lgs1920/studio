//read version
import { faGithub }                                                       from '@fortawesome/free-brands-svg-icons'
import { faCircleInfo }                                                   from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDrawer, SlIcon, SlIconButton, SlInclude, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                          from '@Utils/FA2SL'
import { forwardRef }                                                     from 'react'
import { useSnapshot }                                                    from 'valtio'

import info from '../../version.json'
import './style.css'


export const CreditsUI = forwardRef(function CreditsUI() {

    const mainStore = vt3d.mainProxy.components
    const mainSnap = useSnapshot(mainStore)

    const setOpen = (open) => {
        mainStore.credits.show = open
    }

    return (<>
        <SlDrawer className="ui-element- transparent" id="credits-pane" open={mainSnap.credits.show}
                  onSlAfterHide={() => setOpen(false)}>
            <SlInclude src="/src/assets/pages/credits.html"/>

            <div id="credits-pane-footer" slot={'footer'}>
                <div>
                    <strong>{vt3d.configuration.applicationName}</strong><span>{info.version}</span>
                </div>
                <SlTooltip content="Our GitHub repo">
                    <SlIconButton library="fa" name={FA2SL.set(faGithub)}
                                  target={'_blank'}
                                  href={'https://github.com/ViewTrack3D/vt3d'}
                    />
                </SlTooltip>
            </div>
        </SlDrawer>
        <SlTooltip placement={'right'} content="Show Credits">
            <SlButton className={'square-icon'} size="small" id={'open-credits-pane'} onClick={() => setOpen(true)}>
                <SlIcon library="fa" name={FA2SL.set(faCircleInfo)}></SlIcon>
            </SlButton>
        </SlTooltip>

    </>)
})
