import { TestContact } from "./test-contact"

// Four test contacts wired to U1; each one finds its own tab direction after routing.
export const ProbeBoard = ({ tabs = true }: { tabs?: boolean }) => (
  <board width="22mm" height="16mm">
    <chip name="U1" footprint="soic8" pcbX={4} pcbY={0}
      pinLabels={{ pin1: "SDA", pin2: "SCL", pin4: "GND", pin8: "VCC" }} />
    <TestContact name="TP1" pcbX={-6} pcbY={3} tab={tabs} />
    <TestContact name="TP2" pcbX={-6} pcbY={1} tab={tabs} />
    <TestContact name="TP3" pcbX={-6} pcbY={-1} tab={tabs} />
    <TestContact name="TP4" pcbX={-6} pcbY={-3} tab={tabs} />
    <trace from=".TP1 > .pin1" to=".U1 > .pin8" />
    <trace from=".TP2 > .pin1" to=".U1 > .pin1" />
    <trace from=".TP3 > .pin1" to=".U1 > .pin2" />
    <trace from=".TP4 > .pin1" to=".U1 > .pin4" />
  </board>
)
