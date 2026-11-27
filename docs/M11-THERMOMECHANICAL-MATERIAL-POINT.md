# M11 print-induced thermomechanical research: initial material-point verification

This is an independent synthetic material-point benchmark, not the completion of M10 or M11. M10 in the master roadmap is structural service-load analysis upgrade; M11 concerns manufacturing residual stress/distortion and depends on M08, M09 and M10. The production structural solver is not changed.

## Model
Small-strain uniaxial total strain = elastic + thermal + plastic strain. Thermal strain is alpha times temperature change. With prescribed total strain, compute a trial stress using Young's modulus and previous plastic strain; clamp to the positive/negative yield stress and update plastic strain by the return increment. With traction-free conditions stress is zero and total strain is thermal plus plastic strain. Start at zero stress and reference temperature. Constant E, yield and expansion coefficient are explicitly supplied with a source label.

## Predeclared synthetic verification
Use E=200000 MPa, yield=200 MPa, alpha=1e-5/K, reference 20 C (illustrative, not an alloy card). A free 300 K temperature rise gives 0.003 strain and zero stress. A fixed 50 K rise gives -100 MPa and returns to zero after cooling. A fixed 300 K rise yields at -200 MPa with -0.002 plastic strain; fixed cooling to reference reverses yield to +200 MPa with -0.001 plastic strain. Idealized traction-free release gives zero axial stress and -0.001 total strain. Check strain decomposition and reject invalid histories or strain above the chosen 5% research bound. Exact-head tests must pass before claiming implementation verification.

## Limitations and next gate
This does not predict a part's residual stress or distortion: a material point has no compatibility/equilibrium with neighbors. Temperature histories are prescribed, not silently taken from command-end snapshots; actual thermal coupling requires deposition stress-free references, adequate temporal sampling, calibrated temperature-dependent mechanical data, and mechanically compatible domain/constraints. Future work must demonstrate structural service solver convergence, geometry-aware mechanical equilibrium and independently measured strain/deflection before validated manufacturing predictions.
