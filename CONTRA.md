# The conceptual

- Every contra dancer is either a "lark" (sometimes called "gents" or "gentlespoons") or a "robin" (sometimes called "ladies" or "ladles"). If a move involves a lark and a robin, and they end facing the same direction, the lark will typically be on the left, relative to the direction they're facing (lark = L = left, robin = R = right).

- A "set" of contra dancers is two parallel lines, each one alternating lark-robin-lark-robin, like so:

        ...
        L R
        R L
        L R
        R L
        ...

  Figures tend to reference four directions:
  - "up the set" (or "up the hall"): in that figure, north
  - "down the set": south
  - "across the set": towards the other line of dancers; so, in that figure, east for the dancers on the west, west for the dancers on the east
  - "out": away from the other line of dancers.

  Each dancer is one meter away from each of their three cardinal neighbors.

- The dance is conceptually subdivided into squares ("hands-fours") like so:

        ...

        down   L R
        up     R L

        down   L R
        up     R L

        ...

  Each dancer is either a "one" or a "two," but for clarity I'll call those "down" and "up": downs (ones) slowly progress down the hall over the course of the dance, ups progress up. I'll call this the dancer's "direction."

  In most dances, direction doesn't matter so much: up-larks and down-larks take the same actions at the same time, as do up-robins and down-robins. But some dances will have a call like "ones swing in the middle of the set."

- Most dances are "single progression": each 64 beats,

        ...
        down  L1 R1
        up    R2 L2
        down  L3 R3
        up    R4 L4
        ...

  ...becomes...

        ...
        up    R2 L2
        down  L1 R1
        up    R4 L4
        down  L3 R3
        ...

  ...i.e. all the downs have moved 1 meter down the hall, and all the ups have moved 1 meter up.

  But some dances are "double progression," and each couple would move _two_ meters in their direction.

  Most things in contra dance are fuzzy and flexible. One of the few HARD RULES is that, after 64 beats, each dancer should have progressed exactly 1 meter in their direction of progression (or 2, for double-progression).

- In each hands-four, each dancer has:
  - a "partner" of the other role, with whom they will progress down the line, over the course of the dance;
  - a "neighbor" of the other role, with whom they will typically dance a bit over one progression-cycle, then move on from; and
  - an "opposite" of the same role, who is always their neighbor's partner.

  A dancer's partner obviously always has the same direction; their neighbor and opposite always have the other direction.

  Some dances will have a dancer also interact with their "next neighbor" (which I might denote "neighbor +1") or "previous previous opposite" ("opposite -2") or something like that.

  Note that, if I'm going up, my [neighbor +n] will always be 2n meters north of my neighbor (because each hands-four is 2 meters tall).

  Some dances will have a dancer interact with one or more "shadows" -- a shadow is somebody with your direction but the other role. They are necessarily in another hands-four (since the person in _your_ hands-four with the same direction but other role is your partner). For example, in...

        ...

        1  L1 R1
        2  R2 L2

        1  L3 R3
        2  R4 L4

        ...

  ... R3 could be L1's shadow. We could denote R3 as L1's "shadow +1," since R3 is **1** hands-four **ahead** of L1. (A "shadow +0" would just be the partner.)

  Interesting note: we have "neighbor +n" and "opposite +n" and "shadow +n"; but a dancer will never interact with their "self +n", because their "self +n" is always executing exactly the same motions, so always stays 2n meters up/down the set, and they therefore never directly interact.

  Another interesting note: these relationships are _mostly but not completely_ symmetric and transitive.
  - you = your partner's partner = [neighbor +n]'s [neighbor +n] = [opposite +n]'s [opposite +n]
  - ...but you = your [shadow +n]'s [shadow -n] instead.
  - your partner's neighbor = your neighbor's partner
  - ...but your [neighbor +1]'s neighbor = your neighbor's [neighbor -1].

# The programmatic

- Recall this diagram:

        ...
        L R
        R L
        L R
        R L
        ...

  Let's make a coordinate system: the west line has x=-1/2; the east line has x=1/2; dancers are separated by dy=1. Each hands-four is 1m on a side (but they're separated by 1m also, so the repeating pattern is 2 meters high).

- A contra dance has **four prototypical dancers**: (up/down)x(lark/robin). The entire state of the world is completely described by the states of these four prototypical dancers; the rest of the set is just those four dancers copy-pasted 2n meters north and south of their positions.

