// utils/canvas-chart.js
// Canvas 2D 折线图绘制

/**
 * 绘制折线图
 * @param {CanvasRenderingContext2D} ctx canvas 2D 上下文
 * @param {Object} canvasNode canvas 节点对象
 * @param {Array} data [{label: "07-01", value: 1.9441}, ...]
 * @param {Object} options {lineColor, pointColor, bgColor, width, height, showLabels}
 */
function drawLineChart(ctx, canvasNode, data, options) {
  const {
    lineColor = '#3498db',
    pointColor = '#3498db',
    bgColor = '#ffffff',
    width = 300,
    height = 200,
    showLabels = true
  } = options || {}

  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  if (!data || data.length === 0) {
    ctx.fillStyle = '#95a5a6'
    ctx.font = '14px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('暂无走势数据', width / 2, height / 2)
    return
  }

  const values = data.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth

  // 网格线
  ctx.strokeStyle = '#ecf0f1'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }

  // Y 轴标签
  ctx.fillStyle = '#95a5a6'
  ctx.font = '10px -apple-system, sans-serif'
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i
    const val = maxVal - (range / 4) * i
    ctx.fillText(val.toFixed(4), padding.left - 8, y + 4)
  }

  // 折线
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()

  const points = data.map((d, i) => ({
    x: padding.left + (data.length > 1 ? i * stepX : chartWidth / 2),
    y: padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight
  }))

  points.forEach((p, i) => {
    if (i === 0) {
      ctx.moveTo(p.x, p.y)
    } else {
      ctx.lineTo(p.x, p.y)
    }
  })
  ctx.stroke()

  // 填充区域
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight)
  gradient.addColorStop(0, lineColor + '30')
  gradient.addColorStop(1, lineColor + '05')
  ctx.fillStyle = gradient
  ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight)
  ctx.lineTo(points[0].x, padding.top + chartHeight)
  ctx.closePath()
  ctx.fill()

  // 数据点
  ctx.fillStyle = pointColor
  points.forEach(p => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
    ctx.fill()
  })

  // X 轴标签
  if (showLabels) {
    ctx.fillStyle = '#95a5a6'
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    const labelStep = Math.max(1, Math.floor(data.length / 5))
    data.forEach((d, i) => {
      if (i % labelStep === 0 || i === data.length - 1) {
        const x = points[i].x
        ctx.fillText(d.label, x, height - 10)
      }
    })
  }
}

module.exports = {
  drawLineChart
}
