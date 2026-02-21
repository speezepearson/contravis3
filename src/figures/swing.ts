import type { Keyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { makeDancerId, parseDancerId, normalizeBearing } from '../types';
import { copyDancers, resolveFacing, resolvePairs, isLark } from '../generateUtils';

export function generateSwing(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const FRONT = 0.15;
  const RIGHT = 0.1;
  // Phase offset: angle from CoM to lark (in heading convention) when lark faces 0°
  const PHASE_OFFSET = Math.PI + Math.atan2(RIGHT, FRONT);

  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const pairMap = resolvePairs(instr.relationship, prev.dancers, scope, { pairRoles: 'different' });

  // Collect pairs
  type SwingPair = {
    lark: ProtoDancerId;
    robin: ProtoDancerId;
    cx: number;
    cy: number;
    f0: number;
    omega: number;
    endFacingRad: number;
    phase2Start: number;
    phase2Duration: number;
  };

  const pairs: SwingPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const [id] of pairMap) {
    if (processed.has(id)) continue;

    const targetId = pairMap.get(id)!;
    const { proto: targetProto } = parseDancerId(targetId);

    const lark = isLark(id) ? id : targetProto;
    const robin = isLark(id) ? targetProto : id;

    processed.add(lark);
    processed.add(robin);

    // Compute CoM
    const larkState = prev.dancers[lark];
    const robinState = prev.dancers[robin];
    const cx = (larkState.x + robinState.x) / 2;
    const cy = (larkState.y + robinState.y) / 2;

    // Compute initial facing of lark from angle of CoM→lark
    const larkDx = larkState.x - cx;
    const larkDy = larkState.y - cy;
    const thetaLark = Math.atan2(larkDx, larkDy);
    const f0 = thetaLark - PHASE_OFFSET;

    // Resolve end facing for the lark
    const endFacingRad = resolveFacing(instr.endFacing, larkState, lark, prev.dancers);

    // Compute total rotation: closest to baseRotation that ends at endFacing
    const baseRotation = (Math.PI / 2) * instr.beats;
    const needed = endFacingRad - f0;
    const n = Math.round((baseRotation - needed) / (2 * Math.PI));
    const totalRotation = needed + n * 2 * Math.PI;
    const omega = totalRotation / instr.beats;

    // Phase 2 starts when the lark has 90° (π/2) of rotation left
    const phase2Duration = (Math.PI / 2) / omega;
    const phase2Start = instr.beats - phase2Duration;

    pairs.push({ lark, robin, cx, cy, f0, omega, endFacingRad, phase2Start, phase2Duration });
  }

  // Drop all hands involving swing participants, then take lark-right ↔ robin-left
  const swingHands = prev.hands.filter(h =>
    !processed.has(parseDancerId(h.a).proto) && !processed.has(parseDancerId(h.b).proto)
  );
  for (const { lark, robin } of pairs) {
    swingHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'left' });
  }

  const result: Keyframe[] = [];

  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const elapsed = t * instr.beats;

    const dancers = copyDancers(prev.dancers);

    for (const pair of pairs) {
      const { lark, robin, cx, cy, f0, omega, endFacingRad, phase2Start, phase2Duration } = pair;

      const larkFacingRad = f0 + omega * elapsed;

      if (elapsed <= phase2Start) {
        // Phase 1: regular swing orbit
        dancers[lark].x = cx - FRONT * Math.sin(larkFacingRad) - RIGHT * Math.cos(larkFacingRad);
        dancers[lark].y = cy - FRONT * Math.cos(larkFacingRad) + RIGHT * Math.sin(larkFacingRad);
        dancers[lark].facing = normalizeBearing(larkFacingRad);

        // Robin faces opposite
        const robinFacingRad = larkFacingRad + Math.PI;
        dancers[robin].x = cx + FRONT * Math.sin(larkFacingRad) + RIGHT * Math.cos(larkFacingRad);
        dancers[robin].y = cy + FRONT * Math.cos(larkFacingRad) - RIGHT * Math.sin(larkFacingRad);
        dancers[robin].facing = normalizeBearing(robinFacingRad);
      } else {
        // Phase 2: lark has 90° of rotation left
        const tLocal = (elapsed - phase2Start) / phase2Duration;

        const fP1End = f0 + omega * phase2Start;
        const larkP1EndX = cx - FRONT * Math.sin(fP1End) - RIGHT * Math.cos(fP1End);
        const larkP1EndY = cy - FRONT * Math.cos(fP1End) + RIGHT * Math.sin(fP1End);

        const larkFinalX = cx - 0.5 * Math.cos(endFacingRad);
        const larkFinalY = cy + 0.5 * Math.sin(endFacingRad);

        dancers[lark].x = larkP1EndX + (larkFinalX - larkP1EndX) * tLocal;
        dancers[lark].y = larkP1EndY + (larkFinalY - larkP1EndY) * tLocal;
        dancers[lark].facing = normalizeBearing(larkFacingRad);

        const robinFacingRad = larkFacingRad + Math.PI * (1 + tLocal);
        dancers[robin].facing = normalizeBearing(robinFacingRad);

        const robinFront = 0.3 * (1 - tLocal);
        const robinRight = 0.2 + 0.8 * tLocal;

        dancers[robin].x = dancers[lark].x + robinFront * Math.sin(larkFacingRad) + robinRight * Math.cos(larkFacingRad);
        dancers[robin].y = dancers[lark].y + robinFront * Math.cos(larkFacingRad) - robinRight * Math.sin(larkFacingRad);
      }
    }

    // Drop swing hands on the final frame
    const hands = i === nFrames
      ? swingHands.filter(h => !processed.has(parseDancerId(h.a).proto) || !processed.has(parseDancerId(h.b).proto))
      : swingHands;
    result.push({ beat, dancers, hands });
  }

  return result;
}
