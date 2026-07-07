export function PlaceholderImage(
  width: number, 
  height: number, 
  backgroundColor = '#ff0000', 
  textColor = '#ffffff', 
  text = '') {

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    canvas.width = width
    canvas.height = height

    if (!ctx) {
      return null
    }

    // Fill background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // Add text if provided
    if (text) {
      ctx.fillStyle = textColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Calculate font size based on canvas size
      let fontSize = Math.min(width, height) / 10
      ctx.font = `${fontSize}px sans-serif`

      // Handle multi-line text
      const lines = text.split('+').map(line => line.trim())
      const lineHeight = fontSize * 1.2
      const totalHeight = lines.length * lineHeight
      const startY = (height - totalHeight) / 2 + fontSize / 2

      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + index * lineHeight)
      })
    }

    return canvas.toDataURL('image/png')
}