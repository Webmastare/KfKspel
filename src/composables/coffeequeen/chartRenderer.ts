import * as d3 from 'd3'
import { formatRelativeTime } from './chartUtils'
import type { ChartDataPoint, ChartSeries, ChartConfig, TimeScaleConfig } from './statsTypes'
import { ITEM_COLORS } from './statsTypes'

export class ProductionChartRenderer {
  private container: HTMLElement
  private svg?: d3.Selection<SVGGElement, unknown, null, undefined>
  private config: ChartConfig

  constructor(container: HTMLElement, config: ChartConfig) {
    this.container = container
    this.config = config
  }

  /**
   * Clear the chart container
   */
  clear(): void {
    d3.select(this.container).selectAll('*').remove()
  }

  /**
   * Update chart configuration
   */
  updateConfig(newConfig: Partial<ChartConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Render a line chart showing production rates over time
   */
  renderRateChart(series: ChartSeries[], timeScale?: TimeScaleConfig): void {
    this.clear()
    
    if (series.length === 0 || !series.some(s => s.data.length > 0)) {
      this.showNoDataMessage('No production rate data available')
      return
    }

    // Filter out series with no data
    const validSeries = series.filter(s => s.visible && s.data.length > 0)
    if (validSeries.length === 0) {
      this.showNoDataMessage('No visible items with production data')
      return
    }

    // Get responsive dimensions
    const containerRect = this.container.getBoundingClientRect()
    const width = Math.max(containerRect.width || this.config.width, 400)
    const height = Math.max(containerRect.height || this.config.height, 300)
    
    const margin = { top: 20, right: 30, bottom: 60, left: 70 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    this.svg = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Find data extent and convert to relative time (seconds ago)
    const allData = validSeries.flatMap(s => s.data)
    
    if (allData.length === 0) {
      this.showNoDataMessage('No data points available')
      return
    }
    
    // Use the most recent bucket timestamp as "now" to avoid offset issues
    const mostRecentBucketTime = Math.max(...allData.map(d => d.timestamp))
    const now = mostRecentBucketTime
    
    // For Factorio-style charts, always span the full time scale duration
    const maxSecondsAgo = timeScale?.duration === Infinity ? 
      Math.round((now - Math.min(...allData.map(d => d.timestamp))) / 1000) : 
      timeScale?.duration || 20
    const minSecondsAgo = 0 // Always end at the most recent bucket
    
    const maxRate = d3.max(allData, d => d.itemsPerMinute) || 0
    
    // Create scales using relative time (seconds ago)
    const xScale = d3.scaleLinear()
      .domain([maxSecondsAgo, minSecondsAgo]) // Oldest to newest (20s ago → 0s ago)
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain([0, Math.max(maxRate * 1.1, 0.1)]) // Ensure minimum domain
      .range([innerHeight, 0])

    // Create line generator using timestamps
    const line = d3.line<ChartDataPoint>()
      .x(d => xScale(Math.round((now - d.timestamp) / 1000))) // Convert to seconds ago
      .y(d => yScale(Math.max(0, d.itemsPerMinute))) // Clamp to non-negative values
      .curve(d3.curveMonotoneX) // Monotonic curve prevents negative overshoot

    // Add axes with time formatting
    this.svg.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat(d => {
          const secondsAgo = Math.round(d as number)
          return formatRelativeTime(secondsAgo, timeScale?.duration || 20)
        })
        .ticks(Math.min(8, Math.floor(innerWidth / 80))) // Responsive tick count
      )
      .selectAll('text')
      .style('fill', 'var(--coffee-text-primary)')
      .style('font-size', '12px')

    // Add y-axis
    this.svg.append('g')
      .attr('class', 'y-axis')
      .style('color', 'var(--coffee-text-primary)')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', 'var(--coffee-text-primary)')
      .style('font-size', '12px')

    // Add axis labels
    this.svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('fill', 'var(--coffee-text-primary)')
      .text('Items per Minute')

    this.svg.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom})`)
      .style('text-anchor', 'middle')
      .style('fill', 'var(--coffee-text-primary)')
      .text('Time')

    // For Factorio-style charts, extend series to span full time range
    const extendedSeries = validSeries.map(series => ({
      ...series,
      data: this.extendSeriesData(series.data, now, maxSecondsAgo)
    }))

    // Draw lines for each series
    extendedSeries.forEach((s, index) => {
      const color = ITEM_COLORS[s.itemKey] || `hsl(${(index * 50) % 360}, 70%, 50%)`

      // Main production line
      this.svg!.append('path')
        .datum(s.data)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', line)

      // Add dots for data points
      this.svg!.selectAll(`.dot-${index}`)
        .data(s.data)
        .enter().append('circle')
        .attr('class', `dot-${index}`)
        .attr('cx', (d: ChartDataPoint) => xScale(Math.round((now - d.timestamp) / 1000)))
        .attr('cy', (d: ChartDataPoint) => yScale(d.itemsPerMinute))
        .attr('r', 3)
        .attr('fill', color)
        .attr('stroke', 'var(--coffee-bg)')
        .attr('stroke-width', 1)
    })

    // Add legend
    this.addLegend(extendedSeries)
  }

  /**
   * Render a cumulative production chart
   */
  renderCumulativeChart(series: ChartSeries[], timeScale?: TimeScaleConfig): void {
    // console.log('renderCumulativeChart called with series:', series)
    this.clear()
    
    if (series.length === 0 || !series.some(s => s.data.length > 0)) {
      this.showNoDataMessage('No production data available')
      return
    }

    // Filter out series with no data
    const validSeries = series.filter(s => s.visible && s.data.length > 0)
    if (validSeries.length === 0) {
      this.showNoDataMessage('No visible items with production data')
      return
    }


    // Get responsive dimensions
    const containerRect = this.container.getBoundingClientRect()
    const width = Math.max(containerRect.width || this.config.width, 400)
    const height = Math.max(containerRect.height || this.config.height, 300)
    
    const margin = { top: 20, right: 30, bottom: 60, left: 70 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    this.svg = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Find data extent
    const allData = validSeries.flatMap(s => s.data)
    
    if (allData.length === 0) {
      this.showNoDataMessage('No data points available')
      return
    }

    const timeExtent = d3.extent(allData, d => d.timestamp) as [number, number]
    
    // Calculate cumulative values for each series
    const cumulativeSeries = validSeries.map(series => {
      let cumulative = 0
      const cumulativeData = series.data.map(d => {
        cumulative += d.itemsPerMinute
        return { ...d, cumulative }
      })
      return { ...series, data: cumulativeData }
    })

    const maxCumulative = d3.max(cumulativeSeries.flatMap(s => s.data), d => (d as any).cumulative) || 0

    // Create scales
    const xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain([0, maxCumulative * 1.1])
      .range([innerHeight, 0])

    // Create line generator for cumulative values with safe curve handling
    const line = d3.line<any>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale(Math.max(0, d.cumulative))) // Clamp to non-negative values
      .curve(d3.curveMonotoneX) // Safe curve that prevents negative overshoot

    // Add axes
    this.svg.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', 'var(--coffee-text-primary)')
      .style('font-size', '12px')

    this.svg.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', 'var(--coffee-text-primary)')
      .style('font-size', '12px')

    // Add axis labels
    this.svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('fill', 'var(--coffee-text-primary)')
      .text('Total Items')

    this.svg.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom})`)
      .style('text-anchor', 'middle')
      .style('fill', 'var(--coffee-text-primary)')
      .text('Time')

    // Draw lines for each series
    cumulativeSeries.forEach((s, index) => {
      const color = ITEM_COLORS[s.itemKey] || `hsl(${(index * 50) % 360}, 70%, 50%)`
      // console.log(`Drawing cumulative series for ${s.name} with ${s.data.length} points`)

      this.svg!.append('path')
        .datum(s.data)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', line)

      // Add dots
      this.svg!.selectAll(`.dot-${index}`)
        .data(s.data)
        .enter().append('circle')
        .attr('class', `dot-${index}`)
        .attr('cx', (d: any) => xScale(d.timestamp))
        .attr('cy', (d: any) => yScale(d.cumulative))
        .attr('r', 3)
        .attr('fill', color)
        .attr('stroke', 'var(--coffee-bg)')
        .attr('stroke-width', 1)
    })

    // Add legend
    this.addLegend(cumulativeSeries)
  }

  /**
   * Extend series data to span the full time range for Factorio-style charts
   * SIMPLIFIED: Since stats manager now provides complete coverage, just filter by time range
   */
  private extendSeriesData(data: ChartDataPoint[], now: number, maxSecondsAgo: number): ChartDataPoint[] {
    const startTime = now - (maxSecondsAgo * 1000)
    const endTime = now

    // Filter data within the time range and ensure it's sorted
    return [...data]
      .filter(d => d.timestamp >= startTime && d.timestamp <= endTime)
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * Add legend to the chart
   */
  private addLegend(series: ChartSeries[]): void {
    const legend = this.svg!.append('g')
      .attr('class', 'legend')

    const legendItems = legend.selectAll('.legend-item')
      .data(series)
      .enter().append('g')
      .attr('class', 'legend-item')

    legendItems.append('rect')
      .attr('x', 0)
      .attr('y', (_, i) => i * 20)
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', (d, i) => ITEM_COLORS[d.itemKey] || `hsl(${(i * 50) % 360}, 70%, 50%)`)

    legendItems.append('text')
      .attr('x', 20)
      .attr('y', (_, i) => i * 20 + 12)
      .style('fill', 'var(--coffee-text-primary)')
      .style('font-size', '12px')
      .text(d => d.name)

    // Position legend in top-right corner
    const bbox = (legend.node() as SVGGraphicsElement).getBBox()
    legend.attr('transform', `translate(${this.container.offsetWidth - bbox.width - 50}, 20)`)
  }

  /**
   * Show a message when no data is available
   */
  private showNoDataMessage(message: string): void {
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', this.config.width)
      .attr('height', this.config.height)

    svg.append('text')
      .attr('x', this.config.width / 2)
      .attr('y', this.config.height / 2)
      .attr('text-anchor', 'middle')
      .style('fill', 'var(--coffee-text-secondary)')
      .style('font-size', '14px')
      .text(message)
  }
}