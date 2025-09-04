/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-04
 * Last modified: 2025-09-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoDownloadAndShareDialog  component for previewing and downloading recorded videos
 * @returns {JSX.Element} Video preview dialog with download options
 */
import { LGSScrollbars }                                                from '@Components/MainUI/LGSScrollbars'
import { APP_KEY }                                                      from '@Core/constants'
import { VideoConverter }                                               from '@Core/ui/video/converter/VideoConverter'
import { VideoRecorder }                                                from '@Core/ui/video/recorder/VideoRecorder'
import { faDownload, faXmark, faShareAlt, faFilm }                      from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon, SlIconButton, SlInput, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                        from '@Utils/FA2SL'
import { useCallback, useEffect, useRef, useState }                     from 'react'
import { useSnapshot }                                                  from 'valtio/index'
import './style.css'


export const VideoDownloadAndShareDialog = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const [dialogOpen, setDialogOPen] = useState(false)
    const _converter = useRef(null)
    const _mainVideo = useRef(null)
    const _blurredVideo = useRef(null)
    const _videoBlob = useRef({})
    const [filename, setFilename] = useState('')

    /**
     * Initialize VideoConverter and handle stop recording event
     */
    useEffect(() => {
        const handleStopRecording = ({detail: {blob, metadata, duration, totalBytes, timestamp}}) => {
            if (!(blob instanceof Blob) || blob.size === 0) {
                console.error(`Error: Invalid video blob (type: ${blob?.type}, size: ${blob?.size})`)
                return
            }
            const url = URL.createObjectURL(blob)
            _videoBlob.current = {
                blob:     blob,
                filename: __.recorder.filename({}),
            }
            setFilename(_videoBlob.current.filename)

            setDialogOPen(true)

            console.log(`Video blob received: type=${blob.type}, size=${(blob.size / 1000000).toFixed(2)}MB`)
        }
        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStopRecording)

        return () => {
            __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStopRecording)
            // Removed URL.revokeObjectURL for video.conversion.videoUrl and convertedVideoUrl
            if (_converter.current) {
                _converter.current.destroy()
                _converter.current = null
            }
        }
    }, [])

    /**
     * Synchronize blurred video with main video and start playback
     */
    useEffect(() => {
        const mainVideo = _mainVideo.current
        const blurredVideo = _blurredVideo.current

        // Removed condition checking video.conversion.videoUrl and convertedVideoUrl
        if (!mainVideo || !blurredVideo) {
            return
        }

        const syncVideos = () => {
            blurredVideo.currentTime = mainVideo.currentTime
        }

        const handlePlay = () => {
            blurredVideo.play().catch((error) => {
                // Removed setConversionLogs and video.conversion.errorMessage
                console.log(`Error playing blurred video: ${error.message}`)
            })
        }

        const handlePause = () => {
            blurredVideo.pause()
        }

        mainVideo.play().catch((error) => {
            // Removed setConversionLogs and video.conversion.errorMessage
            console.log(`Error playing main video: ${error.message}`)
        })

        mainVideo.addEventListener('play', handlePlay)
        mainVideo.addEventListener('pause', handlePause)
        mainVideo.addEventListener('timeupdate', syncVideos)

        return () => {
            mainVideo.removeEventListener('play', handlePlay)
            mainVideo.removeEventListener('pause', handlePause)
            mainVideo.removeEventListener('timeupdate', syncVideos)
        }
    }, [])


    /**
     * Handle filename input changes
     */
    const handleFilenameChange = (e) => {
        _videoBlob.current.filename = e.target.value
        if (_videoBlob.current.filename.length === 0) {
            _videoBlob.current.filename = __.recorder.filename({filename: APP_KEY})
        }
        setFilename(_videoBlob.current.filename)

    }

    /**
     * Handle share action
     */
    const handleShare = useCallback(async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                                          title: 'LGS1920 Studio Video',
                                          text:  'Check out my video created with LGS1920 Studio!',
                                          // Removed video.conversion.convertedVideoUrl
                                          url: '',
                                      })
            }
        }
        catch (error) {
            // Removed video.conversion.errorMessage
            console.log(`Error during share: ${error.message}`)
        }
    }, [])

    /**
     * Handle save action with download
     */
    const handleDownload = async () => {
        if (!_videoBlob.current || !_videoBlob.current.blob || !(_videoBlob.current.blob instanceof Blob) || _videoBlob.current.blob.size === 0) {
            // Removed setConversionLogs and video.conversion.errorMessage
            console.log('Error: Invalid video blob')
            return
        }

        try {
            let finalBlob = _videoBlob.current.blob
            // Removed video.conversion.convertedVideoUrl and isConverted
            const mimeType = 'video/webm' // Fallback MIME type
            const url = URL.createObjectURL(new Blob([finalBlob], {type: mimeType}))
            const link = document.createElement('a')
            link.href = url
            link.download = _videoBlob.current.filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
        catch (error) {
            // Removed video.conversion.errorMessage
            console.log(`Error during download: ${error.message}`)
        }
    }

    /**
     * Handle cancel action
     */
    const handleCancel = () => {

        // Removed URL.revokeObjectURL for video.conversion.videoUrl and convertedVideoUrl
        setDialogOPen(false)
        _videoBlob.current = {}
    }

    /**
     * Handle continue action after download
     */
    const handleContinue = useCallback(() => {
        // Removed video.conversion.isDialogOpen, videoUrl, convertedVideoUrl, isConverted, isConverting,
        // progress.percentage, errorMessage
        __.recorder.filename = ''
        // Removed URL.revokeObjectURL for video.conversion.videoUrl and convertedVideoUrl
        $video.editing = false
        console.log('Dialog closed after conversion')
    }, [$video])

    /**
     * Handle dialog close event to prevent closing via ESC or overlay
     */
    const handleDialogClose = useCallback(
        (event) => {
            if (event.detail?.source === 'close-button') {
                handleCancel()
            }
            else {
                event.preventDefault() // Prevent closing via ESC or overlay
            }
        },
        [handleCancel],
    )

    return (
        <SlDialog
            id="video-preview-dialog"
            open={dialogOpen}
            onSlRequestClose={handleDialogClose}
            className="lgs-theme"
        >
            <div slot="label">
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFilm)}/>
                {'Download your video'}
            </div>

            {/* Removed condition for video.conversion.videoUrl || convertedVideoUrl */}
            <div className="video-container">
                <video
                    ref={_mainVideo}
                    controls
                    autoPlay
                    // Removed src related to video.conversion.videoUrl or convertedVideoUrl
                    className="main-video"
                />
                <div className="blurred-video-wrapper">
                    <video
                        ref={_blurredVideo}
                        // Removed src related to video.conversion.videoUrl or convertedVideoUrl
                        className="blurred-video"
                        muted
                        autoPlay
                    />
                </div>
            </div>
            <LGSScrollbars autoHide autoHeight>
                <SlInput
                    label={'Video file name'}
                    size="small"
                    name="video-file-name"
                    value={_videoBlob.current.filename || ''}
                    onSlInput={handleFilenameChange}
                >
                    <div slot="suffix">{`.${lgs.settings.ui.video.format}`}</div>
                </SlInput>
            </LGSScrollbars>
            <div slot="footer" id="video-preview-dialog-footer">
                <SlTooltip content={'Cancel'}>
                    <SlButton onClick={handleCancel}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                        {'Cancel'}
                    </SlButton>
                </SlTooltip>
                <SlTooltip content="Share your video">
                    <SlIconButton
                        library="fa"
                        name={FA2SL.set(faShareAlt)}
                        onClick={handleShare}
                    />
                </SlTooltip>
                <SlTooltip content={'Save your video.'}>
                    <SlButton
                        variant="primary"
                        onClick={handleDownload}
                    >
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDownload)}/>
                        {'Download'}
                    </SlButton>
                </SlTooltip>
            </div>
        </SlDialog>
    )
}