import * as d3 from "d3";
import type {
  ManagerChartDataPoint,
  ManagerChartSeries,
} from "./managerStatsTypes";

export class ManagerChartRenderer {
  private container: HTMLElement;
  private svg?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private config: {
    width: number;
    height: number;
  };

  constructor(
    container: HTMLElement,
    config: { width: number; height: number },
  ) {
    this.container = container;
    this.config = config;
  }

  /**
   * Clear the chart container
   */
  clear(): void {
    d3.select(this.container).selectAll("*").remove();
  }

  /**
   * Update chart configuration
   */
  updateConfig(newConfig: Partial<{ width: number; height: number }>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Show a no data message
   */
  private showNoDataMessage(message: string): void {
    const svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.config.width)
      .attr("height", this.config.height);

    svg
      .append("text")
      .attr("x", this.config.width / 2)
      .attr("y", this.config.height / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("fill", "#999")
      .style("font-size", "14px")
      .text(message);
  }

  /**
   * Render a line chart showing manager performance over time
   */
  renderManagerChart(
    series: ManagerChartSeries[],
    chartType: "items" | "cash",
    showNetValues: boolean = false,
  ): void {
    this.clear();

    if (series.length === 0 || !series.some((s) => s.data.length > 0)) {
      this.showNoDataMessage(`No ${chartType} data available`);
      return;
    }

    // Filter out series with no data
    const validSeries = series.filter((s) => s.visible && s.data.length > 0);
    if (validSeries.length === 0) {
      this.showNoDataMessage(`No visible ${chartType} data`);
      return;
    }

    // Get responsive dimensions
    const containerRect = this.container.getBoundingClientRect();
    const width = Math.max(containerRect.width || this.config.width, 400);
    const height = Math.max(this.config.height, 300);

    // Set up dimensions and margins
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create the SVG
    const svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g").attr(
      "transform",
      `translate(${margin.left},${margin.top})`,
    );

    // Flatten all data points to find extents
    const allData = validSeries.flatMap((s) => s.data);

    if (allData.length === 0) {
      this.showNoDataMessage(`No ${chartType} data points`);
      return;
    }

    // Set up scales
    const xExtent = d3.extent(allData, (d) => d.timestamp) as [number, number];
    const xScale = d3.scaleLinear().domain(xExtent).range([0, chartWidth]);

    // Choose the correct data accessor based on display mode
    const valueAccessor = showNetValues
      ? (chartType === "items"
        ? (d: ManagerChartDataPoint) => d.items
        : (d: ManagerChartDataPoint) => d.cash)
      : (chartType === "items"
        ? (d: ManagerChartDataPoint) => d.itemsPerMinute
        : (d: ManagerChartDataPoint) => d.cashPerMinute);

    const yExtent = d3.extent(allData, valueAccessor) as [number, number];

    // Ensure y-scale includes 0 and handle integer boundaries for net values
    let yMin = Math.min(0, yExtent[0] || 0);
    let yMax = Math.max(0, yExtent[1] || 0);

    if (showNetValues) {
      // For net values, ensure we have integer boundaries
      yMin = Math.floor(yMin);
      yMax = Math.ceil(yMax);
      // Ensure we have at least a range of 1 for better visualization
      if (yMax === yMin) {
        yMax = yMin + 1;
      }
    }

    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([
      chartHeight,
      0,
    ]);

    // Create line generator
    const line = d3
      .line<ManagerChartDataPoint>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(valueAccessor(d)))
      .curve(d3.curveMonotoneX);

    // Add axes
    const xAxis = d3.axisBottom(xScale).tickFormat((d) => {
      const now = Date.now();
      const diffMs = now - (d as number);
      const diffSec = Math.floor(diffMs / 1000);

      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      return `${diffHour}h ago`;
    });

    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "12px");

    // Update y-axis label based on display mode
    const yAxisLabel = showNetValues
      ? (chartType === "items" ? "Net Items" : "Net Cash")
      : (chartType === "items" ? "Items/min" : "Cash/min");

    // Configure y-axis with appropriate tick configuration
    let yAxis;
    if (showNetValues) {
      // For net values, use fewer ticks and ensure they're integers
      const tickCount = Math.min(8, Math.abs(yMax - yMin) + 1);
      yAxis = d3.axisLeft(yScale)
        .ticks(tickCount)
        .tickFormat((d) => {
          const value = d as number;
          // Only show integer values for net data
          if (value !== Math.floor(value)) return "";

          if (chartType === "cash") {
            if (Math.abs(value) >= 1000) {
              return `$${(value / 1000).toFixed(0)}k`;
            }
            return `$${value.toFixed(0)}`;
          } else {
            return value.toFixed(0);
          }
        });
    } else {
      // For rates, use default ticking with decimals
      yAxis = d3.axisLeft(yScale).tickFormat((d) => {
        if (chartType === "cash") {
          const value = d as number;
          if (Math.abs(value) >= 1000) {
            return `$${(value / 1000).toFixed(1)}k`;
          }
          return `$${value.toFixed(0)}`;
        } else {
          return (d as number).toFixed(1);
        }
      });
    }

    g.append("g").call(yAxis).selectAll("text").style("font-size", "12px");

    // Add axis labels
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - chartHeight / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#333")
      .text(yAxisLabel);

    // Add horizontal line at y=0 if we have negative values
    if (yMin < 0) {
      g.append("line")
        .attr("x1", 0)
        .attr("x2", chartWidth)
        .attr("y1", yScale(0))
        .attr("y2", yScale(0))
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "2,2");
    }

    // Draw lines for each series
    validSeries.forEach((s) => {
      if (s.data.length < 2) return;

      g.append("path")
        .datum(s.data)
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", 2)
        .attr("d", line);

      // Add dots for data points
      g.selectAll(`.dot-${s.name.replace(/\s+/g, "")}`)
        .data(s.data)
        .enter()
        .append("circle")
        .attr("class", `dot-${s.name.replace(/\s+/g, "")}`)
        .attr("cx", (d) => xScale(d.timestamp))
        .attr("cy", (d) => yScale(valueAccessor(d)))
        .attr("r", 3)
        .attr("fill", s.color);
    });

    // Add legend
    const legend = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${margin.left + 10}, ${margin.top + 10})`);

    const legendItems = legend
      .selectAll(".legend-item")
      .data(validSeries)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendItems
      .append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", (d) => d.color);

    legendItems
      .append("text")
      .attr("x", 18)
      .attr("y", 6)
      .attr("dy", "0.35em")
      .style("font-size", "12px")
      .style("fill", "#333")
      .text((d) => d.name);

    this.svg = g;
  }
}
