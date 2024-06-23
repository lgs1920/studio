import './style.css'
import { faFileCirclePlus, faLocationPlus, faXmark }                 from '@fortawesome/pro-regular-svg-icons'
import {
    faBan, faChevronRight, faFileCircleCheck, faFileCircleExclamation, faLocationSmile,
} from '@fortawesome/pro-solid-svg-icons'

import { SlButton, SlDialog, SlDivider, SlIcon, SlInput, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                     from '@Utils/FA2SL'
import { useState }                                                  from 'react'
import { Scrollbars }                                                from 'react-custom-scrollbars'
import { useDropzone }                                               from 'react-dropzone'
import { ACCEPTED_TRACK_FILES }                                      from '../../Utils/cesium/TrackUtils'


const allJourneyFiles = []

/**
 * https://react-dropzone.js.org/
 */
export const JourneyLoader = (props) => {
    const [open, setOpen] = useState(false)

    // const onDrop = useCallback((acceptedFiles) => {
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

    const addFileToList = (eventOrUrl => {
        console.log(eventOrUrl)
    })

    const {
              acceptedFiles,
              getRootProps, getInputProps,
              isFocused,
              isDragAccept,
              isDragReject,
          } = useDropzone({
                              accept:         {'image/*': []},
                              onDragAccepted: addFileToList(),
                              multiple:       true,
                          })

    const fileItem = (file) => {
        return (
            <li key={file.path}>
                <SlIcon className={'read-journey-success'} library="fa" name={FA2SL.set(faFileCircleCheck)}></SlIcon>
                <SlIcon className={'read-journey-failure'} library="fa" name={FA2SL.set(faFileCircleExclamation)}></SlIcon>
                {file.name}
            </li>
        )
    }

    const fileList = acceptedFiles.map(file => {
        allJourneyFiles.push(file)
        return (
            <>
                {allJourneyFiles.map(file => fileItem(file))}
            </>
        )

    })

    const ButtonLabel = () => {
        if (allJourneyFiles.length ===0) {
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

    const AllowedFormat = ()=> {
        return (
            <span className={'comment'}>
                {sprintf('Accepted formats: %s', ACCEPTED_TRACK_FILES.join(', '))}
            </span>
        )
    }

    return (
        <>
            <SlTooltip hoist placement={props.tooltip} content="Add a new Journey">
                {/* <SlButton size={'small'} onClick={setOpen(true);TrackUtils.uploadJourneyFile} className={'square-icon'}> */}
                <SlButton size={'small'} className={'square-icon'}>
                    <SlIcon  slot="prefix" library="fa" name={FA2SL.set(faLocationPlus)}/>
                </SlButton>
            </SlTooltip>

            <SlDialog open={true}
                      id={'file-loader-modal'}
                      label={'Add Journeys'}
            >
                <div className="download-columns">
                    <div slot="header-actions"></div>
                    <div className={'drag-and-drop-container'} {...getRootProps()}>
                        <input {...getInputProps()} />

                        {!isDragAccept && !isDragReject &&
                            <section className={'drag-and-drop waiting-drop'}>
                                    <span>
                                         <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFileCirclePlus)}></SlIcon>
                                        {'Drop your files here !'}
                                    </span>
                                <span>
                                        {'Or click to browse and select files on your device!'}
                                    </span>

                                <AllowedFormat/>
                            </section>
                        }

                        {isDragReject &&
                            <section className={'drag-and-drop drag-reject'}>
                                    <span>
                                         <SlIcon library="fa" name={FA2SL.set(faBan)}></SlIcon>
                                        {'Format not supported !'}
                                    </span>

                                {/* eslint-disable-next-line no-undef */}
                                <AllowedFormat/>
                            </section>
                        }

                        {isDragAccept &&
                            <section className={'drag-and-drop drag-accept'}>
                                    <span>
                                         <SlIcon library="fa" name={FA2SL.set(faLocationSmile)}></SlIcon>
                                        {'Enjoy !'}
                                    </span>
                            </section>
                        }

                    </div>

                    <div className={'add-url'}>
                        <SlInput type={'url'} placeholder={'Or enter/paste a file URL here:'}></SlInput>

                        <SlButton>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFileCirclePlus)}/>{'Add'}
                        </SlButton>
                    </div>

                    <div className={'drag-and-drop-list lgs-card'}>
                        <Scrollbars>
                            <ul>{fileList}</ul>
                        </Scrollbars>
                    </div>

                    <div className="buttons-bar">
                        <SlButton variant="primary"><ButtonLabel/></SlButton>
                    </div>
                </div>
            </SlDialog>
        </>
    )

}

