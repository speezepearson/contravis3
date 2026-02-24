import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { makeFinalKeyframe } from '../../types';
import { copyDancers, isLark } from '../../generateUtils';

export function finalTurnAlone(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'turn_alone' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const dancers = copyDancers(prev.dancers);
  for (const id of scope) {
    dancers[id].facing = dancers[id].facing.rotateByDegrees(180);
  }
  return makeFinalKeyframe({ beat: prev.beat + instr.beats, dancers, hands: prev.hands });
}

export function generateTurnAlone(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'turn_alone' }>, scope: Set<ProtoDancerId>): KeyframeFn {
  return (t: number) => {
    const beat = prev.beat + t * instr.beats;
    const dancers = copyDancers(prev.dancers);
    for (const id of scope) {
      dancers[id].facing = prev.dancers[id].facing.rotateByDegrees(180 * t * (isLark(id) ? -1 : 1));
    }
    return { beat, dancers, hands: prev.hands };
  };
}
