import { SlDrawer }        from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { ProfileUtils }    from '@Utils/ProfileUtils'
import { forwardRef }      from 'react'
import { useSnapshot }     from 'valtio'
import { TrackUtils }      from '../../Utils/cesium/TrackUtils'
import { JourneySelector } from '../TracksEditor/journey/JourneySelector'
import { Utils }           from '../TracksEditor/Utils'
import { Toolbar }         from '../VT3D_UI/Toolbar'
import { ProfileChart }    from './ProfileChart'


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
            //TODO manage 'profile/close' event and externalise
            vt3d.profileTrackMarker.toggleVisibility()
        }
    }

    const data = ProfileUtils.prepareData()
    TrackUtils.setProfileVisibility(vt3d.theJourney)

    ProfileUtils.initMarker()

    return (
        <>
            {mainSnap.canViewProfile &&
                <div id="profile-container" key={mainSnap.components.profile.key}>
                    <SlDrawer id="profile-pane" open={mainSnap.components.profile.show}
                              onSlRequestClose={handleRequestClose}
                              contained
                              onSlHide={closeProfile}
                              placement="bottom"
                    >
                        <JourneySelector size={'small'}
                                         onChange={Utils.initJourneyEdition}/>

                        <div slot="header-actions">
                            <Toolbar editor={true}
                                     profile={false}
                                     fileLoader={true}
                                     position={'horizontal'}
                                     tooltip={'top'}
                                     mode={'embed'}
                            />
                        </div>
                        {data && <ProfileChart series={data.series}
                                               options={data.options}
                                               height={__.ui.css.getCSSVariable('--vt3d-profile-chart-height')}
                        />}
                    </SlDrawer>
                </div>
            }
        </>
    )
})
