import type { PcbPostRoutingContext } from "@tscircuit/props"

type P = { x: number; y: number }
const segPointDist = (a: P, b: P, p: P) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y)
}

const TAB_R = 0.5, REACH = 1.0, CLEAR = 0.3

/**
 * Where the probe tab goes: of eight directions around the contact, the one with the most room
 * between the tab and any other copper. Measured on the routed board.
 */
const bestTabDirection = (ctx: PcbPostRoutingContext, name: string) => {
  const cj = ctx.getCircuitJson()
  const own = ctx.getPcbPort(`.${name} > .pin1`)!
  const c = ctx.getPcbComponent(`.${name}`)!.center
  const segments = cj.flatMap((t) => {
    if (t.type !== "pcb_trace") return []
    // every trace counts, the contact's own escape too, so the tab never sits on a trace
    const wires = t.route.filter((p) => p.route_type === "wire") as Array<P & { width: number }>
    return wires.slice(1).map((b, i) => ({ a: wires[i], b, w: b.width }))
  })
  const pads = cj.flatMap((e: any) =>
    (e.type === "pcb_plated_hole" || e.type === "pcb_smtpad") && e.pcb_port_id !== own.pcb_port_id
      ? [{ p: { x: e.x, y: e.y }, r: (e.outer_diameter ?? Math.max(e.width ?? 0, e.height ?? 0, (e.radius ?? 0) * 2)) / 2 }]
      : [],
  )
  let best = { angle: 0, room: -Infinity }
  for (let k = 0; k < 8; k++) {
    const angle = (k * Math.PI) / 4
    const tab = { x: c.x + REACH * Math.cos(angle), y: c.y + REACH * Math.sin(angle) }
    const room = Math.min(
      ...segments.map((s) => segPointDist(s.a, s.b, tab) - s.w / 2 - TAB_R),
      ...pads.map((d) => Math.hypot(d.p.x - tab.x, d.p.y - tab.y) - d.r - TAB_R),
    )
    if (room > best.room) best = { angle, room }
  }
  return best
}

/**
 * A press-fit test contact that adds its own probe tab after routing, in TSX: the step sits in the
 * contact's footprint, so the pad joins the contact's port and its position is relative to the contact.
 */
export const TestContact = ({ name, pcbX, pcbY, tab = true }: { name: string; pcbX: number; pcbY: number; tab?: boolean }) => (
  <chip
    name={name}
    pcbX={pcbX}
    pcbY={pcbY}
    footprint={
      <footprint>
        <platedhole shape="circle" holeDiameter={0.8} outerDiameter={1.4} portHints={["1"]} pcbX={0} pcbY={0} />
        {tab && <pcbpostroutingstep
          name={`${name} probe tab`}
          render={(ctx) => {
            const { angle, room } = bestTabDirection(ctx, name)
            if (room < CLEAR) return null
            const x = REACH * Math.cos(angle), y = REACH * Math.sin(angle)
            return <smtpad shape="circle" radius={TAB_R} portHints={["1"]} pcbX={x} pcbY={y} layer="top" />
          }}
        />}
      </footprint>
    }
  />
)
