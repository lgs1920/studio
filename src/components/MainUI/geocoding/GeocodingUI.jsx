import { SelectLocation }                     from '@Components/MainUI/geocoding/SelectLocation'
import { faSearch }                           from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlIcon, SlInput, SlPopup } from '@shoelace-style/shoelace/dist/react'
import { SceneUtils }                         from '@Utils/cesium/SceneUtils'
import { FA2SL }                              from '@Utils/FA2SL'
import { useEffect, useRef }                  from 'react'
import { useSnapshot }                        from 'valtio'

import './style.css'

export const GeocodingUI = () => {
    const store = lgs.mainProxy.components.geocoder
    const snap = useSnapshot(store)

    const address = useRef(null)

    const handleSubmit = (event) => {
        event.preventDefault()
        store.dialog.loading = true
        store.dialog.noResults = false
        if (!store.dialog.submitDisabled) {
            __.ui.geocoder.search(address.current.value).then((results) => {
                store.dialog.loading = false
                if (results.size > 0) {
                    results.forEach((value, key) => {
                        store.list.set(key, value)
                    })
                    store.dialog.moreResults = results.size === __.ui.geocoder.limit
                }
                else {
                    store.dialog.noResults = true
                }
            })
        }
    }

    const handleSubmitAfterClear = (event) => {
        __.ui.geocoder.init()
        handleSubmit(event)
    }

    const handleSelect = async (event) => {

        const item = store.list.get(event.target.parentElement.id * 1)
        const point = {
            longitude: item.geometry.coordinates[0],
            latitude:  item.geometry.coordinates[1],
        }

        SceneUtils.focusThenRotate(point)

        // Clear current values and states
        __.ui.geocoder.init()
        store.list.clear()
        address.current.value = ''
        store.dialog.visible = false
        store.dialog.noResults = false
        store.dialog.submitDisabled = true
    }

    const handleChange = () => {
        store.dialog.noResults = false
        address.current.value = address.current.value.trimStart()
        store.dialog.submitDisabled = address.current.value.length < lgs.settings.ui.geocoder.minQuery
        __.ui.geocoder.init()
        store.list.clear()
        store.dialog.noResults = false
    }

    useEffect(() => {

        handleChange()
        store.dialog.noResults = false
        store.dialog.submitDisabled = true

        return (() => {
            __.ui.geocoder.init()
            // store.list.clear()
            address.current.value = ''
            store.dialog.visible = false
            store.dialog.noResults = true
        })

    }, [])

    return (
        <>
            <SlPopup active={snap.dialog.visible}
                     className={'lgs-theme'}
                     anchor="launch-the-geocoder"
                     placement={'right-start'}
                     distance={__.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-xs'))}
            >

                <div className="geocoding-dialog">
                    <form onSubmit={handleSubmitAfterClear}>
                        <div className="geocoding-form">
                            <SlInput name="location" ref={address} id="geocoder-search-location"
                                     placeholder={'Address or coordinates (lat,lon)'}
                                     pattern="^(?!\\s)([a-zA-Z\\s]+|[-+]?\\d{1,2}\\.\\d+[, ]\\s*[-+]?\\d{1,3}\\.\\d+)$"
                                     onChange={handleChange} onInput={handleChange}>
                            </SlInput>
                            <SlButton size={'small'} className={'square-icon'} type="submit"
                                      id="geocoder-search-location-submit"
                                      loading={snap.dialog.loading}
                                      disabled={snap.dialog.submitDisabled}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faSearch)}></SlIcon>
                            </SlButton>
                        </div>
                    </form>

                    <SelectLocation select={handleSelect} address={address} submit={handleSubmit}/>

                </div>

            </SlPopup>
        </>
    )
}
