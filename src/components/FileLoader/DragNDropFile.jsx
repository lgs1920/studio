import { useEffect, useRef } from 'react'
import { useSnapshot }       from 'valtio'
import {
    DRAG_AND_DROP_FILE_ACCEPTED, DRAG_AND_DROP_FILE_PARTIALLY, DRAG_AND_DROP_FILE_REJECTED, DRAG_AND_DROP_FILE_WAITING,
    DRAG_AND_DROP_STATUS_DELAY, FileUtils,
}                            from '../../Utils/FileUtils'

/**
 * From : https://www.codemzy.com/blog/react-drag-drop-file-upload
 *
 * @return {JSX.Element}
 * @constructor
 */

export const DragNDropFile = (props) => {

    const setState = lgs.mainProxy.components.fileLoader
    const getState = useSnapshot(setState)
    var fileList = setState.fileList

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
        setState.dragging.active = true
        if (props.onDragStart) {
            props.onDragStart()
        }
    }

    /**
     * Window Drag Enter event
     *
     * @param event
     */
    const onWindowDragEnter = (event) => {
        cancelEvent(event)
        if (props.detectWindowDrag) {
            setState.dragging.active = true
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
        if (!props.detectWindowDrag) {
            setState.dragging.active = true
        }
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
     * Window Drag Leave event
     *
     * @param event
     */
    const onWindowDragLeave = (event) => {
        cancelEvent(event)
        if (props.detectWindowDrag) {
            setState.dragging.active = false
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
        if (!props.detectWindowDrag) {
            setState.dragging.active = false
        }

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

        if (props.types.includes(fileInfo.extension)) {
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

    /**
     * Validate file selection
     *
     * @param event  (change or drop)
     *
     * Calls props.onDrop or props.onChnge callbacls
     */
    const validateSelection = (event) => {
        cancelEvent(event)
        setState.dragging.active = false

        const DROP   = 'drop',
              CHANGE = 'change'

        const list = new Map()
        // Get file from event
        const files = event.type === DROP
                      ? event.dataTransfer.files
                      : event.target.files

        for (const file of files) {
            const tmp = validate(file)
            list.set(__.app.slugify(file.name),
                     {
                              file:   {
                                  date: file.lastModified,
                                  fullName:  file.name,
                                  name:      tmp.file.name,
                                  extension: tmp.file.extension,
                                  type: file.type,
                                  size: file.size,
                              },
                         validated: tmp.validated,
                              error:  tmp.error,
                     }
            )

        }
        if (list.size >0) {
            // Add to existing file list
            list.forEach((item,key)=>{
                fileList.set(key,item)
            })

            // Use callback if defined
            if (event.type === DROP && props.onDrop) {
                props.onDrop(list)
            }
            if (event.type === CHANGE && props.onChange) {
                props.onChange(list)
            }

            // Check if  all are ok or wrong or only some of them
            let allTrue = Array.from(list.values()).every(item => item.validated === true)
            let allFalse = Array.from(list.values()).every(item => item.validated === false)

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

            // After a delay, return to normal state
            setTimeout(() => {
                setState.accepted = DRAG_AND_DROP_FILE_WAITING
            }, DRAG_AND_DROP_STATUS_DELAY)

            // Read and manage content
            for (const file of files) {
                const item = fileList.get(__.app.slugify(file.name))
                item.fileReadSuccess = false

                try {
                    if(item.validated) {
                        FileUtils.readFileAsText(file, props.manageContent ?? null)
                        item.fileReadSuccess = true
                    }
                }
                catch {
                    item.fileReadSuccess = false
                }

                fileList.set(__.app.slugify(file.name), item)
            }




        }
    }

    /**
     * Drop event
     *
     * @param event
     *
     */
    const onDrop = validateSelection

    /**
     * Drag enter event
     *
     * @param event
     *
     */
    const onChange = validateSelection


    // triggers the input when the drop zone is clicked
    const launchFilesSelector = (event) => {
        inputRef.current.click()
        cancelEvent(event)
    }

    /**
     *
     */
    useEffect(() => {
        window.addEventListener('dragenter', onWindowDragEnter)
        window.addEventListener('dragleave', onWindowDragLeave)
        window.addEventListener('dragend', onWindowDragLeave)
        // return () => {
        //     window.removeEventListener('dragenter', onWindowDragEnter);
        //     window.removeEventListener('dragleave', onWindowDragLeave);
        //     window.removeEventListener('dragend', onWindowDragLeave);
        //
        // }
    }, [])


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