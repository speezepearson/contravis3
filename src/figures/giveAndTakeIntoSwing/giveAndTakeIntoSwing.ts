import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { Vector, parseDancerId, makeFinalKeyframe } from '../../types';
import { copyDancers, resolvePairs, isLark } from '../../generateUtils';
import { finalSwing, generateSwing } from '../swing/swing';

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
    dancers[drawer].facing = toDrawee.normalize();
    dancers[drawee].facing = toDrawer.normalize();
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
    walkStartDancers[drawer].facing = toDrawee.normalize();
  }

  const driftData: DriftDatum[] = [];
  for (const { drawer, lark, robin } of pairs) {
    const drawerState = prev.dancers[drawer];
    const drawerFacing = walkStartDancers[drawer].facing;
    const sign = isLark(drawer) ? 1 : -1;
    // "right" from facing direction: (facing.y, -facing.x) for CW 90°
    const rightX = sign * drawerFacing.y;
    const rightY = sign * -drawerFacing.x;
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
  const dancers = copyDancers(kf.dancers);
  for (const { lark, robin, finalCenter, startCenter } of driftData) {
    const currentCenter = kf.dancers[lark].pos.add(kf.dancers[robin].pos).multiply(0.5);
    const targetCenter = startCenter.add(finalCenter.subtract(startCenter).multiply(t));
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

export function generateGiveAndTakeIntoSwing(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'give_and_take_into_swing' }>, scope: Set<ProtoDancerId>): KeyframeFn {
  const walkBeats = 1;
  const swingBeats = instr.beats - walkBeats;
  const pairs = resolvePairsForGT(prev, instr, scope);

  // Walk setup: face each other immediately
  const walkStartDancers = copyDancers(prev.dancers);
  for (const { drawer, drawee } of pairs) {
    const drawerState = prev.dancers[drawer];
    const draweeState = prev.dancers[drawee];
    walkStartDancers[drawer].facing = draweeState.pos.subtract(drawerState.pos).normalize();
    walkStartDancers[drawee].facing = drawerState.pos.subtract(draweeState.pos).normalize();
  }

  // Compute afterWalk state for the swing phase
  const afterWalk = computeAfterWalk(prev, pairs, walkBeats);

  // Swing setup
  const swingInstr: Extract<AtomicInstruction, { type: 'swing' }> = {
    id: instr.id,
    beats: swingBeats,
    type: 'swing',
    relationship: instr.relationship,
    endFacing: instr.endFacing,
  };
  const swingFinal = finalSwing(afterWalk, swingInstr, scope);
  const swingFn = generateSwing(afterWalk, swingFinal, swingInstr, scope);

  const driftData = computeDriftData(prev, afterWalk, pairs);

  return (t: number) => {
    const elapsedBeats = t * instr.beats;

    if (elapsedBeats <= walkBeats) {
      // Walk phase: drawee walks halfway to drawer
      const tWalk = elapsedBeats / walkBeats;
      const beat = prev.beat + elapsedBeats;
      const dancers = copyDancers(walkStartDancers);
      for (const { drawer, drawee } of pairs) {
        const draweeStart = prev.dancers[drawee];
        const drawerPos = prev.dancers[drawer];
        const halfway = drawerPos.pos.add(draweeStart.pos).multiply(0.5);
        dancers[drawee].pos = draweeStart.pos.add(halfway.subtract(draweeStart.pos).multiply(tWalk));
        dancers[drawee].facing = walkStartDancers[drawee].facing;
        dancers[drawer].pos = drawerPos.pos;
        dancers[drawer].facing = walkStartDancers[drawer].facing;
      }
      return { beat, dancers, hands: prev.hands };
    } else {
      // Swing phase with CoM drift
      const tSwing = (elapsedBeats - walkBeats) / swingBeats;
      const swingKf = swingFn(tSwing);
      return applyDrift(swingKf, driftData, tSwing);
    }
  };
}
