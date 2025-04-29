export async function getLatestBlockTimeMS() {
  const blocks = await fetch("/koios/tip?select=block_time");
  const [{ block_time }] = await blocks.json();

  return block_time * 1_000;
}
