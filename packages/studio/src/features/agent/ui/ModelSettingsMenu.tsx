import type {AgentReasoningEffort} from "../models/agent";
import {REASONING_EFFORT_LABELS, type ReasoningPolicy} from "../../settings/models/reasoningPolicy";

const DEFAULT_LABEL = "默认";
/** Up to this many levels render as segments; more render as a slider. */
const SEGMENTED_MAX_LEVELS = 4;

/**
 * Effort control shown below the model list. Step 0 is the model default (no effort sent);
 * the remaining steps are exactly the levels the model/connector supports.
 */
export function ReasoningEffortControl({policy, effort, onChange}: {
    policy: ReasoningPolicy;
    effort?: AgentReasoningEffort;
    onChange: (effort: AgentReasoningEffort | undefined) => void;
}) {
    const steps: Array<AgentReasoningEffort | undefined> = [undefined, ...policy.levels];
    const index = Math.max(0, steps.indexOf(effort));
    const label = (value: AgentReasoningEffort | undefined) => value ? REASONING_EFFORT_LABELS[value] : DEFAULT_LABEL;
    return <div className="agent-effort" data-testid="reasoning-effort">
        <div className="agent-effort-head">
            <span id="agent-effort-label">推理强度</span>
            <strong aria-live="polite">{label(steps[index])}</strong>
        </div>
        {policy.levels.length <= SEGMENTED_MAX_LEVELS
            ? <div className="agent-effort-segments" role="radiogroup" aria-labelledby="agent-effort-label">
                {steps.map((value) => <button key={value ?? "default"} type="button" role="radio"
                                              aria-checked={value === steps[index]}
                                              className={`agent-effort-segment${value === steps[index] ? " is-selected" : ""}`}
                                              onClick={() => onChange(value)}>{label(value)}</button>)}
            </div>
            : <input type="range" className="agent-effort-slider" aria-labelledby="agent-effort-label"
                     min={0} max={steps.length - 1} step={1} value={index}
                     aria-valuetext={label(steps[index])}
                     onChange={(event) => onChange(steps[Number(event.target.value)])}/>}
    </div>;
}
