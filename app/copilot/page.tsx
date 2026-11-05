import {redirect} from "next/navigation";
/** Compatibility route: all engineering studies use the current workbench. */
export default function CopilotWorkspace(){redirect("/copilot/workbench");}
