import { useRef }      from 'react'
import { useSnapshot } from 'valtio'
import {
    DRAG_AND_DROP_FILE_ACCEPTED, DRAG_AND_DROP_FILE_PARTIALLY, DRAG_AND_DROP_FILE_REJECTED, DRAG_AND_DROP_FILE_WAITING,
    FileUtils,
}                      from '../../Utils/FileUtils'

/**
 * From : https://www.codemzy.com/blog/react-drag-drop-file-upload
 *
 * @return {JSX.Element}
 * @constructor
 */

export const DragNDropFile = (props) => {

    const setState = lgs.mainProxy.components.fileLoader
    const getState = useSnapshot(setState)

    const inputRef = useRef(null)

    const classes = props.classes ?? 'drag-and-drop-container'
    const id = props.id ?? 'drag-and-drop-file'

    const acceptedTypes = props.types.map(type => {
        if (!type.startsWith('.')) {
            type = '.' + type
        }
    })

    const IMPROPER_FORMAT = 'File format not supported!'
    const SOME_IMPROPER_FORMAT = 'Not all files format are supported!'


    /**
     * Cancel event
     *
     * @param event
     */
    const cancelEvent = (event) => {
        event.preventDefault()
        event.stopPropagation()
    }

    /**
     * Drag start event
     *
     * @param event
     *
     * Calls props.onDragEnter event
     */
    const onDragStart = (event) => {
        cancelEvent(event)
        if (props.onDragStart) {
            props.onDragStart()
        }
    }

    /**
     * Drag enter event
     *
     * @param event
     *
     * Calls props.onDragEnter event
     */
    const onDragEnter = (event) => {
        cancelEvent(event)
        setState.dragging.active = true
        if (props.onDragEnter) {
            props.onDragEnter()
        }

    }

    /**
     * Drag over event
     *
     * @param event
     *
     * Calls props.onDragOver event
     */
    const onDragOver = (event) => {
        cancelEvent(event)
        setState.dragging.active = true
        if (props.onDragOver) {
            props.onDragOver(event)
        }

    }

    /**
     * Drag leave event
     *
     * @param event
     *
     * Calls props.onDragLeave event
     */
    const onDragLeave = (event) => {
        cancelEvent(event)
        setState.dragging.active = false
        if (props.onDragLeave) {
            props.onDragLeave(event)
        }
    }

    /**
     * Drag end event
     *
     * @param event
     *
     * Calls props.onDragLeave event
     */
    const onDragEnd = (event) => {
        cancelEvent(event)
        setState.dragging.active = false
        if (props.onDragEnd) {
            props.onDragEnd(event)
        }
    }

    /**
     * Drop event
     *
     * @param event
     *
     * Calls props.onDrop event
     */
    const onDrop = (event) => {
        cancelEvent(event)
        setState.dragging.active = false

        const list = []
        for (const file of event.dataTransfer.files) {
            const tmp = validate(file)
            list.push({
                          file:   file,
                          status: tmp.status,
                          error:  tmp.error,
                      })
        }

        // Check if  all are ok or wrong or only some of them
        let allTrue = list.every(item => item.status === true)
        let allFalse = list.every(item => item.status === false)

        // The set state and error messages accordingly
        if (allTrue) {
            setState.accepted = DRAG_AND_DROP_FILE_ACCEPTED
        }
        else if (allFalse) {
            setState.accepted = DRAG_AND_DROP_FILE_REJECTED
            setState.error = IMPROPER_FORMAT
        }
        else {
            setState.accepted = DRAG_AND_DROP_FILE_PARTIALLY
            setState.error = SOME_IMPROPER_FORMAT
        }

        setTimeout(() => {
            console.log('ok')
            setState.accepted = DRAG_AND_DROP_FILE_WAITING
        }, 3000)

    }

    /**
     * Drag enter event
     *
     * @param event
     *
     * Calls props.onDragEnter event
     */
    const onChange = (event) => {
        cancelEvent(event)
        setState.dragging.active = false
        if (event.target.files && event.target.files[0]) {
            // handleFiles(event.target.file
        }
    }

    /**
     * Validate file
     *
     * The only test done here consists of testing the extendion.
     * Other can be done in  props.validate functopn that returns {status:boolean,error:message}
     *
     * @param file
     *
     * @return {{error: string, status: boolean}}
     */
    const validate = (file) => {
        let check = {status: true, message: ''}
        if (props.types.includes(FileUtils.getExtension(file.name))) {
            if (props.validate) {
                check = props.validate(file)
            }
        }
        else {
            check.status = false
            check.error = IMPROPER_FORMAT
        }

        return check
    }

    // triggers the input when the button is clicked
    const launchFilesSelector = (event) => {
        inputRef.current.click()
        cancelEvent(event)
    }

    return (
        <>
            <input ref={inputRef} type="file"
                   accept={acceptedTypes}
                   id="drag-and-drop-input-file-upload"
                   multiple={props.multiple}
                   onChange={onChange}
                   style={{display: 'none'}}
            />
            <div id={id}
                 style={{width: '100%', 'height': '100%'}}
                 className={getState.dragging.active ? `${classes} drag-active` : classes}
                 onClick={launchFilesSelector}
                 onDragEnter={onDragEnter}
                 onDragLeave={onDragLeave}
                 onDragEnd={onDragEnd}
                 onDragOver={onDragOver}
                 onDrop={onDrop}
                 onDragStart={onDragStart}
            >
                {props.children}
            </div>
        </>
    )
}