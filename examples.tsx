import type { PcbPostRoutingHook, PcbPostRoutingHookContext } from "@tscircuit/props"

// A small connector-to-IC breakout: J1 (VCC, GND, SDA, SCL) wired to U1.
export const Breakout = ({ hook, pour }: { hook?: PcbPostRoutingHook; pour?: boolean }) => (
  <board width="26mm" height="18mm" pcbPostRoutingHook={hook}>
    <pinheader name="J1" pinCount={4} pitch="2.54mm" pcbX={-11.2} pcbY={0} pcbOrientation="vertical"
      pinLabels={["VCC", "GND", "SDA", "SCL"]} />
    <chip name="U1" footprint="soic8" pcbX={5} pcbY={0}
      pinLabels={{ pin1: "SDA", pin2: "SCL", pin4: "GND", pin8: "VCC" }} />
    <trace from=".J1 > .pin1" to=".U1 > .pin8" />
    <trace from=".J1 > .pin2" to=".U1 > .pin4" />
    <trace from=".J1 > .pin3" to=".U1 > .pin1" />
    <trace from=".J1 > .pin4" to=".U1 > .pin2" />
    <trace from=".J1 > .pin2" to="net.GND" />
    {pour && <copperpour connectsTo="net.GND" layer="top" />}
  </board>
)

// ---- geometry for the test-point example ----
type P = { x: number; y: number }
const segPointDist = (a: P, b: P, p: P) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y)
}
const segSegDist = (a: P, b: P, c: P, d: P) =>
  Math.min(segPointDist(a, b, c), segPointDist(a, b, d), segPointDist(c, d, a), segPointDist(c, d, b))

/**
 * Example 1: a test point on each connector pin. For every pin, try directions around it and take the
 * first one where a short stub plus a round pad keep clear of all other copper and of the board edge.
 */
export const addTestPoints = (ctx: PcbPostRoutingHookContext) => {
  const cj = ctx.getCircuitJson()
  const board = cj.find((e) => e.type === "pcb_board")!
  const STUB = 2.0, PAD_R = 0.6, TRACE_W = 0.25, CLEAR = 0.25, EDGE = 0.5
  const placed: Array<{ a: P; b: P }> = []
  for (const pin of [1, 2, 3, 4]) {
    const port = ctx.getPcbPort(`.J1 > .pin${pin}`)!
    const hole = cj.find((e) => e.type === "pcb_plated_hole" && e.pcb_port_id === port.pcb_port_id) as any
    const c = { x: hole.x, y: hole.y }
    // copper of everything else: traces (minus this pin's own escape), other pads and holes, earlier stubs
    const segs: Array<{ a: P; b: P; w: number }> = []
    for (const t of cj) {
      if (t.type !== "pcb_trace") continue
      for (let i = 0; i + 1 < t.route.length; i++) {
        const a = t.route[i] as any, b = t.route[i + 1] as any
        if (a.route_type !== "wire" || b.route_type !== "wire") continue
        if (Math.hypot(a.x - c.x, a.y - c.y) < 1.2 || Math.hypot(b.x - c.x, b.y - c.y) < 1.2) continue
        segs.push({ a, b, w: a.width })
      }
    }
    const blobs = cj
      .filter((e: any) => (e.type === "pcb_plated_hole" || e.type === "pcb_smtpad") && e.pcb_port_id !== port.pcb_port_id)
      .map((e: any) => ({ p: { x: e.x, y: e.y }, r: (e.outer_diameter ?? Math.max(e.width ?? 0, e.height ?? 0, (e.radius ?? 0) * 2)) / 2 }))
    for (let k = 0; k < 24; k++) {
      // prefer pointing away from the board centre, then sweep round
      const ang = Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12)
      const p = { x: c.x + STUB * Math.cos(ang), y: c.y + STUB * Math.sin(ang) }
      const inBoard =
        Math.abs(p.x - board.center.x) <= board.width / 2 - PAD_R - EDGE &&
        Math.abs(p.y - board.center.y) <= board.height / 2 - PAD_R - EDGE
      const clearOfTraces = segs.every(
        (s) => segPointDist(s.a, s.b, p) > PAD_R + s.w / 2 + CLEAR && segSegDist(s.a, s.b, c, p) > TRACE_W / 2 + s.w / 2 + CLEAR,
      )
      const clearOfPads = blobs.every((b) => Math.hypot(b.p.x - p.x, b.p.y - p.y) > b.r + PAD_R + CLEAR && segPointDist(c, p, b.p) > b.r + TRACE_W / 2 + CLEAR)
      const clearOfStubs = placed.every((s) => segSegDist(s.a, s.b, c, p) > TRACE_W + CLEAR && Math.hypot(s.b.x - p.x, s.b.y - p.y) > 2 * PAD_R + CLEAR)
      if (!(inBoard && clearOfTraces && clearOfPads && clearOfStubs)) continue
      ctx.insert({
        type: "pcb_trace",
        route: [
          { route_type: "wire", x: c.x, y: c.y, width: TRACE_W, layer: "top", start_pcb_port_id: port.pcb_port_id },
          { route_type: "wire", x: p.x, y: p.y, width: TRACE_W, layer: "top" },
        ],
      })
      ctx.insert({
        type: "pcb_smtpad", shape: "circle", x: p.x, y: p.y, radius: PAD_R, layer: "top", port_hints: [],
        pcb_port_id: port.pcb_port_id, pcb_component_id: port.pcb_component_id,
      })
      ctx.insert({
        type: "pcb_silkscreen_text", text: `TP${pin}`, font: "tscircuit2024", font_size: 0.6, layer: "top",
        anchor_alignment: "center", pcb_component_id: port.pcb_component_id,
        anchor_position: { x: p.x + 1.4 * Math.cos(ang), y: p.y + 1.4 * Math.sin(ang) },
      })
      placed.push({ a: c, b: p })
      break
    }
    if (!placed.some((s) => s.a === c)) {
      // no direction fits: report it like any other placement problem
      ctx.insert({ type: "pcb_placement_error", message: `No room for a test point on J1 pin ${pin}` })
    }
  }
}

