# Right left through

Parameters:
- default 8 beats

Displays like: "[right left through]"

Final keyframe:
- every lark starts with a robin [down the set if his x<0, up the set if his x>0]; call her his "foil"
- he ends up at `{x: hisCurrentX<0 ? 1 : -1, y: herCurrentY}`, facing across the set
- she ends up at `{x: hisCurrentX<0 ? 1 : -1, y: hisCurrentY}`, facing across the set
- they end up holding left hands with each other, and no other hands


Keyframe generation:
- First 4 beats:
    - every dancer immediately faces across the set
    - every dancer walks in a clockwise ellipse to `{x: theirCurrentX<0 ? 1 : -1, y: theirCurrentY}` (note that this is not the same as their final position)
- Next 4 beats:
    - assert every lark has a robin on his right
    - those two take left hands, and right hands
    - those two revolve 180 ccw around their common center of mass
    - those two drop right hands

Example dance: start in improper, 0 progression; right left through twice in a row.
