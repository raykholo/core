import type { ReactNode } from "react"

// A small connector-to-IC breakout: J1 (VCC, GND, SDA, SCL) wired to U1.
// Post-routing steps go in as children.
export const Breakout = ({ pour, children }: { pour?: boolean; children?: ReactNode }) => (
  <board width="26mm" height="18mm">
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
    {children}
  </board>
)
