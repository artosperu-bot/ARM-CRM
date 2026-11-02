/** Recover the original customer goal and latest turn exchanges without another AI call. */
export function buildConversationContext(initial=[],recent=[]){
 const unique=new Map();
 for(const turn of [...initial,...recent]){
  if(!turn||!["user","assistant"].includes(turn.role)||typeof turn.content!=="string")continue;
  const key=turn.id||turn.created_at+":"+turn.role+":"+turn.content;
  unique.set(key,{role:turn.role,content:turn.content,created_at:turn.created_at||"",key});
 }
 return [...unique.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||String(a.key).localeCompare(String(b.key)))
  .map(({role,content})=>({role,content}));
}
