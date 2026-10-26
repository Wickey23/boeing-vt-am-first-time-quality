/**
 * DED teaching-wall manufacturing planner.
 * These are nominal geometric/motion calculations, not a slicer, machine controller,
 * validated deposition thermal physics, kinematic reach check, or quality prediction.
 */
export type DedProcess = "DED_LB_WIRE" | "DED_LB_POWDER";
export type DedStrategy = "alternating" | "one-way";
export type Millimeters3 = { x: number; y: number; z: number };
export type DedWallInput = {
  process: DedProcess;
  strategy: DedStrategy;
  materialLabel: string;
  wallLengthMm: number;
  wallHeightMm: number;
  beadWidthMm: number;
  beadHeightMm: number;
  substrateLengthMm: number;
  substrateWidthMm: number;
  substrateThicknessMm: number;
  depositionSpeedMmS: number;
  traverseSpeedMmS: number;
  interpassDwellS: number;
  powerW: number | null;
  machineEnvelopeMm: Millimeters3 | null;
  // These are explicitly hypothetical factory-simulation inputs in minutes.
  setupMin: number;
  cooldownMin: number;
  machiningMin: number;
  inspectionMin: number;
  batchSize: number;
  releaseIntervalMin: number;
};
export type Track = {
  index: number;
  layer: number;
  from: [number, number, number];
  to: [number, number, number];
  lengthMm: number;
  startTimeS: number;
  endTimeS: number;
};
export type DedResult = {
  scenarioId: string;
  input: DedWallInput;
  tracks: Track[];
  layers: number;
  actualWallHeightMm: number;
  nominalVolumeMm3: number;
  depositionLengthMm: number;
  repositionLengthMm: number;
  depositionSeconds: number;
  repositionSeconds: number;
  interpassSeconds: number;
  commandedSubtotalSeconds: number;
  linearEnergyJMm: number | null;
  envelopeCheck: "NOT_CONFIGURED" | "BOX_FITS" | "BOX_EXCEEDS";
  limitations: string[];
  warnings: string[];
};
export type FlowResult = {
  completed: number;
  meanLeadTimeMin: number;
  meanQueueTimeMin: number;
  totalElapsedMin: number;
  throughputPerHour: number;
  utilization: Record<string, number>;
  completionsMin: number[];
  assumptions: string[];
};
export const DED_WALL_EXAMPLE: DedWallInput = {
  process: "DED_LB_WIRE",
  strategy: "alternating",
  materialLabel: "Unspecified teaching alloy (not a property card)",
  wallLengthMm: 60,
  wallHeightMm: 8,
  beadWidthMm: 2,
  beadHeightMm: 1,
  substrateLengthMm: 100,
  substrateWidthMm: 40,
  substrateThicknessMm: 8,
  depositionSpeedMmS: 5,
  traverseSpeedMmS: 20,
  interpassDwellS: 10,
  powerW: null,
  machineEnvelopeMm: null,
  setupMin: 10,
  cooldownMin: 15,
  machiningMin: 20,
  inspectionMin: 10,
  batchSize: 5,
  releaseIntervalMin: 0,
};

