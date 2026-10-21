/** Service conditions are expressed in original STL axes, after unit conversion to mm. */
export const END_FACES = ['x-min', 'x-max', 'y-min', 'y-max', 'z-min', 'z-max'] as const;
export type EndFace = typeof END_FACES[number];
export function endFace(face: EndFace) {
  if (!END_FACES.includes(face)) throw Error('Select a valid original-part end face.');
  return {axis: 'xyz'.indexOf(face[0]), maximum: face.endsWith('max')};
}
export function oppositeFace(face: EndFace): EndFace {
  endFace(face);
  return `${face[0]}-${face.endsWith('max') ? 'min' : 'max'}` as EndFace;
}
export type ServiceSetup = {
  youngModulusMPa: number; poissonRatio: number; forceXN: number; forceYN?: number; forceZN: number;
  resolution: number; coordinateFrame?: 'part'; fixedFace?: EndFace; displacementLimitMm?: number;
};
export const DEFAULT_SERVICE_SETUP: ServiceSetup = {
  youngModulusMPa: 110000, poissonRatio: .3, forceXN: 0, forceYN: 0, forceZN: 100,
  resolution: 8, coordinateFrame: 'part', fixedFace: 'z-min',
};
export function displacementAssessment(value: number, limit?: number) {
  if (limit === undefined) return {status: 'not-evaluated', detail: 'No displacement requirement supplied.'};
  if (!Number.isFinite(limit) || limit <= 0) throw Error('Displacement limit must be positive in mm.');
  return {status: value <= limit ? 'within-model-limit' : 'exceeds-model-limit', limitMm: limit,
    detail: 'Comparison to this simplified model only; not a strength, fatigue or manufacturing approval.'};
}

export function validateServiceSetup(value: unknown): asserts value is ServiceSetup {
  if (!value || typeof value !== 'object') throw Error('Invalid service-load setup.');
  const v=value as ServiceSetup;
  if(v.coordinateFrame!=='part') throw Error('Service setup must use original-part axes.');
  endFace(v.fixedFace??'z-min');
  if(!Number.isFinite(v.youngModulusMPa)||v.youngModulusMPa<=0||v.youngModulusMPa>1e7||!Number.isFinite(v.poissonRatio)||v.poissonRatio<=-1||v.poissonRatio>=.49)throw Error('Invalid elastic material properties.');
  if(![v.forceXN,v.forceYN??0,v.forceZN].every(Number.isFinite)||Math.abs(v.forceXN)+Math.abs(v.forceYN??0)+Math.abs(v.forceZN)>1e8)throw Error('Invalid service force.');
  if(!Number.isInteger(v.resolution)||v.resolution<6||v.resolution>12)throw Error('Structural resolution must be 6–12.');
  displacementAssessment(0,v.displacementLimitMm);
}
