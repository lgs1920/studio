import {
    faRegularArrowsRotateReverseMagnifyingGlass, faRegularCircleDotSlash,
}                                                from '@awesome.me/kit-938bf84c0d/icons/kit/custom'
import { SlButton, SlDrawer, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useSnapshot }                           from 'valtio'
import { Export }                                from '../../core/ui/Export'
import { CHART_ELEVATION_VS_DISTANCE }           from '../../core/ui/Profiler'
import { FA2SL }                                 from '../../Utils/FA2SL'
import { UIToast }                               from '../../Utils/UIToast'
import { JourneySelector }                       from '../TracksEditor/journey/JourneySelector'
import { Utils }                                 from '../TracksEditor/Utils'
import { Toolbar }                               from '../VT3D_UI/Toolbar'
import { Wander }                                from '../Wander/Wander'
import { ProfileChart }                          from './ProfileChart'

export const Profile = function Profile(props, ref) {

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

    const resetChart = () => {
        __.ui.profiler.resetChart()
    }
    const toggleMarker = () => {
        vt3d.profileTrackMarker.toggleVisibility()
    }

    const snapshot = () => {
        const file = `${CHART_ELEVATION_VS_DISTANCE}-${__.app.slugify(vt3d.theJourney.title)}`
        Export.toPNG(`#apexcharts${CHART_ELEVATION_VS_DISTANCE}`, file).then(() => {
            UIToast.success({
                caption: `Your chart has been exported successfully !`,
                text: `into ${file}.png`,
            })
        })
    }

    const ProfileToolbar = (props) => {
        return (<>
            <SlTooltip placement={'top'} content="Toggle Marker Visibility">
                {<SlButton size={'small'} id={'toggle-marker-visibility'} className={'square-icon'}>
                    <SlIcon library="fa"
                            onClick={toggleMarker} name={FA2SL.set(faRegularCircleDotSlash)}></SlIcon>
                </SlButton>}
            </SlTooltip>

            <SlTooltip placement={'top'} content="Reset Chart">
                {<SlButton size={'small'} id={'open-the-profile-panel'} className={'square-icon'}>
                    <SlIcon library="fa"
                            onClick={resetChart}
                            name={FA2SL.set(faRegularArrowsRotateReverseMagnifyingGlass)}></SlIcon>
                </SlButton>}
            </SlTooltip>
        </>)
    }

    const data = __.ui.profiler.prepareData()
    __.ui.profiler.setVisibility()
    __.ui.profiler.initMarker()

    return (<>
        {mainSnap.canViewProfile && <div id="profile-container" key={mainSnap.components.profile.key}>
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
                             snapshot={snapshot}
                             position={'horizontal'}
                             tooltip={'top'}
                             mode={'embed'}
                             center={<ProfileToolbar/>}
                             left={<Wander/>}
                    />
                </div>
                {data && <ProfileChart series={data.series}
                                       options={data.options}
                                       height={__.ui.css.getCSSVariable('--vt3d-profile-chart-height')}
                />}
            </SlDrawer>
        </div>}
    </>)
}
