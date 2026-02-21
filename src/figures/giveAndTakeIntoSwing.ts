import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { parseDancerId, normalizeBearing, makeFinalKeyframe } from '../types';
import { copyDancers, easeInOut, resolvePairs, isLark } from '../generateUtils';
import { finalSwing, generateSwing } from './swing';

type GTPair = {
  drawer: ProtoDancerId;
  drawee: ProtoDancerId;
  lark: ProtoDancerId;
  robin: ProtoDancerId;
};

type DriftDatum = {
  lark: ProtoDancerId;
  robin: ProtoDancerId;
  finalCx: number;
  finalCy: number;
  startCx: number;
  startCy: number;
};

function resolvePairsForGT(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'give_and_take_into_swing' }>, scope: Set<ProtoDancerId>) {
  const pairMap = resolvePairs(instr.relationship, prev.dancers, scope, { pairRoles: 'different' });

  const pairs: GTPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const [id] of pairMap) {
    if (processed.has(id)) continue;

    const targetId = pairMap.get(id)!;
    const { proto: targetProto } = parseDancerId(targetId);

    const aState = prev.dancers[id];
    const bState = prev.dancers[targetProto];
    if (Math.sign(aState.x) === Math.sign(bState.x) && Math.abs(aState.x) > 1e-6 && Math.abs(bState.x) > 1e-6) {
      throw new Error(`Give & take into swing: ${id} and ${targetProto} are on the same side of the set`);
    }

    const lark = isLark(id) ? id : targetProto;
    const robin = isLark(id) ? targetProto : id;
    const drawer = instr.role === 'lark' ? lark : robin;
    const drawee = instr.role === 'lark' ? robin : lark;

    processed.add(lark);
    processed.add(robin);
    pairs.push({ drawer, drawee, lark, robin });
  }

  return pairs;
}

/** Compute the keyframe after the walk phase: drawee halfway to drawer, both facing each other. */
function computeAfterWalk(prev: Keyframe, pairs: GTPair[], walkBeats: number): Keyframe {
  const dancers = copyDancers(prev.dancers);
  for (const { drawer, drawee } of pairs) {
    const drawerState = prev.dancers[drawer];
    const draweeState = prev.dancers[drawee];
    dancers[drawer].facing = normalizeBearing(Math.atan2(draweeState.x - drawerState.x, draweeState.y - drawerState.y));
    dancers[drawee].facing = normalizeBearing(Math.atan2(drawerState.x - draweeState.x, drawerState.y - draweeState.y));
    // Drawee moves halfway to drawer
    dancers[drawee].x = (drawerState.x + draweeState.x) / 2;
    dancers[drawee].y = (drawerState.y + draweeState.y) / 2;
  }
  return { beat: prev.beat + walkBeats, dancers, hands: prev.hands };
}

function computeDriftData(prev: Keyframe, afterWalk: Keyframe, pairs: GTPair[]): DriftDatum[] {
  // Compute facing from the walk-start state (facing each other)
  const walkStartDancers = copyDancers(prev.dancers);
  for (const { drawer, drawee } of pairs) {
    const drawerState = prev.dancers[drawer];
    const draweeState = prev.dancers[drawee];
    walkStartDancers[drawer].facing = normalizeBearing(Math.atan2(draweeState.x - drawerState.x, draweeState.y - drawerState.y));
  }

  const driftData: DriftDatum[] = [];
  for (const { drawer, lark, robin } of pairs) {
    const drawerState = prev.dancers[drawer];
    const drawerFacing = walkStartDancers[drawer].facing;
    const sign = isLark(drawer) ? 1 : -1;
    const rightX = sign * Math.cos(drawerFacing);
    const rightY = sign * -Math.sin(drawerFacing);
    const finalCx = drawerState.x + 0.5 * rightX;
    const finalCy = drawerState.y + 0.5 * rightY;

    const startCx = (afterWalk.dancers[lark].x + afterWalk.dancers[robin].x) / 2;
    const startCy = (afterWalk.dancers[lark].y + afterWalk.dancers[robin].y) / 2;

    driftData.push({ lark, robin, finalCx, finalCy, startCx, startCy });
  }

  return driftData;
}

function applyDrift(kf: Keyframe, driftData: DriftDatum[], t: number): Keyframe {
  const tEased = easeInOut(t);
  const dancers = copyDancers(kf.dancers);
  for (const { lark, robin, finalCx, finalCy, startCx, startCy } of driftData) {
    const currentCx = (kf.dancers[lark].x + kf.dancers[robin].x) / 2;
    const currentCy = (kf.dancers[lark].y + kf.dancers[robin].y) / 2;
    const targetCx = startCx + (finalCx - startCx) * tEased;
    const targetCy = startCy + (finalCy - startCy) * tEased;
    const shiftX = targetCx - currentCx;
    const shiftY = targetCy - currentCy;
    dancers[lark].x += shiftX;
    dancers[lark].y += shiftY;
    dancers[robin].x += shiftX;
    dancers[robin].y += shiftY;
  }
  return { ...kf, dancers };
}

