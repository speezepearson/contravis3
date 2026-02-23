# Shoulder round

Parameters:
- default 8 beats
- a FoilRelationship
- a handedness, `'right' | 'left'`
- a new flavor of facing: `'larks up, robins down' | 'larks down, robins up' | 'larks across, robins out' | 'larks out, robins across'`

Displays like: `[shoulder round] [left] your [neighbor], end facing [larks up, robins down]`

Final keyframe:
- the relationship induces a pairing between larks and robins; within each pair, the dancers will have the same center of mass as they started with; they will end 0.5m apart; they will be facing the appropriate directions; each will be on the other's [right/left]; there will be no hand connections. There should be tests for these facts; these facts should fully specify the end state.

Keyframe generation:
- the two dancers immediately face each other
- they begin walking in a `handedness====right ? clockwise : counterclockwise` ellipse, just like in a pass-by-[right/left]; but they only go around 1/4 of the ellipse, so that each one is directly on the other's [handedness: right/left]
- they revolve around their common center of mass, approximately 1 rotation every 4 beats, as with a swing
- ...and round the number of beats down so that they end up facing the appropriate directions.
