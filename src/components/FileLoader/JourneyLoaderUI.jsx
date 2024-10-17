import './style.css'
import { faArrowRotateRight, faFileCirclePlus, faXmark } from '@fortawesome/pro-regular-svg-icons'
import {
    faBan, faCaretRight, faDoNotEnter, faFileCircleCheck, faFileCircleExclamation, faLocationExclamation,
    faLocationSmile, faLocationXmark, faWarning,
}                                                        from '@fortawesome/pro-solid-svg-icons'

import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import parse                          from 'html-react-parser'
import { useEffect, useRef }          from 'react'
import { Scrollbars }                 from 'react-custom-scrollbars'
import { sprintf }                    from 'sprintf-js'
import { useSnapshot }                from 'valtio'
import {
    JOURNEY_DENIED, JOURNEY_OK, JOURNEY_WAITING, SUPPORTED_EXTENSIONS, TrackUtils,
}                                     from '../../Utils/cesium/TrackUtils'
import {
    DRAG_AND_DROP_FILE_ACCEPTED, DRAG_AND_DROP_FILE_PARTIALLY, DRAG_AND_DROP_FILE_REJECTED, DRAG_AND_DROP_FILE_WAITING,
    FileUtils,
}                                     from '../../Utils/FileUtils'
import { DragNDropFile }              from './DragNDropFile'

/**
 * https://react-dropzone.js.org/
 */
