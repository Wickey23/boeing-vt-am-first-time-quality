# ORIENTAI aerospace AM teaching-part library

These sample STLs are **original simplified verification geometries** generated for the ORIENTAI senior-design prototype. They are *not* actual Boeing, GE, or NASA engineering models, and carry **no flightworthiness, manufacturability or material certification**.

| File | Geometry | Intended software test | Limitation |
| --- | --- | --- | --- |
| cube-10mm.stl | 10 mm closed cube | Baseline dimensions, 24 orthogonal rotations, heat/elastic solver check | Not representative of a production aerospace part |
| aerospace-overhang-bracket.stl | Extruded right-angle overhanging bracket | Build orientation, overhang exposure, support-screen differences | No fillets, mounting holes, optimization or verified fixture/load case |
| aerospace-thin-wall-channel.stl | Extruded thin-wall channel | Thin-feature resolution; demonstrate voxel-mesh limitation | Lower mesh resolutions may erase thin wall; do not trust FEM fields |
| aerospace-nozzle-sleeve.stl | Hollow annular sleeve | Hollow geometry and interior surface test | **Not** a working fuel nozzle: no injectors, swirl channels or combustion performance |

All dimensions in these ASCII STL examples are **millimeters**. The examples are pedagogical meshes. They must not be used to infer actual manufacturing parameters, service stresses, fatigue life, fuel efficiency or aircraft safety.

## Aerospace relevance and authoritative reference examples

- GE Aerospace documents large-scale LPBF production of the LEAP engine fuel nozzle tip: https://www.geaerospace.com/news/articles/manufacturing/manufacturing-milestone-30000-additive-fuel-nozzles
- GE Aerospace documents additively manufactured aircraft-engine brackets: https://www.geaerospace.com/news/articles/product/devil-details-so-you-3d-printed-part-jet-engine-part-now-what
- GE discusses the GE9X additive-manufactured heat exchanger and other components: https://www.ge.com/news/reports/the-next-generation-this-team-of-young-engineers-helped-bring-3d-printing-inside-the-worlds-largest-jet-engine

## Acceptance tests that must be performed

1. Load each STL on mobile and desktop; check displayed dimensions and model integrity.
2. Verify geometry screening on bracket and thin-wall examples, not just the cube.
3. Attempt physical solvers only after confirmed closure and voxel resolution; compare coarse/fine meshes.
4. Load an intentionally open or non-manifold STL and verify a clear, actionable error.
5. Export and independently review a complete report. A Vercel READY status alone is not acceptance.
