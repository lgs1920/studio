import { MenuSample }                                                            from '@Components/Settings/tools/style/MenuSample'
import { MENU_END_END, MENU_END_START, MENU_START_END, MENU_START_START, START } from '@Core/constants'
import {
    SlDivider,
}                                                                                from '@shoelace-style/shoelace/dist/react'

export const MenuSettings = (props) => {

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const selectDisposition = (event, name) => {
        const positions = name.split('-')
        console.log(positions)
        lgs.settings.ui.menu.drawers.fromStart = (positions[0] === START)
        lgs.settings.ui.menu.toolBar.fromStart = (positions[1] === START)
    }

    return (
        <>
            <span slot="summary">{'Menu Settings'}</span>
            <SlDivider/>
            <div id="menu-disposition-chooser">
                <MenuSample align={MENU_START_END}
                            onSelect={selectDisposition}
                            tooltip={'Panels on left, buttons on right'}/>
                <MenuSample align={MENU_START_START}
                            onSelect={selectDisposition}
                            tooltip={'Both panels and buttons on left'}/>
                <MenuSample align={MENU_END_START}
                            onSelect={selectDisposition}
                            tooltip={'Panels on right, buttons on left'}/>
                <MenuSample align={MENU_END_END}
                            onSelect={selectDisposition}
                            tooltip={'Both panels and buttons on right'}/>
            </div>

        </>
    )
}