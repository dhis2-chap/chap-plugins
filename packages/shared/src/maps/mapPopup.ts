import styles from './mapPopup.module.css'

export type MapPopupRow = {
    text: string
    /** Render de-emphasized — for a supporting detail like an interval */
    muted?: boolean
}

/**
 * Build the DOM for a {@link ChoroplethMap} hover popup: a bold title over
 * plain rows. MapLibre popups live outside React's tree, so widgets describe
 * the content as strings and this assembles the nodes.
 */
export const createMapPopup = (
    title: string,
    rows: MapPopupRow[]
): HTMLElement => {
    const root = document.createElement('div')
    root.className = styles.popup

    const titleElement = document.createElement('div')
    titleElement.className = styles.popupTitle
    titleElement.textContent = title
    root.appendChild(titleElement)

    for (const row of rows) {
        const rowElement = document.createElement('div')
        if (row.muted) {
            rowElement.className = styles.popupMuted
        }
        rowElement.textContent = row.text
        root.appendChild(rowElement)
    }

    return root
}
