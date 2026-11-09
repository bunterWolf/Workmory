// Random index of the next tracking phrase; never the one currently shown.
export default function nextPhraseIndex(current, count, random = Math.random) {
  if (count <= 1) return 0;
  const candidate = Math.floor(random() * (count - 1));
  return candidate >= current ? candidate + 1 : candidate;
}