- Information that is salient to every dancer at every time: consider, wlog., Alice: Alice knows:
  - her x-coordinate (but not her y-coordinate, since the set has so much translational symmetry it's hard to tell)
  - her velocity (x and y)
  - the angle she's facing, relative to "up the hall"
  - the distance, and [direction relative to her facing], and [direction relative to up the hall], to every dancer less than two meters away
  - whose hands she's holding, if any

  For example, if Alice is an up-robin, and the hands-four is in Beckett formation, and the caller has just told everybody to take hands in long lines, then she knows:
  - I'm at x=-0.5 (on the west side of the set)
  - I'm at rest
  - I'm facing across the set
  - my partner is 1m away, to my left (up the set), holding my left hand in their right
  - my neighbor is 1m away, in front of me (across the set)
  - my opposite is 1.4m away, 45deg to my left (across the set and up the hall)
  - my shadow is 1m away, to my right (down the set), holding my right hand in their left
  - my neighbor -1 is 1.4m away, 45deg to my right (across the set and down the hall)

  In a more complicated formation, partway through the dance, when people have shuffled somewhat and the dancers are in short wavy lines, Alice might know:
  - I'm at x=-0.25
  - I'm at rest
  - I'm facing down the set
  - my neighbor +1 is 0.5m to my left, holding my left hand in their right
  - my opposite +1 is 0.5m to my right, holding my right hand in their left
  - my shadow +1 is 1m to my right

- Example sanity checks you might do:
  - dancers shouldn't get closer than 0.3m to each other
  - dancers shouldn't move faster than 1m/beat, and seldom more than 0.5
  - dancers shouldn't turn faster than 180deg/beat
  - if a figure calls for Alice and Bob to "pass right shoulders" then, cos(angle from Alice's facing direction towards Bob) should start positive and go negative, while the sin should stay non-negative the whole time

  In general, your sanity checks should be _warnings only_: contra dance has very few hard rules, and the many rules-of-thumb get broken as reality tramples theory. (The one exception I can think of is that, after 64 beats, each dancer should be displaced from their starting position by exactly 1 or 2 meters, directly up or down the hall.)

# Dance description

Here's a way I might describe a dance:

```
[formation: improper]
[beat 0]
neighbors take right hands and balance
[beat 4]
neighbors box the gnat
[beat 8]
neighbors do si do 1 1/4 times to form short wavy lines with gentlespoons in the middle
[beat 16]
waves balance right and left
neighbors allemande right 1/2
ladles allemande left 1/2 in the middle
[beat 24]
partners swing
[beat 32]
gentlespoons draw your neighbor across to your side
[beat 40]
neighbors swing
[beat 48]
square through four: partners balance right hands, pull by right, neighbors pull by left, partners balance & pull by right, neighbors pull by left
you're looking at your new neighbor
[beat 64]
```

# Formation and figure reference

Terms for "formations" (ways people stand):

- improper: hands-four are in perfect squares, everybody facing their direction of progression. Larks are to their partners' left, robins are to their partners' right.

- Beckett: what you get if you take improper and rotate each hands-four 90deg (usually clockwise, but sometimes counterclockwise). Hands-fours are in perfect squares, everybody facing across the hall. Larks are to their partners' left, robins are to their partners' right.

- long lines: everybody facing across the set, in two opposing straight lines, holding hands with the people on each side.

- long wavy lines, larks (or robins) facing out: like long lines, but larks (or robins) face _out_, not across the set.

- short wavy lines, larks (or robins) in the middle: groups of four have the same y-coordinate, R-L-L-R (or R-L-L-R), holding hands.

Terms and instructions and beat counts for "figures" (ways people move). (Everything is a bit flexible.)

- Allemande right (or left): two dancers take right (or left) hands and walk around each other. "Allemande right 1/2" would mean they walk 180 degrees clockwise around the circle, trading places; "Allemande left 1 1/2" would mean they walk (360+180) degrees counterclockwise around the circle, essentially trading places.

- Balance: 4 beats. Step towards the person you're balancing with, then away.

  Balancing comes in many flavors; you might balance your neighbor/opposite/partner; you might "balance the ring" after taking hands in a ring, in which case you step towards the middle and then back out; you might "balance right" when you're holding somebody in your right hand.

- Box the gnat: 4 beats. Lark and robin hold right hands and trade places, lark turning clockwise, robin turning counterclockwise.

- Do si do: 8 beats. Two dancers walk clockwise around each other, without changing the direction they're facing, so they pass right shoulders, then, walking backwards, pass left shoulders.

  "Do si do 1 1/2" would mean doing 1 1/2 circles, so, doing a complete circle and then trading places.

- Pass the ocean: 4 beats. Done in groups of 4 (yourself, your partner or shadow, your neighbor +n, that neighbor's partner or shadow). Dancers face across the set; larks should be facing robins and vice versa. Pass by right shoulders, but [one role, larks or robins, usually robins] stops a little short; turn 90 degrees towards the majority of the people in your group of four, to form short wavy lines.

- Petronella: 4 beats. Almost invariably after "take hands in a ring, balance the ring." Drop hands, note where the person on your right is standing, step into that place, rotating 270 degrees clockwise so that you're still facing the center of the ring.

- Pull by right (or left): 2 beats. Two dancers take right (or left) hands and quickly walk past each other, swapping places (at least approximately).

- Robins chain: 8 beats. Robins pull by right and turn right, while larks step into where the robin on their side of the set used to be and turn a bit counterclockwise, to take left hands with the robins as they come out of the middle; couples turn as a unit, revolving counterclockwise around their center of mass, until they face across the set again.

- Square through: 8 beats. lark and robin take right hands, balance, pull by right, turn [left or right, not always clear from the call], pull by left.

  (This is also called a "square through two"; a "square through four" is just this twice.)

- Swing: typically 8 or 16 beats, but could be nearly anything. Lark and robin step close together, take up closed position, and spin around their center of mass a few times (typically around 1 rotation per 4 beats).

  Almost always ends with the two dancers separating to face the same direction, lark on the left, robin on the right, holding hands. Might end facing up or down the hall.
