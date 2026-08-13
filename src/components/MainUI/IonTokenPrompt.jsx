/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: IonTokenPrompt.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-24
 * Last modified: 2026-06-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { UIToast } from '@Utils/UIToast'
import { LGSScrollbars }                                             from '@Components/MainUI/LGSScrollbars'
import { WaButton, WaCallout, WaDialog, WaDivider, WaIcon, WaInput } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef, useState }                               from 'react'
import { useSnapshot } from 'valtio'
import { default as ReactMarkdown } from 'react-markdown'
import { markdown as ionTokenHelp } from '../../assets/ion-token-help.md'

const formatDelay = (seconds) => {
    const total = Number(seconds)
    if (!Number.isFinite(total) || total <= 0) {
        return '8 minutes'
    }

    if (total % 60 === 0) {
        const minutes = total / 60
        return `${minutes} minute${minutes > 1 ? 's' : ''}`
    }

    return `${total} second${total > 1 ? 's' : ''}`
}

const formatUsage = (seconds) => {
    const total = Math.max(Math.floor(Number(seconds) || 0), 0)
    const minutes = Math.floor(total / 60)
    const rest = String(total % 60).padStart(2, '0')
    return `${String(minutes).padStart(2, '0')}:${rest}`
}

const openCesiumIon = () => window.open('https://ion.cesium.com/', '_blank', 'noopener,noreferrer')

const restoreCesiumFocus = () => {
    const canvas = lgs.viewer?.canvas
    const focusTarget = canvas ?? document.body
    requestAnimationFrame(() => {
        document.activeElement?.blur?.()
        focusTarget?.focus?.({preventScroll: true})
    })
}

const PromptBody = ({mode, delayLabel, remainingLabel, inputRef, setCanSave, openHelp}) => {
    if (mode === 'intro') {
        return (
            <>
                <WaCallout open variant="neutral" appearance="filled-outlined">
                    <WaIcon slot="icon" name="circle-info" variant="regular"/>
                    {`LGS1920 uses Cesium Ion to access hosted geospatial layers. The shared access is limited to ${delayLabel} so everyone can keep using the application. A free Cesium account gives you your own quota, and paid plans exist if you need more usage.`}
                </WaCallout>

                <WaInput
                    ref={inputRef}
                    appearance="filled"
                    type="password"
                    password-toggle
                    autocomplete="off"
                    placeholder={'Paste your Cesium Ion token'}
                    defaultValue=""
                    onInput={() => {
                        setCanSave((inputRef.current?.value ?? '').trim() !== '')
                    }}
                />

            </>
        )
    }

    if (mode === 'invalid') {
        return (
            <>
                <WaCallout open variant="danger" appearance="filled-outlined">
                    <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
                    {'The stored Cesium Ion token is invalid.'}
                </WaCallout>
                <br/>
                {'Please enter another token to keep using Cesium assets in the app.'}<br/>
                {'The shared token is active again for now, but you should replace the broken token.'}<br/>
                <WaInput
                    ref={inputRef}
                    appearance="filled"
                    type="password"
                    password-toggle
                    autocomplete="off"
                    placeholder={'Paste your Cesium Ion token'}
                    defaultValue=""
                    onInput={() => {
                        setCanSave((inputRef.current?.value ?? '').trim() !== '')
                    }}
                />
            </>
        )
    }

    if (mode === 'blocked') {
        return (
            <>
                <WaCallout open variant="danger" appearance="filled-outlined">
                    <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
                    {'Sorry, the shared Cesium Ion allowance is exhausted.'}

                </WaCallout>
                <br/>
                {'Please enter your own Cesium Ion token to continue using the app.'}<br/>
                {'If you don\'t have one yet, you can create a free Cesium account, which will allow you to use your own token to continue using the app freely.'}<br/>
                {'With your token, you\'ll have access to your own quotas and other options associated with your Cesium account.'}<br/>

                <div style={{display: 'flex', justifyContent: 'flex-end', marginRight: '0.5rem'}}>
                    <WaButton appearance="filled" variant="brand" size="s" type="button" style={{width: 'fit-content'}} onClick={openHelp}>
                        {'More info ...'}
                    </WaButton>
                </div>
                <br/>
                <WaCallout open appearance="outlined">
                    <WaIcon slot="icon" name="notes-sticky" variant="regular"/>
                    {'Note: We are in no way affiliated with Cesium, other than on a technical level.'}</WaCallout><br/><br/>
                <WaInput
                    ref={inputRef}
                    appearance="filled"
                    type="password"
                    password-toggle
                    autocomplete="off"
                    placeholder={'Paste your Cesium Ion token'}
                    defaultValue=""
                    onInput={() => {
                        setCanSave((inputRef.current?.value ?? '').trim() !== '')
                    }}
                />
                <br/>

            </>
        )
    }

    return (
        <>
            <WaCallout open variant="warning" appearance="filled-outlined">
                <WaIcon slot="icon" name="warning" variant="regular"/>
                {`The shared Cesium Ion token is temporary.`}<br/>{`${remainingLabel} remain on the shared allowance out of ${delayLabel}.`}
            </WaCallout>

            <WaInput
                ref={inputRef}
                appearance="filled"
                type="password"
                password-toggle
                autocomplete="off"
                placeholder={'Paste your Cesium Ion token'}
                defaultValue=""
                onInput={() => {
                    setCanSave((inputRef.current?.value ?? '').trim() !== '')
                }}
            />

        </>
    )
}

