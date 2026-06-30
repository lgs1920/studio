/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: IonTokenManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-23
 * Last modified on: 2026-06-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SETTINGS_STORE, VAULT_STORE } from '@Core/constants'
import { ION_DEFAULT_PROMPT_DELAY_SECONDS, ion } from '@Core/stores/ion'
import { IonLayerUtils } from '@Utils/cesium/IonLayerUtils'
import * as Cesium from 'cesium'

const ION_TOKEN_KEY = 'cesium_ion_token'
const ION_SETTINGS_SECTION = 'ion'
const ION_SHARED_TOKEN_KEY = 'sharedToken'
const ION_USAGE_KEY = 'usageSeconds'
const ION_INTRO_SEEN_KEY = 'introSeen'
const ION_LEGACY_USAGE_KEY = 'cesium_ion_token_usage_seconds'
const ION_LEGACY_INTRO_SEEN_KEY = 'cesium_ion_intro_seen'
const DEFAULT_PERSIST_INTERVAL_SECONDS = 10
const TICK_INTERVAL_MS = 1000
const IDLE_PAUSE_MS = 5000
const DEFAULT_WARNING_PERCENT = 80
const ION_TOKEN_VALIDATION_URL = 'https://api.cesium.com/v1/assets?limit=1'
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll']

const normalizeToken = value => typeof value === 'string' ? value.trim() : ''
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const getRuntimeIonSettings = () => {
    const settingsIon = globalThis.lgs?.settings?.ion
    if (isObject(settingsIon)) {
        return settingsIon
    }

    const configurationIon = globalThis.lgs?.configuration?.ion
    return isObject(configurationIon) ? configurationIon : {}
}
const defaultIonToken = () => {
    const ionSettings = getRuntimeIonSettings()
    return normalizeToken(
        ionSettings[ION_SHARED_TOKEN_KEY]
        ?? ionSettings.defaultToken
        ?? ionSettings.token
        ?? globalThis.lgs?.configuration?.ionToken,
    )
}

const normalizeDelaySeconds = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : ION_DEFAULT_PROMPT_DELAY_SECONDS
}

const normalizePercent = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? Math.min(Math.floor(numeric), 100) : DEFAULT_WARNING_PERCENT
}

const normalizeBoolean = value => value === true || value === 'true' || value === 1 || value === '1'
const getIonState = () => globalThis.lgs?.stores?.ion ?? ion

export class IonTokenManager {
    #loadPromise = null
    #tickHandle = null
    #listenersAttached = false
    #persistCountdown = DEFAULT_PERSIST_INTERVAL_SECONDS
    #lastActivityAt = 0
    #appFocused = true

