import AppShell from "@/components/v2/AppShell";
import EngineeringCopilot from "@/components/EngineeringCopilot";
export default function CopilotWorkspace(){return <AppShell title="AI Engineering Copilot" focused>
 <div className="copilotIntro">
  <p className="guidedEyebrow">ORIENTAI · ASSEMBLY-AWARE ENGINEERING</p>
  <h1>Understand the whole build. Analyze the right part.</h1>
  <p>Upload a part and its surrounding engineering references. Confirm its role, interfaces and load cases, then run the supported calculations while reviewing their evidence.</p>
 </div>
 <EngineeringCopilot/>
 </AppShell>}
