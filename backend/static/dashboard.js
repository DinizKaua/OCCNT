(function () {
  setupTabs();
  setupLineChart();
})();

function setupTabs() {
  const tabsRoot = document.getElementById("main-tabs");
  if (!tabsRoot) {
    return;
  }

  const buttons = Array.from(tabsRoot.querySelectorAll(".tab-button"));
  const panels = Array.from(tabsRoot.querySelectorAll(".tab-panel"));
  let active = tabsRoot.dataset.activeTab || "export";

  function activate(target) {
    active = target;
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tabTarget === target);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === target);
    });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", function () {
      const target = button.dataset.tabTarget || "export";
      activate(target);
    });
  });

  activate(active);
}

function setupLineChart() {
  const canvas = document.getElementById("line-chart");
  const sourceTag = document.getElementById("chart-data");
  if (!canvas || !sourceTag) {
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(sourceTag.textContent || "{}");
  } catch (_error) {
    payload = {};
  }

  const chartState = {
    hoveredPoint: null,
    interactivePoints: [],
  };

  function renderChart() {
    const labels = Array.isArray(payload.labels) ? payload.labels : [];
    const historical = Array.isArray(payload.historical) ? payload.historical : [];
    const forecast = Array.isArray(payload.forecast) ? payload.forecast : [];
    const pointCount = Math.max(labels.length, historical.length + forecast.length);
    const normalizedLabels = pointCount
      ? Array.from({ length: pointCount }, function (_value, index) {
          return labels[index] != null ? labels[index] : String(index + 1);
        })
      : [];

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 520;
    const height = width;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (!normalizedLabels.length || !historical.length) {
      chartState.interactivePoints = [];
      chartState.hoveredPoint = null;
      ctx.font = "14px Space Grotesk, sans-serif";
      ctx.fillStyle = "#5b6978";
      ctx.fillText("Sem dados suficientes para desenhar o grafico.", 16, 28);
      return;
    }

    const margin = { top: 26, right: 22, bottom: 58, left: 58 };
    const availableWidth = width - margin.left - margin.right;
    const availableHeight = height - margin.top - margin.bottom;
    const plotSize = Math.max(80, Math.min(availableWidth, availableHeight));
    const plotLeft = margin.left + (availableWidth - plotSize) / 2;
    const plotTop = margin.top + (availableHeight - plotSize) / 2;
    const plotWidth = plotSize;
    const plotHeight = plotSize;

    const combinedValues = historical
      .concat(forecast)
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    const maxValue = Math.max.apply(null, combinedValues);
    const range = Math.max(maxValue, 1);
    const padding = Math.max(range * 0.08, 1);
    const yMin = 0;
    const yMax = maxValue + padding;

    const totalPoints = normalizedLabels.length;
    const xScale = (index) => {
      if (totalPoints <= 1) {
        return plotLeft + plotWidth / 2;
      }
      return plotLeft + (index / (totalPoints - 1)) * plotWidth;
    };
    const yScale = (value) => {
      return plotTop + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
    };

    drawGrid(ctx, plotLeft, plotTop, plotWidth, plotHeight, yMin, yMax, normalizedLabels.length);
    drawAxes(ctx, plotLeft, plotTop, plotWidth, plotHeight);
    const historicalPoints = historical.map((value, index) => ({ x: xScale(index), y: yScale(value) }));
    const forecastPoints = forecast.map((value, idx) => ({
      x: xScale(historical.length + idx),
      y: yScale(value),
    }));
    chartState.interactivePoints = historicalPoints
      .map((point, index) => ({
        x: point.x,
        y: point.y,
        label: String(normalizedLabels[index]),
        value: historical[index],
        series: "Historico",
        color: "#2f9c73",
      }))
      .concat(
        forecastPoints.map((point, idx) => ({
          x: point.x,
          y: point.y,
          label: String(normalizedLabels[historical.length + idx]),
          value: forecast[idx],
          series: "Previsao",
          color: "#ea8f28",
        }))
      );

    drawLine(ctx, historicalPoints, "#2f9c73", 2.8);
    if (historicalPoints.length && forecastPoints.length) {
      const linkedForecastPoints = [historicalPoints[historicalPoints.length - 1]].concat(forecastPoints);
      drawLine(ctx, linkedForecastPoints, "#ea8f28", 2.8);
    } else {
      drawLine(ctx, forecastPoints, "#ea8f28", 2.8);
    }
    drawPoints(ctx, historicalPoints, "#2f9c73");
    drawPoints(ctx, forecastPoints, "#ea8f28");
    drawXAxisLabels(ctx, normalizedLabels, xScale, plotTop, plotHeight);
    if (chartState.hoveredPoint) {
      drawHighlightedPoint(ctx, chartState.hoveredPoint);
      drawTooltip(ctx, chartState.hoveredPoint, width, height);
    }
  }

  renderChart();
  canvas.addEventListener("mousemove", function (event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    chartState.hoveredPoint = findClosestPoint(chartState.interactivePoints, mouseX, mouseY, 20);
    renderChart();
  });
  canvas.addEventListener("mouseleave", function () {
    chartState.hoveredPoint = null;
    renderChart();
  });
  let resizeTimeout = null;
  window.addEventListener("resize", function () {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(renderChart, 120);
  });
}

