import { MenuSample }    from '@Components/Settings/tools/style/MenuSample'
import {
    BOTTOM, MENU_BOTTOM_END, MENU_BOTTOM_START, MENU_END_END, MENU_END_START, MENU_START_END, MENU_START_START, START,
}                        from '@Core/constants'
import { SlDivider }     from '@shoelace-style/shoelace/dist/react'
import { useMediaQuery } from 'react-responsive'

export const MenuSettings = (props) => {

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }
    const isNotMobile = useMediaQuery({minWidth: 768})
    const isMobile = useMediaQuery({maxWidth: 767})

    const selectDisposition = (event, name) => {
        const positions = name.split('-')
        if (isNotMobile) {
            lgs.settings.ui.menu.drawers.fromStart = (positions[0] === START)
            lgs.editorSettingsProxy.menu.drawer = positions[0]
        }
        else {
            lgs.settings.ui.menu.drawers.fromBottom = (positions[0] === BOTTOM)
            lgs.editorSettingsProxy.menu.drawer = positions[0]
        }

        lgs.settings.ui.menu.toolBar.fromStart = (positions[1] === START)
        lgs.editorSettingsProxy.menu.toolbar = positions[1]
    }


    return (
        <>
            <span slot="summary">{'Menu Settings'}</span>
            <SlDivider/>
            {isNotMobile &&
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
            }
            {isMobile &&
                <div id="menu-disposition-chooser" device="mobile">
                    <MenuSample align={MENU_BOTTOM_START}
                                onSelect={selectDisposition}
                                device="mobile"
                                tooltip={'Panels on bottom, buttons on left'}/>
                    <MenuSample align={MENU_BOTTOM_END}
                                onSelect={selectDisposition}
                                device="mobile"
                                tooltip={'Panels on bottom, buttons on right'}/>
                </div>
            }
        </>
    )
}