import Link from "next/link";
import AppShell from "@/components/v2/AppShell";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  Box,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Layers3,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

const entryPoints = [
  {
    href: "/copilot",
    number: "01",
    label: "AI-GUIDED PART WORKFLOW",
    title: "Discuss and analyze your part",
    description:
      "Upload an STL and assembly references, explain the part to an engineering assistant, then run supported orientation and service studies.",
    action: "Open engineering copilot",
    icon: Upload,
    className: "entryCardPrimary",
  },
  {
    href: "/orientation?example=ded",
    number: "02",
    label: "DED EXPLORATION",
    title: "Explore a DED example",
    description:
      "Use a synthetic bead-wall teaching model to explore directed-energy deposition tracks and illustrative process assumptions.",
    action: "Launch DED example",
    icon: Layers3,
    className: "entryCardSecondary",
  },
  {
    href: "/report",
    number: "03",
    label: "ENGINEERING EVIDENCE",
    title: "Review your evidence",
    description:
      "Inspect available study outputs and export a report that keeps assumptions, data provenance, and research limitations visible.",
    action: "View reports",
    icon: ClipboardCheck,
    className: "entryCardTertiary",
  },
];

const stages = [
  { number: "01", title: "Define", detail: "Part & requirements" },
  { number: "02", title: "Evaluate", detail: "Geometry & process" },
  { number: "03", title: "Compare", detail: "Trade-offs & evidence" },
  { number: "04", title: "Document", detail: "Traceable report" },
];

export default function Home() {
  return (
    <AppShell title="Projects">
      <div className="homeStudio">
        <section className="homeHero" aria-labelledby="home-hero-title">
          <div className="homeHeroCopy">
            <div className="homeEyebrow">
              <span className="homeEyebrowDot" />
              ORIENTAI <span className="homeEyebrowDivider">/</span> METAL ADDITIVE MANUFACTURING
            </div>
            <div className="homeHeroKicker">
              <Sparkles size={14} />
              ENGINEERING DECISIONS, MADE CLEARER
            </div>
            <h2 id="home-hero-title">
              Better builds
              <br />
              <span>start with better questions.</span>
            </h2>
            <p className="homeHeroDescription">
              A guided workspace for exploring part geometry, engineering needs,
              metal-printing strategies, and the evidence behind each decision.
            </p>
            <div className="homeHeroActions">
              <Link className="homeButton homeButtonPrimary" href="/copilot">
                Start a part study <ArrowUpRight size={17} />
              </Link>
              <Link className="homeButton homeButtonGhost" href="/how-it-works">
                How it works <ArrowRight size={16} />
              </Link>
            </div>
            <div className="homeHeroFootnote">
              <ShieldCheck size={15} />
              <span>Research prototype · Independent engineering review required</span>
            </div>
          </div>

          <div className="homeHeroVisual" aria-label="Illustration of a metal additive-manufacturing component">
            <div className="homeVisualTopline">
              <span><span className="homeLiveDot" /> ENGINEERING VIEW</span>
              <span>OR-01 / CONCEPT</span>
            </div>
            <div className="homeBlueprint">
              <div className="homeBlueprintCross homeBlueprintCrossA" />
              <div className="homeBlueprintCross homeBlueprintCrossB" />
              <div className="homePartModel" aria-hidden="true">
                <div className="homePartTop" />
                <div className="homePartFace" />
                <div className="homePartSide" />
                <div className="homePartHole homePartHoleA" />
                <div className="homePartHole homePartHoleB" />
                <div className="homePartRib homePartRibA" />
                <div className="homePartRib homePartRibB" />
              </div>
              <div className="homeDimension homeDimensionX"><span /> <b>GEOMETRY</b></div>
              <div className="homeDimension homeDimensionY"><span /> <b>BUILD AXIS</b></div>
              <div className="homeVisualCoordinates">X  000.0 <i /> Y  000.0 <i /> Z  000.0</div>
            </div>
            <div className="homeVisualBottomline">
              <div><span>STUDY MODE</span><strong>Preliminary evaluation</strong></div>
              <div className="homeVisualChip"><Activity size={14} /> Evidence-led</div>
            </div>
          </div>
        </section>

        <section className="homeWorkflow" aria-label="Study workflow">
          <div className="homeWorkflowIntro">
            <span className="homeSectionEyebrow">YOUR WORKFLOW</span>
            <h3>From part to decision</h3>
          </div>
          <div className="homeWorkflowStages">
            {stages.map((stage, index) => (
              <div className="homeWorkflowStage" key={stage.number}>
                <span className="homeStageNumber">{stage.number}</span>
                <div><strong>{stage.title}</strong><small>{stage.detail}</small></div>
                {index < stages.length - 1 && <ArrowRight className="homeStageArrow" size={16} />}
              </div>
            ))}
          </div>
        </section>

        <section className="homeEntrySection" aria-labelledby="home-entry-title">
          <div className="homeSectionHeader">
            <div>
              <span className="homeSectionEyebrow">CHOOSE YOUR NEXT STEP</span>
              <h3 id="home-entry-title">What would you like to work on?</h3>
            </div>
            <span className="homeSectionAside">Three clear entry points. One research workspace.</span>
          </div>
          <div className="homeEntryGrid">
            {entryPoints.map((entry) => {
              const Icon = entry.icon;
              return (
                <Link href={entry.href} className={`homeEntryCard ${entry.className}`} key={entry.number}>
                  <div className="homeEntryCardTop">
                    <span className="homeEntryIcon"><Icon size={21} strokeWidth={1.8} /></span>
                    <span className="homeEntryNumber">{entry.number}</span>
                  </div>
                  <span className="homeEntryLabel">{entry.label}</span>
                  <h4>{entry.title}</h4>
                  <p>{entry.description}</p>
                  <span className="homeEntryAction">{entry.action}<ArrowUpRight size={16} /></span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="homeTrustStrip" aria-label="Research limitations">
          <div className="homeTrustIcon"><ShieldCheck size={21} /></div>
          <div className="homeTrustCopy">
            <strong>Designed for informed exploration—not automatic approval.</strong>
            <p>Scores and simulations are preliminary research outputs. They do not establish certification, qualified process parameters, structural adequacy, or a probability of first-time acceptance.</p>
          </div>
          <Link href="/validation" className="homeTrustLink">Review validation approach <ArrowRight size={15} /></Link>
        </section>

        <footer className="homeFooter">
          <div><span className="homeFooterMark">VT</span><span>Virginia Tech · Senior Design</span></div>
          <span><CheckCircle2 size={14} /> Assumptions and limitations stay in view</span>
          <Link href="/how-it-works">Technical guide <ArrowUpRight size={14} /></Link>
        </footer>
      </div>
    </AppShell>
  );
}