function finite(value: number, label: string, min: number, max: number, exclusiveMin = false) {
  if (typeof value !== "number" || !Number.isFinite(value) ||
      (exclusiveMin ? value <= min : value < min) || value > max) {
    throw new Error(label + " must be " + (exclusiveMin ? "greater than " : "at least ") +
      min + " and no more than " + max + ".");
  }
  return value;
}
function stableScenarioKey(input: DedWallInput) {
  // Stable ID for local candidate comparisons. This is NOT a cryptographic hash.
  const source = JSON.stringify(input);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  }
  return "ded-wall-" + (hash >>> 0).toString(16).padStart(8, "0");
}
export function validateDedWall(input: DedWallInput): void {
  if (!input || (input.process !== "DED_LB_WIRE" && input.process !== "DED_LB_POWDER")) {
    throw new Error("Choose a supported laser wire-fed or laser powder-fed DED process.");
  }
  if (input.strategy !== "alternating" && input.strategy !== "one-way") {
    throw new Error("Choose a supported wall deposition strategy.");
  }
  if (typeof input.materialLabel !== "string" || input.materialLabel.trim().length === 0 ||
      input.materialLabel.length > 120) throw new Error("A material label is required (not an approved property card).");
  finite(input.wallLengthMm, "Wall length (mm)", 1, 2000);
  finite(input.wallHeightMm, "Wall height (mm)", 0, 1000, true);
  finite(input.beadWidthMm, "Bead width (mm)", 0, 30, true);
  finite(input.beadHeightMm, "Bead height (mm)", 0, 20, true);
  finite(input.substrateLengthMm, "Substrate length (mm)", 1, 5000);
  finite(input.substrateWidthMm, "Substrate width (mm)", 1, 5000);
  finite(input.substrateThicknessMm, "Substrate thickness (mm)", 0, 500, true);
  finite(input.depositionSpeedMmS, "Deposition speed (mm/s)", 0, 1000, true);
  finite(input.traverseSpeedMmS, "Traverse speed (mm/s)", 0, 1000, true);
  finite(input.interpassDwellS, "Interpass dwell (s)", 0, 36000);
  if (input.wallLengthMm > input.substrateLengthMm || input.beadWidthMm > input.substrateWidthMm) {
    throw new Error("Nominal deposited wall must fit the substrate footprint.");
  }
  if (input.beadHeightMm > input.wallHeightMm) throw new Error("Bead height cannot exceed the target wall height.");
  if (Math.ceil(input.wallHeightMm / input.beadHeightMm) > 200) {
    throw new Error("The teaching wall supports at most 200 nominal deposited layers.");
  }
  if (input.powerW !== null) finite(input.powerW, "User-supplied laser power (W)", 0, 100000, true);
  if (input.machineEnvelopeMm !== null) {
    if (!input.machineEnvelopeMm || typeof input.machineEnvelopeMm !== "object") throw new Error("Incomplete machine box.");
    for (const axis of ["x", "y", "z"] as const) finite(input.machineEnvelopeMm[axis], "Machine envelope " + axis + " (mm)", 0, 100000, true);
  }
  for (const key of ["setupMin", "cooldownMin", "machiningMin", "inspectionMin", "releaseIntervalMin"] as const) {
    finite(input[key], key + " (min)", 0, 100000);
  }
  finite(input.batchSize, "Batch size", 1, 100);
  if (!Number.isInteger(input.batchSize)) throw new Error("Batch size must be an integer.");
}
function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
export function planDedWall(input: DedWallInput): DedResult {
  validateDedWall(input);
  const layers = Math.ceil(input.wallHeightMm / input.beadHeightMm);
  const tracks: Track[] = [];
  let depositionLengthMm = 0;
  let repositionLengthMm = 0;
  let repositionSeconds = 0;
  let depositionSeconds = 0;
  let interpassSeconds = 0;
  let elapsedS = 0;
  for (let i = 0; i < layers; i++) {
    const z = input.substrateThicknessMm + (i + 0.5) * input.beadHeightMm;
    const reverse = input.strategy === "alternating" && i % 2 === 1;
    const from: [number, number, number] = [reverse ? input.wallLengthMm / 2 : -input.wallLengthMm / 2, 0, z];
    const to: [number, number, number] = [reverse ? -input.wallLengthMm / 2 : input.wallLengthMm / 2, 0, z];
    if (i > 0) {
      const d = distance(tracks[i - 1].to, from);
      repositionLengthMm += d;
      const travelS = d / input.traverseSpeedMmS;
      repositionSeconds += travelS;
      interpassSeconds += input.interpassDwellS;
      elapsedS += input.interpassDwellS + travelS;
    }
    const length = distance(from, to);
    const depositionS = length / input.depositionSpeedMmS;
    tracks.push({ index: i + 1, layer: i + 1, from, to, lengthMm: length,
      startTimeS: elapsedS, endTimeS: elapsedS + depositionS });
    depositionLengthMm += length;
    depositionSeconds += depositionS;
    elapsedS += depositionS;
  }
  const actualWallHeightMm = layers * input.beadHeightMm;
  const box = input.machineEnvelopeMm;
  const envelopeCheck = !box ? "NOT_CONFIGURED" :
    input.substrateLengthMm <= box.x && input.substrateWidthMm <= box.y &&
    input.substrateThicknessMm + actualWallHeightMm <= box.z ? "BOX_FITS" : "BOX_EXCEEDS";
  const warnings = [
    "Machine/head reach, nozzle collision, kinematics, shielding and qualified settings are unverified.",
    "Bead footprint and build volume use an assumed rectangular cross-section; no melting or deposition quality is simulated.",
  ];
  if (actualWallHeightMm - input.wallHeightMm > 1e-8) warnings.push("Layer count overshoots the requested nominal wall height; review machining allowance.");
  if (envelopeCheck === "BOX_EXCEEDS") warnings.push("Teaching wall/substrate exceeds the entered axis-aligned machine box.");
  if (envelopeCheck === "BOX_FITS") warnings.push("Bounding-box fit is not machine reach or a collision-free deposition path.");
  return {
    scenarioId: stableScenarioKey(input), input, tracks, layers, actualWallHeightMm,
    nominalVolumeMm3: input.wallLengthMm * input.beadWidthMm * actualWallHeightMm,
    depositionLengthMm, repositionLengthMm,
    depositionSeconds, repositionSeconds, interpassSeconds, commandedSubtotalSeconds: elapsedS,
    linearEnergyJMm: input.powerW === null ? null : input.powerW / input.depositionSpeedMmS,
    envelopeCheck, warnings,
    limitations: [
      "Teaching geometry is a single-bead wall on a simple substrate, NOT a toolpath generated from an uploaded STL.",
      "Commanded travel-time estimate ignores acceleration, startup/purge, feed transients, thermal limits and finishing.",
      "Illustrative post-processing and inspection durations are scenario assumptions, not observed factory data.",
      "No transient thermal, distortion, residual stress, metallurgy, defect, fatigue or first-pass quality prediction.",
      "This output cannot be executed on a printer and does not establish manufacturing approval.",
    ],
  };
}
export type Operation = { id: string; resource: string; durationMin: number; basis: string };
export function makeOperations(plan: DedResult): Operation[] {
  const i = plan.input;
  return [
    { id: "setup", resource: "technician", durationMin: i.setupMin, basis: "illustrative_user_input" },
    { id: "deposition", resource: "ded_cell", durationMin: plan.commandedSubtotalSeconds / 60, basis: "ideal_commanded_motion_plus_dwell" },
    { id: "cooldown", resource: "cooldown_station", durationMin: i.cooldownMin, basis: "illustrative_user_input" },
    { id: "machining", resource: "machine_shop", durationMin: i.machiningMin, basis: "illustrative_user_input" },
    { id: "inspection", resource: "inspection_station", durationMin: i.inspectionMin, basis: "illustrative_user_input" },
  ];
}
/** Deterministic FIFO single-server flow-shop teaching reference, NOT Simio execution. */
export function simulateReferenceFlow(plan: DedResult): FlowResult {
  const ops = makeOperations(plan);
  const available = new Map<string, number>();
  const busy = new Map<string, number>();
  let sumLead = 0, sumQueue = 0, lastCompletion = 0;
  const completionsMin: number[] = [];
  for (let job = 0; job < plan.input.batchSize; job++) {
    const release = job * plan.input.releaseIntervalMin;
    let ready = release;
    for (const op of ops) {
      const start = Math.max(ready, available.get(op.resource) ?? 0);
      sumQueue += start - ready;
      ready = start + op.durationMin;
      available.set(op.resource, ready);
      busy.set(op.resource, (busy.get(op.resource) ?? 0) + op.durationMin);
    }
    completionsMin.push(ready);
    sumLead += ready - release;
    lastCompletion = Math.max(lastCompletion, ready);
  }
  const horizon = Math.max(lastCompletion, 1e-9);
  return {
    completed: plan.input.batchSize,
    meanLeadTimeMin: sumLead / plan.input.batchSize,
    meanQueueTimeMin: sumQueue / plan.input.batchSize,
    totalElapsedMin: lastCompletion,
    throughputPerHour: plan.input.batchSize * 60 / horizon,
    utilization: Object.fromEntries([...busy].map(([resource, minutes]) => [resource, minutes / horizon])),
    completionsMin,
    assumptions: [
      "Research reference flow simulation; no Simio executable or runtime was invoked.",
      "Each operation has one always-available capacity-one resource, FIFO jobs and constant operation duration.",
      "No shifts, failures, setup changeover dependencies, stochastic variability, scrap, rework or real first-pass yield.",
      "Deposition time is ideal nominal motion and dwell only; setup/cooldown/machining/inspection use illustrative assumptions.",
    ],
  };
}
function csvCell(value: string | number | null) {
  const raw = value === null ? "" : String(value);
  return '"' + raw.replace(/"/g, '""') + '"';
}
function csvTable(headers: string[], rows: Array<Array<string | number | null>>) {
  return [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function createSimioExchange(plan: DedResult, flow: FlowResult) {
  const ops = makeOperations(plan);
  const operationsCsv = csvTable(
    ["scenario_id","step","operation_id","resource_id","mean_duration_min","duration_basis"],
    ops.map((op, i) => [plan.scenarioId, i + 1, op.id, op.resource, op.durationMin, op.basis])
  );
  const resourcesCsv = csvTable(
    ["scenario_id","resource_id","capacity","availability_assumption"],
    ops.map(op => [plan.scenarioId, op.resource, 1, "24_7_illustrative"])
  );
  const jobsCsv = csvTable(
    ["scenario_id","job_id","release_time_min","quantity"],
    flow.completionsMin.map((_, i) => [plan.scenarioId, "job-" + (i + 1), i * plan.input.releaseIntervalMin, 1])
  );
  const tracksCsv = csvTable(
    ["scenario_id","track","layer","from_x_mm","from_y_mm","from_z_mm","to_x_mm","to_y_mm","to_z_mm","length_mm","start_time_s","end_time_s"],
    plan.tracks.map(t => [plan.scenarioId,t.index,t.layer,...t.from,...t.to,t.lengthMm,t.startTimeS,t.endTimeS])
  );
  const summaryCsv = csvTable(
    ["scenario_id","engine","completed_jobs","mean_lead_min","mean_queue_min","elapsed_min","throughput_per_hour"],
    [[plan.scenarioId,"orientai_reference_deterministic_des",flow.completed,flow.meanLeadTimeMin,flow.meanQueueTimeMin,flow.totalElapsedMin,flow.throughputPerHour]]
  );
  const manifest = {
    schema: "orientai-ded-simio-exchange-v1",
    scenarioId: plan.scenarioId,
    geometry: "synthetic_single_bead_wall_on_substrate",
    process: plan.input.process,
    evidence: "illustrative_motion_and_deterministic_factory_scenario",
    engine: "orientai_reference_deterministic_des",
    executableSimioModelIncluded: false,
    machineFeasibilityEstablished: false,
    physicalQualificationEstablished: false,
    createdFrom: "explicit_ded_wall_inputs",
    assumptions: flow.assumptions,
    limitations: plan.limitations,
    warnings: plan.warnings,
    inputs: plan.input,
    outputs: {
      layers: plan.layers,
      depositionLengthMm: plan.depositionLengthMm,
      commandedSubtotalSeconds: plan.commandedSubtotalSeconds,
      envelopeCheck: plan.envelopeCheck,
      completed: flow.completed,
      meanLeadTimeMin: flow.meanLeadTimeMin,
    },
    importInstructions: "Bind the exported operations/resources/jobs tables to a team-authored Simio model; run Simio experiments and export results separately. These files are source data, not an executable .spfx Simio project."
  };
  return {
    "scenario.json": JSON.stringify(manifest, null, 2) + "\n",
    "operations.csv": operationsCsv,
    "resources.csv": resourcesCsv,
    "jobs.csv": jobsCsv,
    "tracks.csv": tracksCsv,
    "reference-results.csv": summaryCsv,
  };
}
