import { faGithub }       from '@fortawesome/free-brands-svg-icons'
import { faGlobePointer } from '@fortawesome/pro-regular-svg-icons'

import { SlIconButton } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                   from '@Utils/FA2SL'
import React                       from 'react'

export const DrawerFooter = function DrawerFooter() {

    return (
        <div id="credits-pane-footer" className="drawer-pane-footer" slot={'footer'}>
            <div><strong>{lgs.servers.studio.shortname}</strong><span>{lgs.versions.studio}</span></div>
            <div><strong>{lgs.servers.backend.shortname}</strong><span>{lgs.versions.backend}</span></div>
            <div><strong>{lgs.configuration.api.name}</strong><span>{lgs.versions.api}</span></div>
            <div className="drawer-footer-url">
                    <SlIconButton library="fa" name={FA2SL.set(faGlobePointer)}
                                  target={'_blank'}
                                  href={__.app.buildUrl(lgs.configuration.website)}
                                  title={"Our Site"}
                    />
                    <SlIconButton library="fa" name={FA2SL.set(faGithub)}
                                  target={'_blank'}
                                  href={lgs.configuration.githubURL}
                                  title={"Our GitHub repos"}
                    />
            </div>
        </div>
    )
}