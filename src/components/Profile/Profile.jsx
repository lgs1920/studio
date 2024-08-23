import {
    faRegularArrowsRotateReverseMagnifyingGlass, faSolidCircleSlash,
}                                                from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { SlButton, SlDrawer, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useSnapshot }                           from 'valtio'
import { Export }                                from '../../core/ui/Export'
import { CHART_ELEVATION_VS_DISTANCE }           from '../../core/ui/Profiler'
import { FA2SL }                                 from '../../Utils/FA2SL'
import { UIToast }                               from '../../Utils/UIToast'
import { DropdownToolbar } from '../MainUI/DropdownToolbar'
import { Toolbar }         from '../MainUI/Toolbar'
import { JourneySelector }                       from '../TracksEditor/journey/JourneySelector'
import { Utils }                                 from '../TracksEditor/Utils'
import { Wander }                                from '../Wander/Wander'
import { ProfileChart }                          from './ProfileChart'

export const Profile = function Profile(props, ref) {

    const mainStore = lgs.mainProxy
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
        if (window.isOK(event)) {
            mainStore.components.profile.show = false
            //TODO manage 'profile/close' event and externalise
            toggleMarker()
        }
    }

    const resetChart = () => {
        __.ui.profiler.resetChart()
    }
    const toggleMarker = () => {
        lgs.theTrack.marker.toggleVisibility()
    }

    const snapshot = () => {
        const file = `${CHART_ELEVATION_VS_DISTANCE}-${__.app.slugify(lgs.theJourney.title)}`
        Export.toPNG(`#apexcharts${CHART_ELEVATION_VS_DISTANCE}`, file).then(() => {
            UIToast.success({
                caption: `Your chart has been exported successfully !`,
                text: `into ${file}.png`,
            })
        })
    }

    const ProfileToolbar = (props) => {
        return (<div className={'profile-additional'}>
            <SlTooltip hoist placement={props.placement} content="Toggle Marker Visibility">
                {<SlButton id={'toggle-marker-visibility'} className={'square-icon'}>
                    <SlIcon  slot="prefix" library="fa"
                            onClick={toggleMarker} name={FA2SL.set(faSolidCircleSlash)}>
                    </SlIcon>
                </SlButton>}
            </SlTooltip>

            <SlTooltip hoist placement={props.placement} content="Reset Chart">
                {<SlButton id={'open-the-profile-panel'} className={'square-icon'}>
                    <SlIcon  slot="prefix"library="fa"
                            onClick={resetChart}
                            name={FA2SL.set(faRegularArrowsRotateReverseMagnifyingGlass)}></SlIcon>
                </SlButton>}
            </SlTooltip>
        </div>)
    }

    const data = __.ui.profiler.prepareData()
    __.ui.profiler.setVisibility()

    return (<>
        {mainSnap.canViewProfile && <div id="profile-container" key={mainSnap.components.profile.key}>
            <SlDrawer id="profile-pane" open={mainSnap.components.profile.show}
                      onSlRequestClose={handleRequestClose}
                      contained
                      onSlHide={closeProfile}
                      placement="bottom"
                      className={'lgs-theme'}
            >


                <div className="profile-toolbar" slot={'header-actions'}>
                    <JourneySelector size={'small'} onChange={Utils.initJourneyEdition}/>

                    <div className={'profile-tools-part'}>
                        <Wander id={'profile-wander'}/>
                        <Toolbar editor={true}
                                 profile={false}
                                 fileLoader={true}
                                 snapshot={snapshot}
                                 position={'horizontal'}
                                 tooltip={'top'}
                                 mode={'embed'}
                                 center={<ProfileToolbar placement={'top'}/>}
                        />
                        <DropdownToolbar editor={true}
                                         profile={false}
                                         fileLoader={true}
                                         snapshot={snapshot}
                                         tooltip={'left'}
                                         center={<ProfileToolbar placement={'left'}/>}
                                         mode={'embed'}
                                         icons={true}
                                         placement={'left'}
                        />
                    </div>
                </div>
                {data &&
                    <ProfileChart series={data.series}
                                  options={data.options}
                                  height={__.ui.css.getCSSVariable('--lgs-profile-chart-height')}
                    />
                }
            </SlDrawer>
        </div>}
    </>)
}
