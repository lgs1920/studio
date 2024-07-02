import './style.css'
import { faFileCirclePlus, faXmark } from '@fortawesome/pro-regular-svg-icons'
import {
    faBan, faChevronRight, faFileCircleCheck, faFileCircleExclamation, faLocationSmile, faWarning,
}                                    from '@fortawesome/pro-solid-svg-icons'

import { SlButton, SlDialog, SlIcon, SlInput } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                               from '@Utils/FA2SL'
import { useCallback }                         from 'react'
import { Scrollbars }                          from 'react-custom-scrollbars'
import { sprintf }                             from 'sprintf-js'
import { useSnapshot }                         from 'valtio'
import { SUPPORTED_EXTENSIONS }                from '../../Utils/cesium/TrackUtils'
import {
    DRAG_AND_DROP_FILE_ACCEPTED, DRAG_AND_DROP_FILE_PARTIALLY, DRAG_AND_DROP_FILE_REJECTED, DRAG_AND_DROP_FILE_WAITING,
}                                              from '../../Utils/FileUtils'
import { DragNDropFile }                       from '../DragNDropFile/DragNDropFile'

const allJourneyFiles = []

/**
 * https://react-dropzone.js.org/
 */
export const JourneyLoaderUI = (props) => {

    const onDrop = useCallback((acceptedFiles) => {
        console.log(acceptedFiles)
    })
    //     acceptedFiles.forEach((file) => {
    //         const reader = new FileReader()
    //
    //         reader.onabort = () => console.log('file reading was aborted')
    //         reader.onerror = () => console.log('file reading has failed')
    //         reader.onload = () => {
    //             // Do whatever you want with the file contents
    //             const binaryStr = reader.result
    //         }
    //         reader.readAsArrayBuffer(file)
    //     })
    //
    // }, [])

    const journeyLoaderStore=lgs.mainProxy.components.mainUI.journeyLoader
    const journeyLoaderSnap= useSnapshot(journeyLoaderStore)

    const setState = lgs.mainProxy.components.fileLoader
    const getState = useSnapshot(setState)

    const notYetUrl = true

    const addFileToList = (eventOrUrl => {
        console.log(eventOrUrl)
    })

    const fileItem = (props) => {
        return (
            <li key={props.file.path}>
                {props.success &&
                <SlIcon className={'read-journey-success'} library="fa" name={FA2SL.set(faFileCircleCheck)}></SlIcon>
                }
                {!props.success &&
                    <SlIcon className={'read-journey-failure'} library="fa"
                            name={FA2SL.set(faFileCircleExclamation)}></SlIcon>
                }
                {props.file.name}
                {!props.success &&
                    <div class={'error-message'}>
                        ceci est un message d'erreur
                    </div>
                }
            </li>
        )
    }
    //
    // const fileList = acceptedFiles.map(file => {
    //     allJourneyFiles.push(file)
    //     return (
    //         <>
    //             {allJourneyFiles.map(file => fileItem({file: file, success: false}))}
    //         </>
    //     )
    //
    // })

    const ButtonLabel = () => {

        // TODO que les fichiers OK
        if (getState.fileList.length === 0) {
            return (
                <>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                    {'Close'}
                </>
            )
        }
        return (
            <>
                <SlIcon slot="prefix"  library="fa" name={FA2SL.set(faChevronRight)}/>
                {'Continue'}
            </>
        )
    }

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

                <AllowedFormat/>
            </section>
        )
    }

    const Rejected = () => {
        return (
            <section className={'drag-and-drop drag-reject'}>
                                    <span>
                                         <SlIcon library="fa" name={FA2SL.set(faBan)}></SlIcon>
                                        {getState.error}
                                    </span>

                {/* eslint-disable-next-line no-undef */}
                <AllowedFormat/>
            </section>
        )
    }

    const SomeRejected = () => {
        return (
            <section className={'drag-and-drop drag-some-reject'}>
                                    <span>
                                         <SlIcon library="fa" name={FA2SL.set(faWarning)}></SlIcon>
                                        {getState.error}
                                    </span>

                {/* eslint-disable-next-line no-undef */}
                <AllowedFormat/>
            </section>
        )
    }
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


    const AllowedFormat = () => {
        return (
            <span className={'comment'}>
                {sprintf('Accepted formats: %s', SUPPORTED_EXTENSIONS.join(', '))}
            </span>
        )
    }

    const close = (event) => {
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
                {!getState.empty &&
                    <div className={'drag-and-drop-list lgs-card'}>
                        <Scrollbars>
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

