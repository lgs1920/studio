import { POIS_EDITOR_DRAWER } from '@Core/constants'
import { SlDrawer }           from '@shoelace-style/shoelace/dist/react'
import React                  from 'react'
import { useSnapshot }        from 'valtio'
import './style.css'
import { DrawerFooter }       from '../../DrawerFooter'

export const Panel = () => {
    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)
    const menu = useSnapshot(lgs.editorSettingsProxy.menu)

    const handleRequestClose = (event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
        else {
            __.ui.drawerManager.close()
        }
    }
    const closePOIsEditor = (event) => {
        if (window.isOK(event)) {
            window.dispatchEvent(new Event('resize'))
            if (__.ui.drawerManager.isCurrent(POIS_EDITOR_DRAWER)) {
                __.ui.drawerManager.close()
            }
        }
    }

    return (<div className={'drawer-wrapper'}>
            <SlDrawer id={POIS_EDITOR_DRAWER}
                      open={mainSnap.drawers.open === POIS_EDITOR_DRAWER}
                      onSlRequestClose={handleRequestClose}
                      contained
                      onSlAfterHide={closePOIsEditor}
                      className={'lgs-theme'}
                      placement={menu.drawer}
            >
                <DrawerFooter/>

            </SlDrawer>

        </div>
    )
}
