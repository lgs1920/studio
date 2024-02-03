export class AppUtils {
    static setTheme = (theme=null) => {
        if (!theme) {
            theme = window.vt3DContext.configuration.theme
        }
        document.documentElement.classList.add(`sl-theme-${theme}`);
    }
}