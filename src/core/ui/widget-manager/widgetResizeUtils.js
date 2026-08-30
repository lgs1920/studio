/**
 * Return whether a widget uses layout dimensions as its resize mechanism.
 *
 * @param {Object} config - Widget runtime configuration.
 * @returns {boolean} True when resizing must not use a scale transform.
 */
export const isNonDistortingWidget = config => !config?.isCropper && config?.resizable === true && config?.scalable !== true

/**
 * Resolve the minimum and maximum layout dimensions for a widget.
 *
 * @param {Object} config - Widget runtime configuration.
 * @param {HTMLElement|null} [element=null] - Rendered widget element used for content limits.
 * @returns {{minWidth: number, minHeight: number, maxWidth: number, maxHeight: number}} Dimension limits.
 */
export const resolveWidgetResizeLimits = (config, element = null) => {
    const minWidth = Number(config?.min?.width)
    const minHeight = Number(config?.min?.height)
    const maxWidth = Number(config?.max?.width)
    const maxHeight = Number(config?.max?.height)
    const resizeToContent = config?.constrainResizeToContent === false
        ? null
        : config?.resizeToContent
    const content = resizeToContent && typeof resizeToContent === 'object' && resizeToContent.target
        ? (typeof resizeToContent.target === 'string'
            ? element?.querySelector?.(resizeToContent.target)
            : resizeToContent.target)
        : element?.firstElementChild
    const contentWidth = Math.max(Number(content?.scrollWidth) || 0, Number(content?.getBoundingClientRect?.().width) || 0)
    const contentHeight = Math.max(Number(content?.scrollHeight) || 0, Number(content?.getBoundingClientRect?.().height) || 0)
    const limitsContentWidth = resizeToContent === true || resizeToContent?.width === true
    const limitsContentHeight = resizeToContent === true || resizeToContent?.height === true
    const minimumContentWidth = resizeToContent?.minWidth === true || resizeToContent?.min?.width === true
    const minimumContentHeight = resizeToContent?.minHeight === true || resizeToContent?.min?.height === true
    const staticMinWidth = Number.isFinite(minWidth) && minWidth > 0 ? minWidth : 1
    const staticMinHeight = Number.isFinite(minHeight) && minHeight > 0 ? minHeight : 1
    const resolvedMinWidth = minimumContentWidth && contentWidth > 0
        ? Math.max(staticMinWidth, contentWidth)
        : staticMinWidth
    const resolvedMinHeight = minimumContentHeight && contentHeight > 0
        ? Math.max(staticMinHeight, contentHeight)
        : staticMinHeight
    const resolvedMaxWidth = Number.isFinite(maxWidth) && maxWidth > 0 ? Math.max(maxWidth, resolvedMinWidth) : Infinity
    const resolvedMaxHeight = Number.isFinite(maxHeight) && maxHeight > 0 ? Math.max(maxHeight, resolvedMinHeight) : Infinity

    return {
        minWidth:  resolvedMinWidth,
        minHeight: resolvedMinHeight,
        maxWidth:  limitsContentWidth && contentWidth > 0
            ? Math.max(resolvedMinWidth, Math.min(resolvedMaxWidth, contentWidth))
            : resolvedMaxWidth,
        maxHeight: limitsContentHeight && contentHeight > 0
            ? Math.max(resolvedMinHeight, Math.min(resolvedMaxHeight, contentHeight))
            : resolvedMaxHeight,
    }
}

/**
 * Resolve a locked widget aspect ratio.
 *
 * @param {Object} config - Widget runtime configuration.
 * @returns {number|null} Positive aspect ratio or null for an unlocked ratio.
 */
export const resolveWidgetResizeRatio = config => {
    if (config?.ratio?.locked !== true) {
        return null
    }

    const ratio = Number(config.ratio.aspectRatio)
    return Number.isFinite(ratio) && ratio > 0 ? ratio : null
}