function drawGrid(ctx, plotLeft, plotTop, plotWidth, plotHeight, yMin, yMax, pointCount) {
  const steps = 5;
  ctx.save();
  ctx.strokeStyle = "#dce7f1";
  ctx.fillStyle = "#4f6074";
  ctx.font = "12px Space Grotesk, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= steps; i += 1) {
    const ratio = i / steps;
    const y = plotTop + ratio * plotHeight;
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotLeft + plotWidth, y);
    ctx.stroke();

    const value = yMax - ratio * (yMax - yMin);
    ctx.fillText(formatCompactNumber(value), plotLeft - 8, y);
  }

  const verticalSteps = Math.min(Math.max(pointCount - 1, 1), 8);
  for (let i = 0; i <= verticalSteps; i += 1) {
    const x = plotLeft + (i / verticalSteps) * plotWidth;
    ctx.beginPath();
    ctx.moveTo(x, plotTop);
    ctx.lineTo(x, plotTop + plotHeight);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAxes(ctx, plotLeft, plotTop, plotWidth, plotHeight) {
  ctx.save();
  ctx.strokeStyle = "#8193a8";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotTop + plotHeight);
  ctx.lineTo(plotLeft + plotWidth, plotTop + plotHeight);
  ctx.stroke();
  ctx.restore();
}

function drawLine(ctx, points, color, width) {
  if (!points.length) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
  ctx.restore();
}

function drawPoints(ctx, points, color) {
  ctx.save();
  ctx.fillStyle = color;
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawHighlightedPoint(ctx, point) {
  ctx.save();
  ctx.fillStyle = point.color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();
}

function drawXAxisLabels(ctx, labels, xScale, plotTop, plotHeight) {
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(labels.length / maxLabels));
  ctx.save();
  ctx.fillStyle = "#4f6074";
  ctx.font = "12px Space Grotesk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i < labels.length; i += step) {
    const x = xScale(i);
    ctx.fillText(String(labels[i]), x, plotTop + plotHeight + 8);
  }
  if ((labels.length - 1) % step !== 0) {
    const x = xScale(labels.length - 1);
    ctx.fillText(String(labels[labels.length - 1]), x, plotTop + plotHeight + 8);
  }
  ctx.restore();
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function findClosestPoint(points, mouseX, mouseY, maxDistance) {
  let closest = null;
  let closestDistance = maxDistance;
  points.forEach(function (point) {
    const distance = Math.hypot(point.x - mouseX, point.y - mouseY);
    if (distance <= closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  });
  return closest;
}

function drawTooltip(ctx, point, width, height) {
  const lines = [
    point.series,
    point.label,
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(point.value),
  ];
  ctx.save();
  ctx.font = "12px Space Grotesk, sans-serif";
  const paddingX = 10;
  const paddingY = 8;
  const lineHeight = 16;
  const tooltipWidth = Math.max.apply(
    null,
    lines.map(function (line) {
      return ctx.measureText(line).width;
    })
  ) + paddingX * 2;
  const tooltipHeight = paddingY * 2 + lineHeight * lines.length - 4;

  let tooltipX = point.x + 12;
  let tooltipY = point.y - tooltipHeight - 12;
  if (tooltipX + tooltipWidth > width - 8) {
    tooltipX = point.x - tooltipWidth - 12;
  }
  if (tooltipY < 8) {
    tooltipY = point.y + 12;
  }
  if (tooltipY + tooltipHeight > height - 8) {
    tooltipY = height - tooltipHeight - 8;
  }

  ctx.fillStyle = "rgba(18, 31, 42, 0.94)";
  roundRect(ctx, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 10);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  lines.forEach(function (line, index) {
    ctx.fillText(line, tooltipX + paddingX, tooltipY + paddingY + 12 + index * lineHeight);
  });
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
