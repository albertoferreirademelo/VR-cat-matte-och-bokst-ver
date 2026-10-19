// After every few levels comes a master round that mixes all the facts learned so far,
// so earlier ones keep coming back. The learner asks the weakest facts most often, so it
// is also where forgotten facts are found again.
const MASTER = { color: 'gold', badge: '🏆', name: 'Mästarrunda', master: true };

// `levels` with a master round after every `every` of them, and one at the end if `last`.
export function withMasterRounds(levels, { every = 3, last = true } = {}) {
  const result = [];
  levels.forEach((level, i) => {
    result.push(level);
    const end = i === levels.length - 1;
    if (end ? !last : (i + 1) % every !== 0) return;
    const items = new Map(levels.slice(0, i + 1).flatMap((before) => before.items).map((item) => [item.key, item]));
    result.push({ ...MASTER, id: `master-${level.id}`, items: [...items.values()] });
  });
  return result;
}
