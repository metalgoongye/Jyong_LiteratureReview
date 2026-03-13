'use client'

export interface CausalNode {
  id: string
  label: string
  type: 'independent' | 'mediator' | 'dependent'
}

export interface CausalEdge {
  from: string
  to: string
  coefficient?: string | null
  pvalue?: string | null
  direction?: '+' | '-' | null
}

export interface CausalMethodology {
  method_name?: string | null
  analysis_type?: string | null
  table_reference?: string | null
  page_reference?: string | null
}

export interface CausalPaths {
  nodes: CausalNode[]
  edges: CausalEdge[]
  methodology?: CausalMethodology | null
}

const NODE_W = 150
const NODE_H = 44
const COL_GAP = 170
const ROW_GAP = 72
const PAD_X = 16
const PAD_Y = 28

function dispatchPageSelect(ref: string | null | undefined) {
  if (!ref) return
  const match = ref.match(/\d+/)
  if (!match) return
  window.dispatchEvent(new CustomEvent('pdf-page-select', { detail: { page: parseInt(match[0]) } }))
}

export function CausalDiagram({ paths }: { paths: CausalPaths }) {
  const { nodes, edges, methodology } = paths
  if (!nodes || nodes.length === 0) return null

  const COLS = ['independent', 'mediator', 'dependent'] as const
  const colNodes = COLS.map(type => nodes.filter(n => n.type === type))
  const activeCols = colNodes.map((col, i) => col.length > 0 ? i : -1).filter(i => i >= 0)

  const canvasWidth = activeCols.length * (NODE_W + COL_GAP) - COL_GAP + PAD_X * 2
  const maxRows = Math.max(...colNodes.map(c => c.length), 1)
  const canvasHeight = maxRows * NODE_H + (maxRows - 1) * (ROW_GAP - NODE_H) + PAD_Y * 2 + 16

  const nodeMap = new Map<string, { cx: number; cy: number }>()
  let colIdx = 0
  COLS.forEach((type, ci) => {
    const col = colNodes[ci]
    if (col.length === 0) return
    const totalH = col.length * NODE_H + (col.length - 1) * (ROW_GAP - NODE_H)
    const startY = PAD_Y + 16 + (canvasHeight - PAD_Y * 2 - 16 - totalH) / 2
    col.forEach((node, idx) => {
      nodeMap.set(node.id, {
        cx: PAD_X + colIdx * (NODE_W + COL_GAP) + NODE_W / 2,
        cy: startY + idx * ROW_GAP + NODE_H / 2,
      })
    })
    colIdx++
  })

  const colLabels = [
    { label: '독립변수', color: '#0369a1' },
    { label: '매개변수', color: '#059669' },
    { label: '종속변수', color: '#b45309' },
  ]

  return (
    <div className="mb-6">
      <h4 className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-3 flex items-center gap-2">
        인과 경로
        <span className="px-1.5 py-0.5 rounded text-xs normal-case tracking-normal" style={{ background: 'rgba(99,102,241,0.12)', color: '#4338ca', fontSize: '10px' }}>
          Causal Framework
        </span>
      </h4>
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto p-3">
          <svg width={canvasWidth} height={canvasHeight} style={{ display: 'block' }}>
            <defs>
              {edges.map((_, i) => {
                const edge = edges[i]
                const color = edge.direction === '+' ? '#16a34a' : edge.direction === '-' ? '#dc2626' : '#6b7280'
                return (
                  <marker key={i} id={`arr-${i}`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                    <path d="M0,0 L0,7 L7,3.5 z" fill={color} opacity="0.8" />
                  </marker>
                )
              })}
            </defs>

            {/* Column labels */}
            {COLS.map((type, ci) => {
              if (colNodes[ci].length === 0) return null
              const activeIdx = activeCols.indexOf(ci)
              return (
                <text
                  key={type}
                  x={PAD_X + activeIdx * (NODE_W + COL_GAP) + NODE_W / 2}
                  y={18}
                  textAnchor="middle"
                  fontSize="9"
                  fill={colLabels[ci].color}
                  fontWeight="700"
                  opacity={0.7}
                  style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  {colLabels[ci].label}
                </text>
              )
            })}

            {/* Edges */}
            {edges.map((edge, i) => {
              const from = nodeMap.get(edge.from)
              const to = nodeMap.get(edge.to)
              if (!from || !to) return null
              const color = edge.direction === '+' ? '#16a34a' : edge.direction === '-' ? '#dc2626' : '#6b7280'
              const x1 = from.cx + NODE_W / 2
              const y1 = from.cy
              const x2 = to.cx - NODE_W / 2
              const y2 = to.cy
              const mx = (x1 + x2) / 2

              const parts = []
              if (edge.direction) parts.push(edge.direction === '+' ? '+' : '−')
              if (edge.coefficient) parts.push(edge.coefficient)
              if (edge.pvalue) parts.push(`(${edge.pvalue})`)
              const label = parts.join(' ')

              const midY = (y1 + y2) / 2

              return (
                <g key={i}>
                  <path
                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    markerEnd={`url(#arr-${i})`}
                    opacity={0.75}
                  />
                  {label && (
                    <text
                      x={(x1 + x2) / 2}
                      y={midY - 7}
                      textAnchor="middle"
                      fontSize="9"
                      fill={color}
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      {label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {COLS.map((type, ci) =>
              colNodes[ci].map(node => {
                const pos = nodeMap.get(node.id)
                if (!pos) return null
                const x = pos.cx - NODE_W / 2
                const y = pos.cy - NODE_H / 2
                const fills = { independent: '#eff6ff', mediator: '#f0fdf4', dependent: '#fffbeb' }
                const strokes = { independent: '#bfdbfe', mediator: '#bbf7d0', dependent: '#fde68a' }
                const textColors = { independent: '#1e3a5f', mediator: '#14532d', dependent: '#78350f' }

                // Wrap label at ~18 chars
                const words = node.label.split(' ')
                const lines: string[] = []
                let curr = ''
                words.forEach(w => {
                  if ((curr + ' ' + w).trim().length > 18 && curr) {
                    lines.push(curr)
                    curr = w
                  } else {
                    curr = (curr + ' ' + w).trim()
                  }
                })
                if (curr) lines.push(curr)

                return (
                  <g key={node.id}>
                    <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={8}
                      fill={fills[type]} stroke={strokes[type]} strokeWidth="1.5" />
                    {lines.length === 1 ? (
                      <text x={pos.cx} y={pos.cy} textAnchor="middle" dominantBaseline="middle"
                        fontSize="11" fill={textColors[type]} fontWeight="500">
                        {lines[0]}
                      </text>
                    ) : (
                      lines.map((line, li) => (
                        <text key={li} x={pos.cx}
                          y={pos.cy + (li - (lines.length - 1) / 2) * 13}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize="10" fill={textColors[type]} fontWeight="500">
                          {line}
                        </text>
                      ))
                    )}
                  </g>
                )
              })
            )}
          </svg>
        </div>

        {/* Methodology row */}
        {methodology && (methodology.method_name || methodology.analysis_type || methodology.table_reference) && (
          <div
            className="px-3 pb-3 flex flex-wrap items-center gap-2"
            style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
          >
            <span className="text-xs opacity-40 font-medium">분석방법</span>
            {methodology.method_name && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#4338ca' }}
              >
                {methodology.method_name}
              </span>
            )}
            {methodology.analysis_type && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.5)' }}
              >
                {methodology.analysis_type}
              </span>
            )}
            {methodology.table_reference && (
              <button
                onClick={() => dispatchPageSelect(methodology.page_reference || methodology.table_reference)}
                className="text-xs px-2 py-0.5 rounded-full font-mono transition-opacity hover:opacity-80"
                style={{ background: 'rgba(212,255,0,0.3)', color: '#5a6000', cursor: 'pointer' }}
                title={`PDF ${methodology.table_reference}로 이동`}
              >
                {methodology.table_reference}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