export function finalGiveAndTakeIntoSwing(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'give_and_take_into_swing' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const walkBeats = 1;
  const swingBeats = instr.beats - walkBeats;
  const pairs = resolvePairsForGT(prev, instr, scope);

  const afterWalk = computeAfterWalk(prev, pairs, walkBeats);

  const swingInstr: Extract<AtomicInstruction, { type: 'swing' }> = {
    id: instr.id,
    beats: swingBeats,
    type: 'swing',
    relationship: instr.relationship,
    endFacing: instr.endFacing,
  };
  const swingFinal = finalSwing(afterWalk, swingInstr, scope);

  // Apply full drift to swing final
  const driftData = computeDriftData(prev, afterWalk, pairs);
  const drifted = applyDrift(swingFinal, driftData, 1);

  return makeFinalKeyframe({
    beat: drifted.beat,
    dancers: drifted.dancers,
    hands: drifted.hands,
  });
}

export function generateGiveAndTakeIntoSwing(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'give_and_take_into_swing' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const walkBeats = 1;
  const swingBeats = instr.beats - walkBeats;
  const pairs = resolvePairsForGT(prev, instr, scope);

  // Phase 1: walk — face each other immediately, drawee walks halfway
  const walkStartDancers = copyDancers(prev.dancers);
  for (const { drawer, drawee } of pairs) {
    const drawerState = prev.dancers[drawer];
    const draweeState = prev.dancers[drawee];
    walkStartDancers[drawer].facing = normalizeBearing(Math.atan2(draweeState.x - drawerState.x, draweeState.y - drawerState.y));
    walkStartDancers[drawee].facing = normalizeBearing(Math.atan2(drawerState.x - draweeState.x, drawerState.y - draweeState.y));
  }
  const walkStart: Keyframe = { beat: prev.beat, dancers: walkStartDancers, hands: prev.hands };

  const walkNFrames = Math.max(1, Math.round(walkBeats / 0.25));
  const walkFrames: Keyframe[] = [];
  for (let i = 1; i <= walkNFrames; i++) {
    const t = i / walkNFrames;
    const beat = prev.beat + t * walkBeats;
    const tEased = easeInOut(t);
    const dancers = copyDancers(walkStart.dancers);
    for (const { drawer, drawee } of pairs) {
      const draweeStart = prev.dancers[drawee];
      const drawerPos = prev.dancers[drawer];
      const halfwayX = (drawerPos.x + draweeStart.x) / 2;
      const halfwayY = (drawerPos.y + draweeStart.y) / 2;
      dancers[drawee].x = draweeStart.x + (halfwayX - draweeStart.x) * tEased;
      dancers[drawee].y = draweeStart.y + (halfwayY - draweeStart.y) * tEased;
      dancers[drawee].facing = walkStart.dancers[drawee].facing;
      dancers[drawer].x = drawerPos.x;
      dancers[drawer].y = drawerPos.y;
      dancers[drawer].facing = walkStart.dancers[drawer].facing;
    }
    walkFrames.push({ beat, dancers, hands: prev.hands });
  }

  // Phase 2: swing from the meeting point, with CoM drift
  const afterWalk = walkFrames.length > 0 ? walkFrames[walkFrames.length - 1] : walkStart;

  const swingInstr: Extract<AtomicInstruction, { type: 'swing' }> = {
    id: instr.id,
    beats: swingBeats,
    type: 'swing',
    relationship: instr.relationship,
    endFacing: instr.endFacing,
  };
  const swingFinal = finalSwing(afterWalk, swingInstr, scope);
  const rawSwingIntermediates = generateSwing(afterWalk, swingFinal, swingInstr, scope);

  const driftData = computeDriftData(prev, afterWalk, pairs);

  // Apply drift to swing intermediates
  // Total swing frames = intermediates + 1 (for the swing final that becomes the G&T final)
  const nTotalSwingFrames = rawSwingIntermediates.length + 1;
  const shiftedSwingIntermediates = rawSwingIntermediates.map((kf, idx) => {
    const t = (idx + 1) / nTotalSwingFrames;
    return applyDrift(kf, driftData, t);
  });

  return [...walkFrames, ...shiftedSwingIntermediates];
}
