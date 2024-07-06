import './style.css'
import { faFileCirclePlus, faXmark } from '@fortawesome/pro-regular-svg-icons'
import {
    faBan, faCaretRight, faChevronRight, faFileCircleCheck, faFileCircleExclamation, faLocationSmile, faWarning,
} from '@fortawesome/pro-solid-svg-icons'

import { SlButton, SlDialog, SlIcon, SlInput } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                               from '@Utils/FA2SL'
import { Scrollbars }                          from 'react-custom-scrollbars'
import { sprintf }                             from 'sprintf-js'
import { useSnapshot }                      from 'valtio'
import { proxyMap }                      from 'valtio/utils'

import { SUPPORTED_EXTENSIONS, TrackUtils } from '../../Utils/cesium/TrackUtils'
import {
    DRAG_AND_DROP_FILE_ACCEPTED, DRAG_AND_DROP_FILE_PARTIALLY, DRAG_AND_DROP_FILE_REJECTED, DRAG_AND_DROP_FILE_WAITING,
    FileUtils,
} from '../../Utils/FileUtils'
import { DragNDropFile }                       from '../DragNDropFile/DragNDropFile'


/**
 * https://react-dropzone.js.org/
 */
export const JourneyLoaderUI = (props) => {

    const journeyLoaderStore=lgs.mainProxy.components.mainUI.journeyLoader
    const journeyLoaderSnap= useSnapshot(journeyLoaderStore)

    const setState = lgs.mainProxy.components.fileLoader
    const getState = useSnapshot(setState)
    var fileList = setState.fileList

    const notYetUrl = true

    /**
     * Callback after loading a file. We load the journey
     *
     * @param file
     * @param content
     * @param result
     */
    const loadJourney=(file,content,result) => {
        if (result) {
            const journey = FileUtils.getFileNameAndExtension(file.name)
            journey.content = content
            TrackUtils.uploadJourneyFile(journey)
        }
    }

    /**
     * isplay item for File List
     *
     * @param item
     * @return {JSX.Element}
     * @constructor
     */
    const FileItem = ({item}) => {
        return (
            <li key={item.file.date}>
                {item.status &&
                <SlIcon className={'read-journey-success'} library="fa" name={FA2SL.set(faFileCircleCheck)}></SlIcon>
                }
                {!item.status &&
                    <SlIcon className={'read-journey-failure'} library="fa"
                            name={FA2SL.set(faFileCircleExclamation)}></SlIcon>
                }
                {item.file.fullName}
            </li>
        )
    }

    /**
     * File list component
     *
     * @return {JSX.Element}
     * @constructor
     */
    const FileList = () => {
        return (
            <ul>
                {Array.from(fileList.values()).map((item, index) => <FileItem key={index} item={item}/>)}
            </ul>
        )
    }

    /**
     * Button label Component
     *
     * If no files are elected, the label is "Close" else "Continue"
     *
     * @return {JSX.Element}
     * @constructor
     */
    const ButtonLabel = () => {

        // TODO que les fichiers OK
        if (fileList.size === 0) {
            return (
                <>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                    {'Close'}
                </>
            )
        }
        return (
            <>
                <SlIcon slot="prefix"  library="fa" name={FA2SL.set(faCaretRight)}/>
                {'Continue'}
            </>
        )
    }

    /**
     * This is the standard message
     *
     * @return {JSX.Element}
     * @constructor
     */
    const Message = () => {
        return (
            <section className={sprintf('drag-and-drop%s', getState.dragging.active ? ' waiting-drop' : '')}>
                <span>
                     <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFileCirclePlus)}></SlIcon>
                    {'Drop your files here !'}
                </span>
                <span>
                    {'Or click to browse and select files on your device!'}
                </span>

                <AllowedFormatsMessage/>
            </section>
        )
    }

    /**
     * This will be displayed when all files are rejected
     *
     * @return {JSX.Element}
     * @constructor
     */
    const Rejected = () => {
        return (
            <section className={'drag-and-drop drag-reject'}>
                <span>
                     <SlIcon library="fa" name={FA2SL.set(faBan)}></SlIcon>
                    {getState.error}
                </span>

                {/* eslint-disable-next-line no-undef */}
                <AllowedFormatsMessage/>
            </section>
        )
    }

    /**
     * This will be displayed when some files, not all, are rejected
     *
     * @return {JSX.Element}
     * @constructor
     */
    const SomeRejected = () => {
        return (
            <section className={'drag-and-drop drag-some-reject'}>
                <span>
                     <SlIcon library="fa" name={FA2SL.set(faWarning)}></SlIcon>
                    {getState.error}
                </span>

                {/* eslint-disable-next-line no-undef */}
                <AllowedFormatsMessage/>
            </section>
        )
    }

    /**
     * This will be displayed when all are accepted
     *
     * @return {JSX.Element}
     * @constructor
     */
    const Accepted = () => {
        return (
            <section className={'drag-and-drop drag-accept'}>
                <span>
                     <SlIcon library="fa" name={FA2SL.set(faLocationSmile)}></SlIcon>
                    {'Enjoy !'}
                </span>
            </section>
        )
    }


    /**
     * The allowed format reminder message
     *
     * @return {JSX.Element}
     * @constructor
     */
    const AllowedFormatsMessage = () => {
        return (
            <span className={'comment'}>
                {sprintf('Accepted formats: %s', SUPPORTED_EXTENSIONS.join(', '))}
            </span>
        )
    }

    /**
     * Close the modal
     *
     */
    const close = () => {
        fileList.clear()
        journeyLoaderStore.visible = false
    }

    return (

        <SlDialog open={journeyLoaderSnap.visible}
                  id={'file-loader-modal'}
                  label={'Add Journeys'}
                  onSlRequestClose={close}
        >
            <div className="download-columns">
                <div slot="header-actions"></div>
                <DragNDropFile
                    className={'drag-and-drop-container'}
                    types={SUPPORTED_EXTENSIONS}
                    manageContent={loadJourney}
                >
                    {getState.accepted === DRAG_AND_DROP_FILE_WAITING && <Message/>}
                    {getState.accepted === DRAG_AND_DROP_FILE_ACCEPTED && <Accepted/>}
                    {getState.accepted === DRAG_AND_DROP_FILE_REJECTED && <Rejected/>}
                    {getState.accepted === DRAG_AND_DROP_FILE_PARTIALLY && <SomeRejected/>}

                </DragNDropFile>

                    {!notYetUrl &&
                    <div className={'add-url'}>
                        <SlInput type={'url'} placeholder={'Or enter/paste a file URL here:'}></SlInput>

                        <SlButton>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFileCirclePlus)}/>{'Add'}
                        </SlButton>
                    </div>
                    }
                    {fileList.size > 0 &&
                        <div className={'drag-and-drop-list lgs-card'}>
                            <Scrollbars>
                                <FileList/>
                            </Scrollbars>
                        </div>
                    }

                    <div className="buttons-bar">
                        <SlButton variant="primary" onClick={close}><ButtonLabel/></SlButton>
                    </div>
                </div>
            </SlDialog>

    )

}

