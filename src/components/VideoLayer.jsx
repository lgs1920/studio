/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoLayer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-04
 * Last modified: 2025-07-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { useState, useEffect } from 'react'

export const VideoLayer = ({isVisible, videoSrc, displayDuration = 10000}) => {
    const [showVideo, setShowVideo] = useState(isVisible)

    useEffect(() => {
        setShowVideo(isVisible) // Sync with isVisible prop
        if (isVisible && displayDuration) {
            const timer = setTimeout(() => {
                setShowVideo(false)
            }, displayDuration)
            return () => clearTimeout(timer) // Cleanup timer on unmount or prop change
        }
    }, [isVisible, displayDuration])

    if (!showVideo) {
        return null
    }

    return (
        <div className="video-layer">
            <video autoPlay loop muted>
                <source src={videoSrc} type="video/mp4"/>
                Your browser does not support the video tag.
            </video>
        </div>
    );
};
