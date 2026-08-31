import Highcharts from 'highcharts'
import highchartsMore from 'highcharts/highcharts-more'
import accessibility from 'highcharts/modules/accessibility'

/**
 * Registers the Highcharts feature modules the widgets need. Called lazily
 * from a chart's render (not at module top level) so importing the shared
 * package stays side-effect free. `highcharts-more` provides the `arearange`
 * series type used for prediction intervals. Idempotent.
 */
let modulesRegistered = false

export const registerHighchartsModules = () => {
    if (modulesRegistered) {
        return
    }
    modulesRegistered = true

    accessibility(Highcharts)
    highchartsMore(Highcharts)
}