export const IonTokenPrompt = () => {
    const inputRef = useRef(null)
    const didSaveRef = useRef(false)
    const [canSave, setCanSave] = useState(false)
    const [helpOpen, setHelpOpen] = useState(false)
    const [liveTick, setLiveTick] = useState(0)
    const ion = useSnapshot(lgs.stores.ion)
    const delayLabel = formatDelay(ion.promptDelaySeconds)
    const remainingSeconds = Math.max(Number(ion.promptDelaySeconds ?? 0) - Number(ion.accumulatedSeconds ?? 0), 0)
    const remainingLabel = formatUsage(remainingSeconds)
    const mode = ion.showPrompt ? (ion.promptMode ?? 'quota') : null
    const isBlocking = mode === 'blocked'

    useEffect(() => {
        if (!ion.showPrompt) {
            if (inputRef.current) {
                inputRef.current.value = ''
            }
            return
        }

        const raf = requestAnimationFrame(() => {
            inputRef.current?.focus?.()
            inputRef.current?.select?.()
        })

        return () => cancelAnimationFrame(raf)
    }, [ion.showPrompt, mode])

    useEffect(() => {
        if (!ion.showPrompt) {
            return undefined
        }

        const timer = window.setInterval(() => {
            setLiveTick(value => value + 1)
        }, 1000)

        return () => window.clearInterval(timer)
    }, [ion.showPrompt])

    const closePrompt = async () => {
        didSaveRef.current = false
        setCanSave(false)

        if (mode === 'intro') {
            await __.ui.ionTokenManager.markIntroSeen?.()
            restoreCesiumFocus()
            return
        }

        __.ui.ionTokenManager.dismissForSession()
        restoreCesiumFocus()
    }

    const handleHide = (event) => {
        const currentIon = lgs.stores.ion

        if (currentIon.source === 'default' && currentIon.promptMode === 'blocked') {
            event.preventDefault()
            return
        }

        if (currentIon.showPrompt) {
            void closePrompt()
        }
    }

    const handleLater = () => {
        void closePrompt()
    }

    const handleCreateNow = async () => {
        if (mode === 'intro' || mode === 'blocked') {
            await __.ui.ionTokenManager.markIntroSeen?.()
        }

        openCesiumIon()
    }

    const handleSave = async () => {
        try {
            didSaveRef.current = true
            const nextToken = await __.ui.ionTokenManager.save(inputRef.current?.value ?? '')
            if (inputRef.current) {
                inputRef.current.value = nextToken
            }
            setCanSave(false)
            UIToast.success({
                                caption: 'Cesium Ion token',
                                text:    'Your personal token has been saved.',
                            })
        }
        catch (error) {
            didSaveRef.current = false
            if (inputRef.current) {
                inputRef.current.value = ''
                inputRef.current.focus?.()
            }
            setCanSave(false)
            UIToast.error({
                              caption: 'Cesium Ion token',
                              text:    error.message,
                          })
        }
    }

    const openHelp = () => {
        setHelpOpen(true)
    }

    const closeHelp = () => {
        setHelpOpen(false)
    }

    return (
        <WaDialog
            label={helpOpen
                   ? 'Cesium Ion help'
                   : mode === 'intro'
                     ? 'Cesium Ion access'
                     : mode === 'invalid'
                       ? 'Cesium Ion token invalid'
                     : mode === 'blocked'
                       ? 'Cesium Ion allowance exhausted'
                       : 'Cesium Ion access'}
            open={ion.showPrompt}
            className={'lgs-theme'}
            lightDismiss={!isBlocking && !helpOpen}
            onWaHide={handleHide}
            onWaAfterHide={() => {
                setHelpOpen(false)
                if (!didSaveRef.current && mode !== 'intro' && !isBlocking) {
                    __.ui.ionTokenManager.dismissForSession()
                }
                restoreCesiumFocus()
                didSaveRef.current = false
            }}
        >
            <div className="ion-token-prompt" data-live-tick={liveTick}>
                {helpOpen ? (
                    <div className="ion-token-help-scroll">
                        <LGSScrollbars>
                            <div className="ion-token-help-content wa-prose">
                                <ReactMarkdown children={ionTokenHelp}/>
                            </div>
                        </LGSScrollbars>
                    </div>
                ) : (
                    <PromptBody
                        mode={mode}
                        delayLabel={delayLabel}
                        remainingLabel={remainingLabel}
                        inputRef={inputRef}
                        setCanSave={setCanSave}
                        openHelp={openHelp}
                    />
                )}
                <WaDivider/>
                {helpOpen ? (
                    <div className="ion-token-prompt-actions">
                        <WaButton appearance="outlined" variant="brand" type="button" onClick={closeHelp}>
                            <WaIcon slot="start" name="xmark" variant="regular"/>
                            {'Close'}
                        </WaButton>
                    </div>
                ) : (
                    <div className="ion-token-prompt-actions" slot="footer">
                        <WaButton appearance="outlined" variant="brand" type="button" onClick={handleCreateNow}>
                            <WaIcon slot="start" name="arrow-up-right-from-square" variant="regular"/>
                            {'Create Cesium Account'}
                        </WaButton>

                        {!isBlocking && (
                            <WaButton appearance="outlined" type="button" onClick={handleLater}>
                                <WaIcon slot="start" name="clock" variant="regular"/>
                                {'Later'}
                            </WaButton>
                        )}



                        <WaButton variant="brand" type="button" onClick={handleSave} disabled={!canSave}>
                            <WaIcon slot="start" name="check" variant="regular"/>
                            {'Save token'}
                        </WaButton>
                    </div>
                )}
            </div>
        </WaDialog>
    )
}
