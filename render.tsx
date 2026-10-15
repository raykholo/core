// bun walkthrough/render.tsx : renders every example without and with its steps, 2D (PCB SVG -> PNG) and 3D (GLB -> PNG)
import "lib/register-catalogue"
import { RootCircuit } from "lib/RootCircuit"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { Resvg } from "@resvg/resvg-js"
import { writeFileSync } from "node:fs"
import { resolvePoppyglOptions } from "tests/fixtures/extend-expect-3d-matcher"
import { Breakout } from "./breakout"
import { addTestPoints, addTestPointsNaively, widenPowerTraces } from "./steps"
import { ProbeBoard } from "./probe-board"
import { ProbeEarsBoard } from "./probe-ears"

const cases: Record<string, any> = {
  "1-test-points-before": <Breakout />,
  "1-test-points-after": (
    <Breakout>
      <pcbpostroutingstep name="test points" fn={addTestPoints} />
    </Breakout>
  ),
  "2-power-width-before": <Breakout />,
  "2-power-width-after": (
    <Breakout>
      <pcbpostroutingstep name="power width" fn={widenPowerTraces(0.4)} />
    </Breakout>
  ),
  "3-stacked-before": <Breakout />,
  "3-stacked-after": (
    <Breakout>
      <pcbpostroutingstep name="power width" order={1} fn={widenPowerTraces(0.4)} />
      <pcbpostroutingstep name="test points" order={2} fn={addTestPoints} />
    </Breakout>
  ),
  "4-pour-before": <Breakout pour />,
  "4-pour-after": (
    <Breakout pour>
      <pcbpostroutingstep name="test points" fn={addTestPoints} />
    </Breakout>
  ),
  "5-drc-after": (
    <Breakout>
      <pcbpostroutingstep name="naive test points" fn={addTestPointsNaively} />
    </Breakout>
  ),
  "6-render-before": <ProbeBoard tabs={false} />,
  "6-render-after": <ProbeBoard />,
  "7-ears-before": <ProbeEarsBoard ears={false} />,
  "7-ears-after": <ProbeEarsBoard />,
}
for (const [name, board] of Object.entries(cases)) {
  const circuit = new RootCircuit()
  circuit.add(board)
  await circuit.renderUntilSettled()
  const cj = circuit.getCircuitJson() as any[]
  writeFileSync(`walkthrough/out/${name}.circuit.json`, JSON.stringify(cj))
  const svg = convertCircuitJsonToPcbSvg(cj)
  writeFileSync(`walkthrough/out/${name}-pcb.png`, new Resvg(svg, { fitTo: { mode: "width", value: 900 } }).render().asPng())
  const glb = (await convertCircuitJsonToGltf(cj, { boardTextureResolution: 1024, includeModels: true, showBoundingBoxes: false, format: "glb" })) as any
  const opts = await resolvePoppyglOptions(cj, { camPos: [0, 30, -10], poppygl: { width: 900, height: 620, grid: undefined as any } })
  writeFileSync(`walkthrough/out/${name}-3d.png`, await renderGLTFToPNGFromGLB(Buffer.from(glb), opts))
  const errors = cj.filter((e) => e.type.endsWith("_error")).map((e) => e.message)
  console.log(name, "errors:", errors.length, errors.slice(0, 3))
}
