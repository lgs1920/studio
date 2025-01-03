import { MenuSample }                                                               from '@Components/Settings/tools/style/MenuSample'
import { LEFT, MENU_LEFT_LEFT, MENU_LEFT_RIGHT, MENU_RIGHT_LEFT, MENU_RIGHT_RIGHT } from '@Core/constants'
import {
    SlDivider,
}                                                                                   from '@shoelace-style/shoelace/dist/react'

export const MenuSettings = (props) => {

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const selectDisposition = (event, name) => {
        const positions = name.split('-')
        lgs.settings.ui.menu.drawers.onLeft = (positions[0] === LEFT)
        lgs.settings.ui.menu.toolBar.onLeft = (positions[1] === LEFT)
    }

    return (
        <>
            <span slot="summary">{'Menu Settings'}</span>
            <SlDivider/>
            <div id="menu-disposition-chooser">
                <MenuSample align={MENU_LEFT_RIGHT}
                            onSelect={selectDisposition}
                            tooltip={'Panels on left, buttons on right'}/>
                <MenuSample align={MENU_LEFT_LEFT}
                            onSelect={selectDisposition}
                            tooltip={'Both panels and buttons on left'}/>
                <MenuSample align={MENU_RIGHT_LEFT}
                            onSelect={selectDisposition}
                            tooltip={'Panels on right, buttons on left'}/>
                <MenuSample align={MENU_RIGHT_RIGHT}
                            onSelect={selectDisposition}
                            tooltip={'Both panels and buttons on right'}/>
            </div>

        </>
    )
}