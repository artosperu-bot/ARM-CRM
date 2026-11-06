/** Cost estimates are not charges. gpt-5.4-mini reference USD per 1M tokens (Nov 2026). */
export function estimateUsd(input,output,cached){
  const safeInput=Math.max(0,Number(input)||0);
  const safeCached=Math.min(safeInput,Math.max(0,Number(cached)||0));
  const safeOutput=Math.max(0,Number(output)||0);
  return Math.round(((safeInput-safeCached)*0.75+safeCached*0.075+safeOutput*4.50)/1e6*1e8)/1e8;
}