/**
 * Constrain layout dimensions while preserving a configured locked ratio.
 *
 * @param {Object} options - Constraint options.
 * @param {Object} options.config - Widget runtime configuration.
 * @param {HTMLElement|null} [options.element=null] - Rendered widget element used for content limits.
 * @param {number} options.width - Requested width.
 * @param {number} options.height - Requested height.
 * @param {'width'|'height'} [options.preferredAxis='width'] - Axis used by edge resizing.
 * @param {number} [options.maxWidth] - Optional maximum width imposed by the active bounds.
 * @param {number} [options.maxHeight] - Optional maximum height imposed by the active bounds.
 * @returns {{width: number, height: number}} Constrained dimensions.
 */
export const constrainWidgetDimensions = ({
    config,
    element = null,
    width,
    height,
    preferredAxis = 'width',
    maxWidth,
    maxHeight,
}) => {
    const limits = resolveWidgetResizeLimits(config, element)
    const boundedLimits = {
        ...limits,
        maxWidth: Number.isFinite(Number(maxWidth))
            ? Math.min(limits.maxWidth, Math.max(limits.minWidth, Number(maxWidth)))
            : limits.maxWidth,
        maxHeight: Number.isFinite(Number(maxHeight))
            ? Math.min(limits.maxHeight, Math.max(limits.minHeight, Number(maxHeight)))
            : limits.maxHeight,
    }
    const requestedWidth = Number(width)
    const requestedHeight = Number(height)
    const safeWidth = Number.isFinite(requestedWidth) && requestedWidth > 0 ? requestedWidth : boundedLimits.minWidth
    const safeHeight = Number.isFinite(requestedHeight) && requestedHeight > 0 ? requestedHeight : boundedLimits.minHeight
    const ratio = resolveWidgetResizeRatio(config)

    if (!ratio) {
        return {
            width:  Math.min(Math.max(safeWidth, boundedLimits.minWidth), boundedLimits.maxWidth),
            height: Math.min(Math.max(safeHeight, boundedLimits.minHeight), boundedLimits.maxHeight),
        }
    }

    const minimumRatioWidth = Math.max(boundedLimits.minWidth, boundedLimits.minHeight * ratio)
    const maximumRatioWidth = Math.min(boundedLimits.maxWidth, boundedLimits.maxHeight * ratio)
    const requestedRatioWidth = preferredAxis === 'height' ? safeHeight * ratio : safeWidth
    const widthLimit = maximumRatioWidth >= minimumRatioWidth ? maximumRatioWidth : minimumRatioWidth
    const constrainedWidth = Math.min(Math.max(requestedRatioWidth, minimumRatioWidth), widthLimit)

    return {
        width:  constrainedWidth,
        height: constrainedWidth / ratio,
    }
}

/**
 * Fit a non-distorting widget inside board bounds without applying a scale.
 *
 * @param {Object} options - Fitting options.
 * @param {Object} options.config - Widget runtime configuration.
 * @param {HTMLElement|null} [options.element=null] - Rendered widget element used for content limits.
 * @param {{width: number, height: number}} options.dimensions - Current dimensions.
 * @param {{width: number, height: number}} options.bounds - Available board bounds.
 * @param {{left?: number, right?: number, top?: number, bottom?: number}} [options.margins] - Extra margins.
 * @returns {{width: number, height: number}} Fitted dimensions.
 */
export const fitWidgetDimensionsToBounds = ({config, element = null, dimensions, bounds, margins = {}}) => {
    const availableWidth = Math.max(1, Number(bounds?.width) - (Number(margins.left) || 0) - (Number(margins.right) || 0))
    const availableHeight = Math.max(1, Number(bounds?.height) - (Number(margins.top) || 0) - (Number(margins.bottom) || 0))
    const limits = resolveWidgetResizeLimits(config, element)
    const fittingConfig = {
        ratio: config?.ratio,
        min: {
            width:  Math.min(limits.minWidth, availableWidth),
            height: Math.min(limits.minHeight, availableHeight),
        },
        max: {
            width:  Math.min(limits.maxWidth, availableWidth),
            height: Math.min(limits.maxHeight, availableHeight),
        },
    }

    return constrainWidgetDimensions({
        config: fittingConfig,
        element,
        width:  Math.min(Number(dimensions?.width) || availableWidth, availableWidth),
        height: Math.min(Number(dimensions?.height) || availableHeight, availableHeight),
    })
}
