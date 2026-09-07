import React from 'react'
import styles from './MapLegend.module.css'

export type MapLegendRow = {
    /** Swatch fill, matching the `color` the map paints those features with */
    color: string
    label: string
}

export type MapLegendProps = {
    title: string
    rows: MapLegendRow[]
}

/**
 * Colour key overlaid on a {@link ChoroplethMap}. Positioned absolutely, so
 * it belongs inside the same relatively positioned wrapper as the map.
 */
export const MapLegend = ({ title, rows }: MapLegendProps) => (
    <div className={styles.legend}>
        <div className={styles.legendTitle}>{title}</div>
        {rows.map((row, index) => (
            <div key={index} className={styles.legendRow}>
                <span
                    className={styles.swatch}
                    style={{ background: row.color }}
                />
                <span>{row.label}</span>
            </div>
        ))}
    </div>
)
