
import type React from "react"

interface ResizeHandleProps {
  direction: "horizontal" | "vertical"
  onResize: (delta: number) => void
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    let lastPos = direction === "horizontal" ? e.clientX : e.clientY
    let animationFrameId: number | null = null

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (animationFrameId !== null) {
        return
      }

      animationFrameId = requestAnimationFrame(() => {
        const currentPos = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY
        const delta = currentPos - lastPos
        lastPos = currentPos
        onResize(delta)
        animationFrameId = null
      })
    }

    const handleMouseUp = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`group relative flex-shrink-0 ${
        direction === "horizontal" ? "w-1 cursor-col-resize hover:bg-accent" : "h-1 cursor-row-resize hover:bg-accent"
      } bg-border transition-colors`}
    >
      <div
        className={`absolute ${
          direction === "horizontal"
            ? "left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2"
            : "left-1/2 top-1/2 h-1 w-12 -translate-x-1/2 -translate-y-1/2"
        } rounded-full bg-muted-foreground opacity-0 transition-opacity group-hover:opacity-50`}
      />
    </div>
  )
}
