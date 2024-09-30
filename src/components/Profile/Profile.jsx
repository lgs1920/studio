import { faRegularArrowsRotateReverseMagnifyingGlass }             from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { SlButton, SlDrawer, SlIcon, SlResizeObserver, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useSnapshot }                                             from 'valtio'
import { Export }                                                  from '../../core/ui/Export'
import { CHART_ELEVATION_VS_DISTANCE }                             from '../../core/ui/Profiler'
import { FA2SL }                                                   from '../../Utils/FA2SL'
import { UIToast }                                                 from '../../Utils/UIToast'
import { DropdownToolbar }                                         from '../MainUI/DropdownToolbar'
import { Toolbar }                                                 from '../MainUI/Toolbar'
import { JourneySelector }                                         from '../TracksEditor/journey/JourneySelector'
import { Utils }                                                   from '../TracksEditor/Utils'
import { Wander }                                                  from '../Wander/Wander'
import { ProfileChart }                                            from './ProfileChart'


export const Profile = function Profile() {

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

    const toggleMarker = () => {
        lgs.theTrack.marker.toggleVisibility()
    }

    const snapshotAsImage = () => {
        const file = `${CHART_ELEVATION_VS_DISTANCE}-${__.app.slugify(lgs.theJourney.title)}`
        const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
        Export.toPNG( chart.getDom(), file).then(() => {
            UIToast.success({
                                caption: `Your chart has been exported successfully !`,
                                text: `into ${file}.png`,
                            })
        })
    }
    const snapshotAsVector = () => {
        const file = `${CHART_ELEVATION_VS_DISTANCE}-${__.app.slugify(lgs.theJourney.title)}`
        const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
        Export.toSVG( {
                          dom: chart.getDom(),
                          content:chart.getDataURL({type: 'svg'})
                      }, file).then(() => {
            UIToast.success({
                                caption: `Your chart has been exported successfully !`,
                                text: `into ${file}.svg`,
                            })
        })
    }

    const ProfileToolbar = (props) => {
        return (
            <>
            {        mainSnap.components.profile.zoom &&
            <div className={'profile-additional'}>
            {/* <SlTooltip hoist placement={props.placement} content="Hide Marker"> */}
            {/*     <SlButton id={'toggle-marker-visibility'} className={'square-icon'} onClick={toggleMarker}> */}
            {/*         <SlIcon  slot="prefix" library="fa" name={FA2SL.set(faSolidCircleSlash)}/> */}
            {/*     </SlButton> */}
            {/* </SlTooltip> */}
            <SlTooltip hoist placement={props.placement} content="Reset zoom">
                <SlButton id={'open-the-profile-panel'} className={'square-icon'} onClick={__.ui.profiler.resetZoom}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faRegularArrowsRotateReverseMagnifyingGlass)}/>
                </SlButton>
            </SlTooltip>
        </div>
            }
            </>)
    }

    __.ui.profiler.setVisibility()

    //prepare data from track to profile
    const data = __.ui.profiler.prepareData()

    const resizeProfile=event => {
            const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
            const container = document.getElementById(`profile-${CHART_ELEVATION_VS_DISTANCE}`)
            const dimensions = container.getBoundingClientRect()
            if (dimensions.width > 0) {
                mainStore.components.profile.width = dimensions.width
                mainStore.components.profile.height = dimensions.height
            }
    }

    return (<>
        {mainSnap.canViewProfile && <div id="profile-container" key={mainSnap.components.profile.key}>
            <SlDrawer id="profile-pane" open={mainSnap.components.profile.show}
                      onSlRequestClose={handleRequestClose}
                      onSlAfterShow={()=> {
                          window.dispatchEvent(new Event('resize'))
                      }}
                      contained
                      onSlHide={closeProfile}
                      placement="bottom"
                      className={'lgs-theme'}
            >


                <div className="profile-toolbar" slot={'header-actions'}>
                    <JourneySelector size={'small'} onChange={Utils.initJourneyEdition} single={true}/>

                    <div className={'profile-tools-part'}>
                        <Wander id={'profile-wander'}/>
                        <Toolbar editor={true}
                                 profile={false}
                                 fileLoader={true}
                                 snapshot={{png:snapshotAsImage,svg:snapshotAsVector}}
                                 position={'horizontal'}
                                 tooltip={'top'}
                                 mode={'embed'}
                                 center={<ProfileToolbar placement={'top'}/>}
                        />
                        <DropdownToolbar editor={true}
                                         profile={false}
                                         fileLoader={true}
                                         snapshot={{png:snapshotAsImage,svg:snapshotAsVector}}
                                         tooltip={'left'}
                                         center={<ProfileToolbar placement={'left'}/>}
                                         mode={'embed'}
                                         icons={true}
                                         placement={'left'}
                        />
                    </div>
                </div>
                {data &&
                    <SlResizeObserver onSlResize={resizeProfile}>

                    <div id={`profile-${CHART_ELEVATION_VS_DISTANCE}`} style={{width: '100%', height: '100%'}}>
                    <ProfileChart data={data}
                                  height={__.ui.css.getCSSVariable('--lgs-profile-chart-height')}
                    />
                    </div>
                    </SlResizeObserver>

                }
            </SlDrawer>
        </div>}
    </>)
}
