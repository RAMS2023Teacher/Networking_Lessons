// Short helpers so lesson files read like lesson plans.

/** A multiple-choice question. `answer` is the position of the right choice, counting from 0. */
export const q = (text, choices, answer, why) => ({ q: text, choices, answer, why });

/** A device on a network-building board. x runs 0 to 100, y runs 0 to 60. */
export const d = (id, kind, label, x, y) => ({ id, kind, label, x, y });

/** A router on a routing board. */
export const n = (id, label, x, y) => ({ id, label, x, y });