/** Example 2: widen every trace segment on the power nets after routing. */
export const widenPowerTraces = (width: number) => (ctx: PcbPostRoutingHookContext) => {
  const cj = ctx.getCircuitJson()
  const powerPorts = new Set(
    [".J1 > .pin1", ".J1 > .pin2", ".U1 > .pin8", ".U1 > .pin4"].map(
      (s) => ctx.getPcbPort(s)!.pcb_port_id,
    ),
  )
  const sourcePorts = new Map(cj.filter((e) => e.type === "pcb_port").map((e: any) => [e.pcb_port_id, e.source_port_id]))
  const powerSourcePorts = new Set([...powerPorts].map((id) => sourcePorts.get(id)))
  for (const st of cj.filter((e) => e.type === "source_trace") as any[]) {
    if (!st.connected_source_port_ids.some((id: string) => powerSourcePorts.has(id))) continue
    for (const t of cj.filter((e: any) => e.type === "pcb_trace" && e.source_trace_id === st.source_trace_id) as any[]) {
      ctx.update(t.pcb_trace_id, {
        route: t.route.map((pt: any) => (pt.route_type === "wire" ? { ...pt, width } : pt)),
      })
    }
  }
}

/** Example 4: a naive hook that always puts the test point 2.5 mm to the right, across the routed traces. */
export const addTestPointsNaively = (ctx: PcbPostRoutingHookContext) => {
  const cj = ctx.getCircuitJson()
  for (const pin of [1, 2, 3, 4]) {
    const port = ctx.getPcbPort(`.J1 > .pin${pin}`)!
    const hole = cj.find((e) => e.type === "pcb_plated_hole" && e.pcb_port_id === port.pcb_port_id) as any
    ctx.insert({
      type: "pcb_smtpad", shape: "circle", x: hole.x + 2.5, y: hole.y, radius: 0.6, layer: "top", port_hints: [],
      pcb_port_id: port.pcb_port_id, pcb_component_id: port.pcb_component_id,
    })
  }
}
