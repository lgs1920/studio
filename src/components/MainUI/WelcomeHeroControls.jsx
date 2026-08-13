/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeHeroControls.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ThemeSelector }                                    from '@Components/ThemeSelector'
import { WaButton, WaDropdown, WaDropdownItem }              from '@web.awesome.me/webawesome-pro/dist/react'
import { useState }                                         from 'react'

const WELCOME_LANGUAGE_STORAGE_KEY = 'lgs-language'

const LANGUAGE_OPTIONS = [
    {code: 'en', label: 'English', flag: '/assets/images/flags/gb.svg'},
    {code: 'fr', label: 'Français', flag: '/assets/images/flags/fr.svg'},
]

/**
 * Resolves the language stored for the Studio welcome screen.
 *
 * @returns {string} A supported language code.
 */
const resolveWelcomeLanguage = () => {
    const storedLanguage = localStorage.getItem(WELCOME_LANGUAGE_STORAGE_KEY)
    const browserLanguage = navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'

    return LANGUAGE_OPTIONS.some(option => option.code === storedLanguage) ? storedLanguage : browserLanguage
}

/**
 * Renders the welcome hero language and brand/season controls.
 *
 * @returns {JSX.Element} Hero controls.
 */
export const WelcomeHeroControls = () => {
    const [language, setLanguage] = useState(resolveWelcomeLanguage)
    const currentLanguage = LANGUAGE_OPTIONS.find(option => option.code === language) || LANGUAGE_OPTIONS[0]

    /**
     * Applies a language selection to the Studio context and document.
     *
     * @param {CustomEvent} event - Web Awesome dropdown selection event.
     */
    const handleLanguageSelect = (event) => {
        const selectedLanguage = event.detail.item.value

        if (!LANGUAGE_OPTIONS.some(option => option.code === selectedLanguage)) {
            return
        }

        setLanguage(selectedLanguage)
        localStorage.setItem(WELCOME_LANGUAGE_STORAGE_KEY, selectedLanguage)
        document.documentElement.lang = selectedLanguage
        lgs.lang = selectedLanguage
    }

    return (
        <div className="welcome-hero-controls" aria-label="Welcome hero controls">
            <ThemeSelector paletteOnly/>

            <WaDropdown
                className="welcome-language-selector"
                hidden
                placement="bottom-end"
                onWaSelect={handleLanguageSelect}
            >
                <WaButton
                    className="welcome-language-trigger"
                    slot="trigger"
                    appearance="plain"
                    variant="neutral"
                    size="s"
                    aria-label="Choose language"
                >
                    <img
                        className="welcome-language-flag"
                        src={currentLanguage.flag}
                        alt={currentLanguage.label}
                    />
                </WaButton>
                {LANGUAGE_OPTIONS.map(option => (
                    <WaDropdownItem value={option.code} key={option.code}>
                        <span className="welcome-language-option">
                            <img className="welcome-language-flag" src={option.flag} alt=""/>
                            <span>{option.label}</span>
                        </span>
                    </WaDropdownItem>
                ))}
            </WaDropdown>
        </div>
    )
}
