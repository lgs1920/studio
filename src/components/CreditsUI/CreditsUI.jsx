//read version
import { faGithub }                                                       from '@fortawesome/free-brands-svg-icons'
import { faCircleInfo }                                                   from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDrawer, SlIcon, SlIconButton, SlInclude, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                          from '@Utils/FA2SL'
import { forwardRef }                                                     from 'react'
import { useSnapshot }                                                    from 'valtio'


import './style.css'

export const CreditsUI = forwardRef(function CreditsUI() {

    const mainSnap = useSnapshot(lgs.mainUIStore)

    const setOpen = (open) => {
        lgs.mainUIStore.credits.show = open
    }

    const version = async()=> {
        return  await fetch('/version.json').then(
            res => res.json()
        )
    }

    return (<>
        <SlDrawer className="ui-element- transparent" id="credits-pane" open={mainSnap.credits.show}
                  onSlAfterHide={() => setOpen(false)}>
            <SlInclude src="/src/assets/pages/credits.html"/>

            <div id="credits-pane-footer" slot={'footer'}>
                <div>
                    <strong>{lgs.configuration.applicationName}</strong><span>{version().studio}</span>
                </div>
                <SlTooltip content="Our GitHub repo">
                    <SlIconButton library="fa" name={FA2SL.set(faGithub)}
                                  target={'_blank'}
                                  href={'https://github.com/ViewTrack3D/lgs'}
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
