import { faPencil }                      from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDrawer, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { forwardRef }                    from 'react'
import { useSnapshot }                   from 'valtio'

//read version


export const Profile = forwardRef(function Profile(props, ref) {

    const mainStore = vt3d.mainProxy.components.profile
    const mainSnap = useSnapshot(mainStore)

    const editorStore = vt3d.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

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
            mainStore.show = false
        }
    }

    /**
     * Open tracks editor pane
     *
     * @param event
     */
    const toggleProfile = (event) => {
        mainStore.show = !mainStore.show
    }

    return (<>
        <div id="profile-container" key={mainSnap.key}>
            {<SlDrawer id="profile-pane" open={true /*mainSnap.show*/}
                       onSlRequestClose={handleRequestClose}
                       contained
                       onSlHide={closeProfile}
                       placement="bottom"
            >
            </SlDrawer>}
        </div>

        <SlTooltip placement={'right'} content="Open Profile">
            {mainSnap.usable && <SlButton size={'small'} className={'square-icon'} id={'open-theJourney-editor'}
                                          onClick={toggleProfile}>
                <SlIcon library="fa" name={FA2SL.set(faPencil)}></SlIcon>
            </SlButton>}
        </SlTooltip>
    </>)
})
