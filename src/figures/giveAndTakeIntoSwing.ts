import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { Vector, parseDancerId, normalizeBearing, makeFinalKeyframe } from '../types';
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
  finalCenter: Vector;
  startCenter: Vector;
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
    if (Math.sign(aState.pos.x) === Math.sign(bState.pos.x) && Math.abs(aState.pos.x) > 1e-6 && Math.abs(bState.pos.x) > 1e-6) {
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
    const toDrawee = draweeState.pos.subtract(drawerState.pos);
    const toDrawer = drawerState.pos.subtract(draweeState.pos);
    dancers[drawer].facing = normalizeBearing(Math.atan2(toDrawee.x, toDrawee.y));
    dancers[drawee].facing = normalizeBearing(Math.atan2(toDrawer.x, toDrawer.y));
    // Drawee moves halfway to drawer
    dancers[drawee].pos = drawerState.pos.add(draweeState.pos).multiply(0.5);
  }
  return { beat: prev.beat + walkBeats, dancers, hands: prev.hands };
}

function computeDriftData(prev: Keyframe, afterWalk: Keyframe, pairs: GTPair[]): DriftDatum[] {
  // Compute facing from the walk-start state (facing each other)
  const walkStartDancers = copyDancers(prev.dancers);
  for (const { drawer, drawee } of pairs) {
    const drawerState = prev.dancers[drawer];
    const draweeState = prev.dancers[drawee];
    const toDrawee = draweeState.pos.subtract(drawerState.pos);
    walkStartDancers[drawer].facing = normalizeBearing(Math.atan2(toDrawee.x, toDrawee.y));
  }

  const driftData: DriftDatum[] = [];
  for (const { drawer, lark, robin } of pairs) {
    const drawerState = prev.dancers[drawer];
    const drawerFacing = walkStartDancers[drawer].facing;
    const sign = isLark(drawer) ? 1 : -1;
    const rightX = sign * Math.cos(drawerFacing);
    const rightY = sign * -Math.sin(drawerFacing);
    const finalCenter = new Vector(
      drawerState.pos.x + 0.5 * rightX,
      drawerState.pos.y + 0.5 * rightY,
    );

    const startCenter = afterWalk.dancers[lark].pos.add(afterWalk.dancers[robin].pos).multiply(0.5);

    driftData.push({ lark, robin, finalCenter, startCenter });
  }

  return driftData;
}

function applyDrift(kf: Keyframe, driftData: DriftDatum[], t: number): Keyframe {
  const tEased = easeInOut(t);
  const dancers = copyDancers(kf.dancers);
  for (const { lark, robin, finalCenter, startCenter } of driftData) {
    const currentCenter = kf.dancers[lark].pos.add(kf.dancers[robin].pos).multiply(0.5);
    const targetCenter = startCenter.add(finalCenter.subtract(startCenter).multiply(tEased));
    const shift = targetCenter.subtract(currentCenter);
    dancers[lark].pos = dancers[lark].pos.add(shift);
    dancers[robin].pos = dancers[robin].pos.add(shift);
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
    const toDrawee = draweeState.pos.subtract(drawerState.pos);
    const toDrawer = drawerState.pos.subtract(draweeState.pos);
    walkStartDancers[drawer].facing = normalizeBearing(Math.atan2(toDrawee.x, toDrawee.y));
    walkStartDancers[drawee].facing = normalizeBearing(Math.atan2(toDrawer.x, toDrawer.y));
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
      const halfway = drawerPos.pos.add(draweeStart.pos).multiply(0.5);
      dancers[drawee].pos = draweeStart.pos.add(halfway.subtract(draweeStart.pos).multiply(tEased));
      dancers[drawee].facing = walkStart.dancers[drawee].facing;
      dancers[drawer].pos = drawerPos.pos;
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
