import React, {useCallback} from 'react'
import {useDropzone}        from 'react-dropzone'

export function DropZoneUI(props) {
    const onDrop = useCallback((acceptedFiles) => {
        acceptedFiles.forEach((file) => {
            const reader = new FileReader()

            reader.onabort = () => console.error('file reading was aborted')
            reader.onerror = () => console.error('file reading has failed')
            reader.onload = () => {
                // Do whatever you want with the file contents
                const binaryStr = reader.result
            }
            reader.readAsArrayBuffer(file)
        })

    }, [])
    const {getRootProps, getInputProps} = useDropzone({onDrop})
    const id = props.id ? `id="${props.id}"` : ''
    return (
        <div id={props.id} {...getRootProps()}>
            <input {...getInputProps({
                noClick: false,
                'aria-label': 'drag and drop area',
            })} />
            <p>Drag 'n' drop some files here, or click to select files</p>
        </div>
    )
}