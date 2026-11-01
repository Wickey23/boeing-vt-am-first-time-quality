import ticker from "../../CHANGE_TICKER.json";

/**
 * Development activity counter from the existing GitHub Action.
 * This is a code-change count, NOT a quality score or defect statistic.
 */
export default function EngineeringBuildTicker(){
 return <div className="oaBuildTicker" aria-label={`Engineering development change ticker ${ticker.count}`}
  title="Counts code/config changes on main. Not a print-quality metric.">
  <span className="oaBuildTickerPulse" aria-hidden="true"/>
  <span className="oaBuildTickerText">
   <strong>QUALITY ENGINE DEVELOPMENT</strong>
   <small>Deterministic screening · tracked code changes</small>
  </span>
  <span className="oaBuildTickerValue" aria-label={`${ticker.count} code changes`}>{String(ticker.count).padStart(3,"0")}</span>
 </div>;
}
