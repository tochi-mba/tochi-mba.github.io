// The arithmetic behind the LUCY map's movement: a spring that brings a node back to where it
// belongs after a drag, and the timing of the slow drift that keeps the picture from being quite
// still. No DOM and no clock in here, so every number is unit-tested.

export interface Vec {
  x: number;
  y: number;
}

/**
 * One step of a damped spring pulling `pos` towards `target`. Semi-implicit Euler: velocity first,
 * then position, which stays stable at the frame times a browser gives. Slightly underdamped, so a
 * node that is let go overshoots once and settles.
 */
export function springStep(
  pos: Vec,
  vel: Vec,
  target: Vec,
  dt: number,
  stiffness = 150,
  damping = 14,
): { pos: Vec; vel: Vec } {
  const ax = stiffness * (target.x - pos.x) - damping * vel.x;
  const ay = stiffness * (target.y - pos.y) - damping * vel.y;
  const next = { x: vel.x + ax * dt, y: vel.y + ay * dt };
  return { pos: { x: pos.x + next.x * dt, y: pos.y + next.y * dt }, vel: next };
}

/** True when a node is close enough to its target, and slow enough, to stop being moved. */
export function settled(pos: Vec, vel: Vec, target: Vec): boolean {
  return Math.hypot(target.x - pos.x, target.y - pos.y) < 0.05 && Math.hypot(vel.x, vel.y) < 0.05;
}

/** The longest single step the spring takes: one frame at 60 Hz. */
export const SPRING_STEP = 1 / 60;

/**
 * Moves a spring on by `seconds`, in steps no longer than SPRING_STEP, so a node travels at the same
 * speed whatever the frame rate: a browser drawing 20 frames a second takes three steps a frame
 * rather than playing the motion in slow motion. Once settled it lands exactly on its target.
 */
export function advance(pos: Vec, vel: Vec, target: Vec, seconds: number): { pos: Vec; vel: Vec; settled: boolean } {
  const steps = Math.max(1, Math.ceil(seconds / SPRING_STEP - 1e-9));
  const dt = seconds / steps;
  let state = { pos, vel };
  for (let i = 0; i < steps; i += 1) state = springStep(state.pos, state.vel, target, dt);
  if (settled(state.pos, state.vel, target)) return { pos: { ...target }, vel: { x: 0, y: 0 }, settled: true };
  return { ...state, settled: false };
}

/**
 * The slow loop member `index` drifts round, as the timing of a CSS animation the compositor plays
 * without any script: a period of 9 to 14 seconds, and a head start that puts it partway round, so
 * no two members move together. Neighbours are a golden angle apart, so they are never in step.
 */
export function driftLoop(index: number): { seconds: number; delay: number } {
  const rate = 0.45 + (index % 5) * 0.06; // radians a second
  const seconds = (2 * Math.PI) / rate;
  const turn = ((index * 2.399963) / (2 * Math.PI)) % 1;
  return { seconds, delay: -turn * seconds };
}

/** How far a drag may pull a node from home, so it cannot be lost off the edge of the picture. */
export function clampPull(home: Vec, pointer: Vec, limit: number): Vec {
  const dx = pointer.x - home.x;
  const dy = pointer.y - home.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= limit) return pointer;
  return { x: home.x + (dx / distance) * limit, y: home.y + (dy / distance) * limit };
}
