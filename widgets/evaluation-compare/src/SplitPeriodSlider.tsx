import { formatPeriodLabel } from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import React, { useId } from 'react'
import styles from './SplitPeriodSlider.module.css'

/** Keep in sync with the thumb size in SplitPeriodSlider.module.css */
const THUMB_SIZE = 16

export type SplitPeriodSliderProps = {
    /** Every split the backtest produced entries for, oldest first */
    splitPeriods: string[]
    /** Index into `splitPeriods` currently being shown */
    selectedIndex: number
    onChange: (index: number) => void
    /** Periods forecast per split — the width of the highlighted window */
    horizonLength: number
    /** Last period of the selected forecast, for the readout */
    windowEnd?: string
}

/**
 * Scrubber over a backtest's train/test splits: drag to walk the forecast
 * window along the series and watch each forecast land against what actually
 * happened.
 *
 * The rail spans one window more than the slider's own range so the last
 * split's highlighted window still fits on it; the highlight is placed in the
 * same coordinate space as the native thumb (which is inset by half its width
 * at each end) so the two track each other exactly.
 */
export const SplitPeriodSlider = ({
    splitPeriods,
    selectedIndex,
    onChange,
    horizonLength,
    windowEnd,
}: SplitPeriodSliderProps) => {
    const inputId = useId()
    const maxIndex = Math.max(splitPeriods.length - 1, 1)
    const railPositions = Math.max(maxIndex + horizonLength - 1, 1)

    // Pixel offset that keeps a rail position aligned with the thumb centre
    const thumbOffset = (position: number) =>
        THUMB_SIZE / 2 - (position * THUMB_SIZE) / maxIndex
    const percent = (position: number) => (position * 100) / railPositions

    const windowSpan = horizonLength - 1
    const windowStart = splitPeriods[selectedIndex]
    const readout = windowEnd
        ? `${formatPeriodLabel(windowStart)} – ${formatPeriodLabel(windowEnd)}`
        : formatPeriodLabel(windowStart)

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <label className={styles.label} htmlFor={inputId}>
                    {i18n.t('Forecast window')}
                </label>
                <span className={styles.readout}>{readout}</span>
            </div>
            <div className={styles.rail}>
                <div
                    className={styles.window}
                    style={{
                        left: `calc(${percent(selectedIndex)}% + ${thumbOffset(selectedIndex)}px)`,
                        width: `calc(${percent(windowSpan)}% - ${(windowSpan * THUMB_SIZE) / maxIndex}px)`,
                    }}
                />
                <input
                    id={inputId}
                    className={styles.input}
                    style={{ width: `${percent(maxIndex)}%` }}
                    type="range"
                    min={0}
                    max={maxIndex}
                    step={1}
                    value={selectedIndex}
                    aria-label={i18n.t('Forecast window')}
                    aria-valuetext={readout}
                    onChange={(event) => onChange(Number(event.target.value))}
                />
            </div>
            <div
                className={styles.scale}
                style={{ width: `${percent(maxIndex)}%` }}
            >
                <span>{formatPeriodLabel(splitPeriods[0])}</span>
                <span>{formatPeriodLabel(splitPeriods[maxIndex])}</span>
            </div>
        </div>
    )
}
