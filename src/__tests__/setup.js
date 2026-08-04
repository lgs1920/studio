if (!Array.isArray(document.adoptedStyleSheets)) {
    Object.defineProperty(document, 'adoptedStyleSheets', {
        configurable: true,
        value: [],
        writable: true,
    })
}
