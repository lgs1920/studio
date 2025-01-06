export class DeviceManager {

    constructor() {
        // Singleton
        if (DeviceManager.instance) {
            return DeviceManager.instance
        }
        // this.isDesktop =  useMediaQuery({minWidth: 992})
        // this.isTablet =  useMediaQuery({minWidth: 768, maxWidth: 991})
        // this.isMobile =  useMediaQuery({maxWidth: 767})
        // this.isNotMobile =  useMediaQuery({minWidth: 768})
        // this.isDesktopOrLaptop =  useMediaQuery({minWidth: 1224})
        // this.isBigScreen =  useMediaQuery({minWidth: 1824})
        // this.isTabletOrMobile =  useMediaQuery({maxWidth: 1224})
        // this. isPortrait =  useMediaQuery({orientation: 'portrait'})
        // this.isPaysage =  useMediaQuery({orientation: 'paysage'})
        // this.isRetina =  useMediaQuery({minResolution: '2dppx'})

        DeviceManager.instance = this

    }

    // From https://www.npmjs.com/package/react-responsive


}