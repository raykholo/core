// bun walkthrough/render.tsx : renders every example without and with its hook, 2D (PCB SVG -> PNG) and 3D (GLB -> PNG)
import "lib/register-catalogue"
import { RootCircuit } from "lib/RootCircuit"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { Resvg } from "@resvg/resvg-js"
import { writeFileSync } from "node:fs"
import { resolvePoppyglOptions } from "tests/fixtures/extend-expect-3d-matcher"
import { Breakout, addTestPoints, addTestPointsNaively, widenPowerTraces } from "./examples"

const cases: Record<string, any> = {
  "1-test-points-before": <Breakout />,
  "1-test-points-after": <Breakout hook={addTestPoints} />,
  "2-power-width-before": <Breakout />,
  "2-power-width-after": <Breakout hook={widenPowerTraces(0.4)} />,
  "4-drc-after": <Breakout hook={addTestPointsNaively} />,
  "3-pour-before": <Breakout pour />,
  "3-pour-after": <Breakout pour hook={addTestPoints} />,
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
  writeFileSync(`walkthrough/out/${name}.errors.json`, JSON.stringify(errors, null, 1))
  console.log(name, "errors:", errors.length, errors.slice(0, 4))
}