    #persistOnPageHide = () => {
        getIonState().timerActive = false
        void this.persistUsage()
    }

    #handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            getIonState().timerActive = false
            void this.persistUsage()
            return
        }

        this.#markActivity()
    }

    #handleFocus = () => {
        this.#appFocused = true
        this.#markActivity()
    }

    #handleBlur = () => {
        this.#appFocused = false
        this.#syncTimerActiveState()
        void this.persistUsage()
    }

    #handleActivity = () => {
        this.#markActivity()
    }

    #attachListeners = () => {
        if (this.#listenersAttached || typeof window === 'undefined') {
            return
        }

        this.#listenersAttached = true
        window.addEventListener('pagehide', this.#persistOnPageHide)
        window.addEventListener('beforeunload', this.#persistOnPageHide)
        window.addEventListener('focus', this.#handleFocus)
        window.addEventListener('blur', this.#handleBlur)
        document.addEventListener('visibilitychange', this.#handleVisibilityChange)
        for (const eventName of ACTIVITY_EVENTS) {
            window.addEventListener(eventName, this.#handleActivity, {passive: true})
        }
    }

    #detachListeners = () => {
        if (!this.#listenersAttached || typeof window === 'undefined') {
            return
        }

        this.#listenersAttached = false
        window.removeEventListener('pagehide', this.#persistOnPageHide)
        window.removeEventListener('beforeunload', this.#persistOnPageHide)
        window.removeEventListener('focus', this.#handleFocus)
        window.removeEventListener('blur', this.#handleBlur)
        document.removeEventListener('visibilitychange', this.#handleVisibilityChange)
        for (const eventName of ACTIVITY_EVENTS) {
            window.removeEventListener(eventName, this.#handleActivity)
        }
    }

    #documentVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

    #hasFocus = () => {
        if (!this.#appFocused) {
            return false
        }

        return typeof document !== 'undefined' && typeof document.hasFocus === 'function' ? document.hasFocus() : true
    }

    #canCountUsage = () => {
        const state = getIonState()
        const continuousUsage = this.#hasContinuousUsageActivity()

        return state.source === 'default'
            && this.#documentVisible()
            && (continuousUsage || (this.#hasFocus() && Date.now() - this.#lastActivityAt < IDLE_PAUSE_MS))
    }

    #hasContinuousUsageActivity = () => {
        const stores = globalThis.lgs?.stores
        const flythrough = stores?.flythrough
        const video = stores?.ui?.video

        return flythrough?.active === true
            || flythrough?.playing === true
            || flythrough?.paused === true
            || flythrough?.recordingSync === true
            || flythrough?.clipSequenceActive === true
            || video?.recording === true
            || video?.preRecording === true
            || video?.snapshot === true
            || video?.finalizing === true
    }

    #syncTimerActiveState = () => {
        const active = this.#canCountUsage()
        getIonState().timerActive = active
        return active
    }

    #markActivity = () => {
        if (getIonState().source !== 'default') {
            getIonState().timerActive = false
            return
        }

        this.#lastActivityAt = Date.now()
        this.#syncTimerActiveState()
    }

    #readIonSettingsSection = async () => {
        const runtimeSettings = getRuntimeIonSettings()
        const storedSettings = await lgs.db?.settings?.get?.(ION_SETTINGS_SECTION, SETTINGS_STORE)

        return {
            ...(isObject(lgs.configuration?.ion) ? lgs.configuration.ion : {}),
            ...(isObject(storedSettings) ? storedSettings : {}),
            ...(isObject(runtimeSettings) ? runtimeSettings : {}),
        }
    }

    #writeIonSettingsSection = async (patch) => {
        const currentSettings = await this.#readIonSettingsSection()
        const nextSettings = {...currentSettings, ...patch}
        const runtimeSettings = getRuntimeIonSettings()

        if (isObject(runtimeSettings)) {
            Object.assign(runtimeSettings, patch)
        }
        if (isObject(lgs.configuration?.ion)) {
            Object.assign(lgs.configuration.ion, patch)
        }
        else if (isObject(lgs.configuration)) {
            lgs.configuration.ion = {...patch}
        }

        await lgs.db?.settings?.put?.(
            ION_SETTINGS_SECTION,
            JSON.parse(JSON.stringify(nextSettings)),
            SETTINGS_STORE,
        )
    }

    #deleteLegacyManagementValue = async (legacyKey) => {
        await lgs.db?.settings?.delete?.(legacyKey, SETTINGS_STORE)
        await lgs.db?.vault?.delete?.(legacyKey, VAULT_STORE)
    }

    #readManagementValue = async (key, legacyKey) => {
        const ionSettings = await this.#readIonSettingsSection()
        const settingsValue = ionSettings[key]
        const legacySettingsValue = await lgs.db?.settings?.get?.(legacyKey, SETTINGS_STORE)
        const legacyVaultValue = await lgs.db?.vault?.get?.(legacyKey, VAULT_STORE)
        const hasSettingsValue = settingsValue !== undefined && settingsValue !== null
        const hasLegacySettingsValue = legacySettingsValue !== undefined && legacySettingsValue !== null
        const hasLegacyVaultValue = legacyVaultValue !== undefined && legacyVaultValue !== null

        const legacyValue = hasLegacySettingsValue ? legacySettingsValue : legacyVaultValue

        if (!hasSettingsValue && (hasLegacySettingsValue || hasLegacyVaultValue)) {
            await this.#writeIonSettingsSection({[key]: legacyValue})
        }

        if (hasLegacySettingsValue || hasLegacyVaultValue) {
            await this.#deleteLegacyManagementValue(legacyKey)
        }

        return hasSettingsValue ? settingsValue : legacyValue
    }

    #writeManagementValue = async (key, value, legacyKey) => {
        await this.#writeIonSettingsSection({[key]: value})
        await this.#deleteLegacyManagementValue(legacyKey)
    }

    #validateToken = async (token) => {
        if (typeof fetch !== 'function') {
            return
        }

        const controller = typeof AbortController === 'function' ? new AbortController() : null
        const timeout = controller ? globalThis.setTimeout(() => controller.abort(), 8000) : null

        try {
            const response = await fetch(ION_TOKEN_VALIDATION_URL, {
                method:  'GET',
                headers: {
                    Accept:        'application/json',
                    Authorization: `Bearer ${token}`,
                },
                signal: controller?.signal,
            })

            if (response.ok) {
                return
            }

            let details = ''
            try {
                details = (await response.json())?.message ?? ''
            }
            catch {
                details = ''
            }

            const suffix = details ? `: ${details}` : ''
            throw new Error(`The Cesium Ion token could not be validated${suffix}.`, {cause: response})
        }
        catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error('The Cesium Ion token validation timed out.', {cause: error})
            }
            if (error instanceof Error && error.cause === undefined) {
                throw new Error(error.message, {cause: error})
            }
            throw error
        }
        finally {
            if (timeout !== null) {
                globalThis.clearTimeout(timeout)
            }
        }
    }

    #deleteManagementValue = async (key, value, legacyKey) => {
        await this.#writeManagementValue(key, value, legacyKey)
    }

    get promptDelaySeconds() {
        return normalizeDelaySeconds(getRuntimeIonSettings().promptDelaySeconds)
    }

    get promptWarningPercent() {
        return normalizePercent(getRuntimeIonSettings().promptWarningPercent)
    }

    get sharedToken() {
        return defaultIonToken()
    }

    get isUsingDefaultToken() {
        return getIonState().source === 'default'
    }

    #applyState = ({token, source}) => {
        const state = getIonState()
        Cesium.Ion.defaultAccessToken = token
        state.token = token
        state.source = source
        state.promptDelaySeconds = this.promptDelaySeconds
        state.promptWarningPercent = this.promptWarningPercent
    }

    #sanitizeUsage = usage => {
        const numeric = Number(usage)
        return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0
    }

    #syncPromptState = () => {
        const state = getIonState()
        state.promptDelaySeconds = this.promptDelaySeconds
        state.promptWarningPercent = this.promptWarningPercent

        if (state.source !== 'default') {
            state.showPrompt = false
            state.promptMode = null
            return
        }

        const totalSeconds = this.promptDelaySeconds
        const warningSeconds = Math.max(Math.floor((totalSeconds * this.promptWarningPercent) / 100), 1)
        const usage = Number(state.accumulatedSeconds ?? 0)

        if (usage >= totalSeconds) {
            state.promptMode = 'blocked'
            state.showPrompt = true
            return
        }

        if (usage >= warningSeconds) {
            state.promptMode = 'quota'
            state.showPrompt = state.dismissedThisSession !== true
            return
        }

        if (state.introSeen !== true && usage === 0) {
            state.promptMode = 'intro'
            state.showPrompt = true
            return
        }

        state.promptMode = null
        state.showPrompt = false
    }

    load = async () => {
        if (this.#loadPromise) {
            return this.#loadPromise
        }

        this.#loadPromise = (async () => {
            this.#attachListeners()
            await this.stopPromptTimer({persist: false})

            const state = getIonState()
            state.loaded = false
            state.showPrompt = false
            state.dismissedThisSession = false
            state.promptMode = null
            state.introSeen = false

            let storedToken = null
            let storedUsage = 0
            let storedIntroSeen = false

            try {
                const tokenValue = await lgs.db?.vault?.get?.(ION_TOKEN_KEY, VAULT_STORE)
                const usageValue = await this.#readManagementValue(ION_USAGE_KEY, ION_LEGACY_USAGE_KEY)
                const introSeenValue = await this.#readManagementValue(ION_INTRO_SEEN_KEY, ION_LEGACY_INTRO_SEEN_KEY)

                storedToken = normalizeToken(tokenValue)
                storedUsage = this.#sanitizeUsage(usageValue)
                storedIntroSeen = normalizeBoolean(introSeenValue)
            }
            catch (error) {
                console.error('[IonTokenManager] Failed to load Ion token state:', error)
            }

            state.accumulatedSeconds = storedUsage
            state.introSeen = storedIntroSeen
            state.loaded = true

            if (storedToken !== '') {
                this.#applyState({
                                     token:  storedToken,
                                     source: 'user',
                                 })
                await IonLayerUtils.syncCesiumCache(storedToken)
                state.showPrompt = false
                state.promptMode = null
                state.dismissedThisSession = false
                state.timerActive = false
            }
            else {
                this.#applyState({
                                     token:  defaultIonToken(),
                                     source: 'default',
                                 })
                await IonLayerUtils.syncCesiumCache(defaultIonToken())
                this.#syncPromptState()
            }

            return state
        })()

        try {
            return await this.#loadPromise
        }
        finally {
            this.#loadPromise = null
        }
    }

    fallbackToSharedToken = async (promptMode = 'invalid') => {
        const state = getIonState()

        await this.stopPromptTimer({persist: false})
        await lgs.db?.vault?.delete?.(ION_TOKEN_KEY, VAULT_STORE)
        this.#applyState({
                             token:  defaultIonToken(),
                             source: 'default',
                         })
        await IonLayerUtils.syncCesiumCache(defaultIonToken())
        state.dismissedThisSession = false
        state.promptMode = promptMode
        state.showPrompt = true
        state.timerActive = false
        return state
    }

    applyToken = async (token, source = 'user') => {
        const nextToken = normalizeToken(token)
        if (nextToken === '') {
            throw new Error('A Cesium Ion token cannot be empty.')
        }

        this.#applyState({
                             token:  nextToken,
                             source,
                         })
        await IonLayerUtils.syncCesiumCache(nextToken)

        if (source === 'user') {
            const state = getIonState()
            state.dismissedThisSession = false
            state.showPrompt = false
            state.promptMode = null
            await this.stopPromptTimer({persist: false})
        }

        return nextToken
    }

    persistUsage = async () => {
        const state = getIonState()
        if (!lgs.db?.settings?.put) {
            return state.accumulatedSeconds
        }

        const usage = this.#sanitizeUsage(state.accumulatedSeconds)
        state.accumulatedSeconds = usage
        try {
            await this.#writeManagementValue(ION_USAGE_KEY, usage, ION_LEGACY_USAGE_KEY)
        }
        catch (error) {
            console.error('[IonTokenManager] Failed to persist Ion usage:', error)
        }
        return usage
    }

    save = async (token) => {
        const nextToken = normalizeToken(token)
        if (nextToken === '') {
            throw new Error('Please enter a Cesium Ion token.')
        }
        if (nextToken === defaultIonToken()) {
            throw new Error('Please enter a personal Cesium Ion token. The shared application token cannot be saved as your personal token.')
        }

        await this.#validateToken(nextToken)
        await lgs.db.vault.put(ION_TOKEN_KEY, nextToken, VAULT_STORE)
        await this.applyToken(nextToken, 'user')
        const state = getIonState()
        state.dismissedThisSession = false
        state.showPrompt = false
        state.promptMode = null
        await this.stopPromptTimer({persist: true})
        return nextToken
    }

    clear = async () => {
        await this.stopPromptTimer({persist: false})
        await lgs.db.vault.delete(ION_TOKEN_KEY, VAULT_STORE)
        const state = getIonState()
        state.dismissedThisSession = false
        this.#applyState({
                             token:  defaultIonToken(),
                             source: 'default',
                         })
        await IonLayerUtils.syncCesiumCache(defaultIonToken())
        this.#syncPromptState()
        await this.startPromptTimer()
        return state
    }

    dismissForSession = () => {
        const state = getIonState()
        state.dismissedThisSession = true
        state.showPrompt = false
    }

    markIntroSeen = async () => {
        const state = getIonState()
        state.introSeen = true
        state.dismissedThisSession = false
        state.promptMode = null
        state.showPrompt = false

        if (lgs.db?.settings?.put) {
            try {
                await this.#writeManagementValue(ION_INTRO_SEEN_KEY, true, ION_LEGACY_INTRO_SEEN_KEY)
            }
            catch (error) {
                console.error('[IonTokenManager] Failed to persist Ion intro state:', error)
            }
        }
    }

    resetIntroSeen = async () => {
        const state = getIonState()
        state.introSeen = false

        try {
            await this.#deleteManagementValue(ION_INTRO_SEEN_KEY, false, ION_LEGACY_INTRO_SEEN_KEY)
        }
        catch (error) {
            console.error('[IonTokenManager] Failed to reset Ion intro state:', error)
        }
    }

    startPromptTimer = async () => {
        if (!getIonState().loaded) {
            await this.load()
        }

        if (getIonState().source !== 'default') {
            getIonState().timerActive = false
            await this.stopPromptTimer({persist: false})
            return getIonState()
        }

        if (this.#tickHandle !== null) {
            getIonState().timerActive = true
            this.#syncPromptState()
            return getIonState()
        }

        this.#attachListeners()
        this.#lastActivityAt = Date.now()
        this.#syncTimerActiveState()
        this.#persistCountdown = DEFAULT_PERSIST_INTERVAL_SECONDS
        this.#syncPromptState()

        this.#tickHandle = window.setInterval(() => {
            const currentState = getIonState()
            if (currentState.source !== 'default') {
                void this.stopPromptTimer({persist: true})
                return
            }

            if (!this.#syncTimerActiveState()) {
                this.#syncPromptState()
                return
            }

            currentState.accumulatedSeconds += 1
            this.#persistCountdown -= 1

            if (this.#persistCountdown <= 0) {
                this.#persistCountdown = DEFAULT_PERSIST_INTERVAL_SECONDS
                void this.persistUsage()
            }

            this.#syncPromptState()
        }, TICK_INTERVAL_MS)

        return getIonState()
    }

    stopPromptTimer = async ({persist = true} = {}) => {
        if (this.#tickHandle !== null) {
            window.clearInterval(this.#tickHandle)
            this.#tickHandle = null
        }

        getIonState().timerActive = false
        if (persist) {
            await this.persistUsage()
        }
        this.#detachListeners()
        return getIonState()
    }
}

export const ionTokenManager = new IonTokenManager()
