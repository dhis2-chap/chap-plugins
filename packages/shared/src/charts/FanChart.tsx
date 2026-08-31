import i18n from '@dhis2/d2-i18n'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import React from 'react'
import { formatPeriodLabel } from './periods'
import type { FanChartData } from './quantiles'
import { registerHighchartsModules } from './registerHighchartsModules'

// Same palette as the modeling app's UncertaintyAreaChart
const COLOR_ACTUALS = '#f68000'
const COLOR_MEDIAN = '#004bbd'
const COLOR_RANGE_80 = '#c4dcf2'
const COLOR_RANGE_50 = '#9bbdff'

export type FanChartProps = {
    data: FanChartData
    height?: number
    /** y-axis label, e.g. the disease/target name */
    valueLabel?: string
}

/**
 * Prediction fan chart: observed actuals + median line + 50%/80% prediction
 * interval bands, one org unit per chart.
 */
export const FanChart = ({ data, height = 320, valueLabel }: FanChartProps) => {
    registerHighchartsModules()

    const hasActuals = data.actuals.some((value) => value !== null)

    const options: Highcharts.Options = {
        chart: { height, spacing: [8, 8, 8, 8] },
        title: { text: undefined },
        credits: { enabled: false },
        exporting: { enabled: false },
        xAxis: {
            type: 'category',
            categories: data.periods.map(formatPeriodLabel),
        },
        yAxis: {
            title: { text: valueLabel ?? null },
            min: 0,
        },
        tooltip: { shared: true },
        series: [
            {
                name: i18n.t('80% prediction interval'),
                type: 'arearange',
                data: data.range80,
                color: COLOR_RANGE_80,
                fillOpacity: 0.9,
                lineWidth: 0,
                marker: { enabled: false },
                zIndex: 0,
            },
            {
                name: i18n.t('50% prediction interval'),
                type: 'arearange',
                data: data.range50,
                color: COLOR_RANGE_50,
                fillOpacity: 0.9,
                lineWidth: 0,
                marker: { enabled: false },
                zIndex: 1,
            },
            {
                name: i18n.t('Median prediction'),
                type: 'line',
                data: data.median,
                color: COLOR_MEDIAN,
                zIndex: 3,
            },
            ...(hasActuals
                ? [
                      {
                          name: i18n.t('Actual cases'),
                          type: 'line' as const,
                          data: data.actuals,
                          color: COLOR_ACTUALS,
                          zIndex: 4,
                      },
                  ]
                : []),
        ],
    }

    return (
        <HighchartsReact
            highcharts={Highcharts}
            options={options}
            containerProps={{ style: { width: '100%' } }}
        />
    )
}
