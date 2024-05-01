import { SlDrawer }    from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { forwardRef }  from 'react'
import { useSnapshot } from 'valtio'
//read version


export const Profile = forwardRef(function Profile(props, ref) {

    const mainStore = vt3d.mainProxy
    const mainSnap = useSnapshot(mainStore)

    /**
     * Avoid click outside drawer
     */
    const handleRequestClose = (event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
    }
    /**
     * Close tracks editor pane
     *
     * @param event
     */
    const closeProfile = (event) => {
        if (isOK(event)) {
            mainStore.components.profile.show = false
        }
    }

    return (<>
        <div id="profile-container" key={mainSnap.components.profile.key}>
            {<SlDrawer id="profile-pane" open={mainSnap.components.profile.show}
                       onSlRequestClose={handleRequestClose}
                       contained
                       onSlHide={closeProfile}
                       placement="bottom"
            >
            </SlDrawer>}
        </div>
    </>)
})
