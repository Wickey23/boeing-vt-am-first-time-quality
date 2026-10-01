export type ValidationGate={id:string;label:string;state:"WORKING"|"NEEDS_DATA"|"NEXT"|"PLANNED";evidence:string};
export const targetValidationGates:ValidationGate[]=[
{id:"geometry",label:"Target geometry / design envelope",state:"NEEDS_DATA",evidence:"Boeing target component or approved surrogate definition"},
{id:"loads",label:"Loads + boundary conditions",state:"NEEDS_DATA",evidence:"Client-approved load cases, supports and interfaces"},
{id:"structural",label:"Structural screening",state:"WORKING",evidence:"Controlled thin-wall surrogate calculations"},
{id:"buckling",label:"Shell/local buckling",state:"NEXT",evidence:"Validated shell FEA + buckling model"},
{id:"fatigue",label:"Dynamics / fatigue",state:"NEXT",evidence:"Client requirements + validated solver workflow"},
{id:"am",label:"AM geometry/process screening",state:"WORKING",evidence:"Traceable deterministic research rules"},
{id:"process",label:"Qualified machine/process window",state:"NEEDS_DATA",evidence:"Approved printer/material/process information"},
{id:"physical",label:"Physical build + test correlation",state:"PLANNED",evidence:"Metal build, inspection and mechanical test results"},
{id:"ftq",label:"FTQ prediction model",state:"PLANNED",evidence:"Validated simulation/build/inspection/test dataset"}];