export const JourneyLoaderUI = (props) => {

    const journeyLoaderStore=lgs.mainProxy.components.mainUI.journeyLoader
    const journeyLoaderSnap= useSnapshot(journeyLoaderStore)

    const setState = lgs.mainProxy.components.fileLoader
    const getState = useSnapshot(setState)
    const fileList = setState.fileList

    const fileLoaderRef = useRef(null)

    const GPX_SAMPLE_FILENAME = 'LGS1920.gpx'
    const GPX_SAMPLE = [__.app.isDevelopment() ? '/public' : '/', 'assets', 'samples', GPX_SAMPLE_FILENAME].join('/')

    /**
     * Callback after loading a file. We load the journey
     *
     * @param file
     * @param content
     * @param result
     */
    const loadJourney = async (file, content, result = true) => {
        let status = JOURNEY_WAITING
        if (result) {
            const journey = FileUtils.getFileNameAndExtension(file.name)
            journey.content = content
            status = await TrackUtils.loadJourneyFromFile(journey)
            // If reading is OK we set some readonly parameters
            if (status === JOURNEY_OK) {
                lgs.theJourney.globalSettings()
            }
            else {
                // There's nothing left to do here
                return
            }
        }
        const item = fileList.get(__.app.slugify(file.name))
        item.journeyStatus = status
        fileList.set(__.app.slugify(file.name), item)
    }

    /**
     * Display item for File List
     *
     * @param item
     * @return {JSX.Element}
     * @constructor
     */
    const FileItem = ({item}) => {

        // JOURNEY_KO      = 0, JOURNEY_OK      = 1, JOURNEY_EXISTS  = 2, JOURNEY_WAITING = 3, JOURNEY_DENIED = 4
        const classes = ['read-journey-failure', 'read-journey-success', 'read-journey-warning', 'read-journey-waiting fa-spin','read-journey-failure']
        const icons = [faLocationXmark, faLocationSmile, faLocationExclamation,faArrowRotateRight,faDoNotEnter]

        if(item.validated === false) {
            item.journeyStatus = JOURNEY_DENIED
        }

        // We start with waiting
        if(item.journeyStatus === undefined) {
            item.journeyStatus = JOURNEY_WAITING
        }
        return (
            <li>
                {item.validated &&
                <SlIcon className={'read-journey-success'} library="fa" name={FA2SL.set(faFileCircleCheck)}></SlIcon>
                }
                {!item.validated &&
                    <SlIcon className={'read-journey-failure'} library="fa" name={FA2SL.set(faFileCircleExclamation)}></SlIcon>
                }
                <span>{item.file.fullName}</span>

                {item.journeyStatus !== undefined &&
                    <SlIcon className={classes[fileList.get(item.slug).journeyStatus]}
                            library="fa" name={FA2SL.set(icons[fileList.get(item.slug).journeyStatus])}>
                    </SlIcon>
                }

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
                {Array.from(fileList.values()).map(
                    (item, index) => <FileItem key={index} item={item}/>,
                )}
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
                    {parse('Or click to browse <br/>and select files on your device!')}
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

    const loadFile = async ({file, name}) => {
        try {
            fileList.clear()
            const content = await lgs.axios.get(`${[lgs.BACKEND_API, 'read'].join('/')}?file=${file}`)
            if (content.data.success) {
                const file = new File([content.data.content], name, {
                    type: 'application/gpx+xml',
                })
                fileList.set(__.app.slugify(file.name), setListItem(file, validate(file)))
                FileUtils.readFileAsText(file, loadJourney)
            }
        }
        catch (error) {
            console.error(error)
        }
    }

    const loadSample = async () => {
        loadFile({file: GPX_SAMPLE, name: GPX_SAMPLE_FILENAME})
        journeyLoaderStore.visible = false
    }

    const urlToLoad = useRef(null)
    const loadURL = async () => {
        //TODO extract real download links from share links. Target : Onedrive, Dropbox, Google
        loadFile({file: urlToLoad.current.value, name: GPX_SAMPLE_FILENAME})
    }

    /**
     * Validate file
     *
     * The only test done here consists of testing the extendion.
     * Other can be done in  props.validateCB function that returns {status:boolean,error:message}
     *
     * @param file
     *
     * @return {{error: string, validated: boolean}}
     */
    const validate = (file) => {
        let check = {validated: true, message: ''}
        const fileInfo = FileUtils.getFileNameAndExtension(file.name)

        if (SUPPORTED_EXTENSIONS.includes(fileInfo.extension)) {
            if (props.validateCB) {
                check = props.validateCB(file)
            }
        }
        else {
            check.validated = false
            check.error = IMPROPER_FORMAT
        }

        check.file = fileInfo
        return check
    }

    const setListItem = (file, validate) => {
        return {
            slug:      __.app.slugify(file.name),
            file:      {
                date:      file.lastModified,
                fullName:  file.name,
                name:      validate.file.name,
                extension: validate.file.extension,
                type:      file.type,
                size:      file.size,
            },
            validated: validate.validated,
            error:     validate.error,
        }
    }


    useEffect(() => {
        const dialogPanel = fileLoaderRef.current.shadowRoot.querySelector('[part="panel"]')

        dialogPanel.addEventListener('mouseover', __.ui.cameraManager.pauseOrbital)
        dialogPanel.addEventListener('mouseout', __.ui.cameraManager.relaunchOrbital)

        return () => {
            dialogPanel.removeEventListener('mouseover', __.ui.cameraManager.pauseOrbital)
            dialogPanel.removeEventListener('mouseout', __.ui.cameraManager.relaunchOrbital)
        }
    }, [])

    const manageHover = () => {

    }

    return (

        <SlDialog open={journeyLoaderSnap.visible}
                  id={'file-loader-modal'}
                  label={'Add Journeys'}
                  onSlRequestClose={close}
                  className={'lgs-theme'}
                  ref={fileLoaderRef}

        >
            <div className="download-columns">
                <div slot="header-actions"></div>
                <DragNDropFile
                    className={'drag-and-drop-container'}
                    types={SUPPORTED_EXTENSIONS}
                    manageContent={loadJourney}
                    detectWindowDrag={true}
                    multiple
                    validate={validate}
                    setList={setListItem}
                >
                    {getState.accepted === DRAG_AND_DROP_FILE_WAITING && <Message/>}
                    {getState.accepted === DRAG_AND_DROP_FILE_ACCEPTED && <Accepted/>}
                    {getState.accepted === DRAG_AND_DROP_FILE_REJECTED && <Rejected/>}
                    {getState.accepted === DRAG_AND_DROP_FILE_PARTIALLY && <SomeRejected/>}

                </DragNDropFile>

                {fileList.size > 0 &&
                    <div className={'drag-and-drop-list lgs-card'}>
                        <Scrollbars>
                            <FileList key={fileList.size}/>
                        </Scrollbars>
                    </div>
                }

                {/* <div className={'add-url'}> */}
                {/*     <SlInput type={'url'} ref={urlToLoad} size="small" placeholder={'A URL or sharing link ? Paste it here.'}></SlInput> */}

                {/*     <SlButton onClick={loadURL} size="small"> */}
                {/*         <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFileCirclePlus)}/>{'Download'} */}
                {/*     </SlButton> */}
                {/* </div> */}

                <div className={'load-sample'}>
                    {`Don't have any`}{lgs.journeys.size ? ' more ' : ' '}{`files handy?`}<br/>{'Play with a sample!'}
                    <SlButton onClick={loadSample}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFileCirclePlus)}/>{'Load Sample'}
                    </SlButton>
                </div>


                <div className="buttons-bar">
                    <SlButton variant="primary" onClick={close}><ButtonLabel/></SlButton>
                </div>
            </div>
        </SlDialog>

    )

}

