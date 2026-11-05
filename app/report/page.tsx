import {redirect} from "next/navigation";
/** The current workbench owns the consolidated failure-assessment report. */
export default function Report(){redirect("/copilot/workbench?stage=assessment");}
