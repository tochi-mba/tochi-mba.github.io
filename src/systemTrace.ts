// What happens when the hub uses one member of its family, as the steps the map plays back. The
// wording is the architecture's own: a request becomes a plan, each service checks the caller's
// token against keyring, and what comes back is data with its provenance, never an instruction.
import type { Project } from "./data";

/** The whole set of services at once, for the steps that fan out. */
export const EVERY_SERVICE = "*";

export interface TraceStep {
  /** A project's slug, or EVERY_SERVICE. */
  from: string;
  to: string;
  /** "LUCY → memory": who talks to whom. */
  label: string;
  /** What is said. */
  note: string;
}

const arrow = (from: string, to: string) => `${from} → ${to}`;

export function traceFor(project: Project, hub: Project, vault: Project): TraceStep[] {
  const name = project.name;
  if (project.slug === hub.slug) {
    return [
      { from: hub.slug, to: hub.slug, label: arrow("you", hub.name), note: "a request becomes a plan of named steps" },
      {
        from: hub.slug,
        to: EVERY_SERVICE,
        label: arrow(hub.name, "services"),
        note: "each step runs on the service that owns it",
      },
      {
        from: EVERY_SERVICE,
        to: hub.slug,
        label: arrow("services", hub.name),
        note: "results come back as data, with where they came from",
      },
    ];
  }
  if (project.slug === vault.slug) {
    return [
      {
        from: EVERY_SERVICE,
        to: vault.slug,
        label: arrow("services", name),
        note: "every call arrives with a person's token",
      },
      {
        from: vault.slug,
        to: EVERY_SERVICE,
        label: arrow(name, "services"),
        note: "a credential for that one call; no service keeps a secret",
      },
    ];
  }
  if (project.role === "runtime") {
    return [
      { from: hub.slug, to: project.slug, label: arrow(hub.name, name), note: "hands over the plan the model wrote" },
      {
        from: project.slug,
        to: hub.slug,
        label: arrow(name, hub.name),
        note: "validates it, runs it, and passes results between steps by name",
      },
    ];
  }
  if (project.role === "provider") {
    return [
      { from: hub.slug, to: project.slug, label: arrow(hub.name, name), note: "asks for a model's reply" },
      {
        from: project.slug,
        to: hub.slug,
        label: arrow(name, hub.name),
        note: "answers as a model, with no tools loaded",
      },
    ];
  }
  return [
    { from: hub.slug, to: project.slug, label: arrow(hub.name, name), note: "asks, on a person's behalf" },
    { from: project.slug, to: vault.slug, label: arrow(name, vault.name), note: "checks the caller's token" },
    {
      from: project.slug,
      to: hub.slug,
      label: arrow(name, hub.name),
      note: "answers with data and where it came from",
    },
  ];
}

/** The journeys one step draws: a single pair, or one per service when the step fans out. */
export function journeys(step: TraceStep, services: readonly string[]): [from: string, to: string][] {
  if (step.from === step.to) return [];
  if (step.from === EVERY_SERVICE) return services.filter((s) => s !== step.to).map((s) => [s, step.to]);
  if (step.to === EVERY_SERVICE) return services.filter((s) => s !== step.from).map((s) => [step.from, s]);
  return [[step.from, step.to]];
}
