import { useCallback,useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import type { UsageEvent } from "./usage";
type Status="loading"|"ready"|"error";
export function useAiUsage(workspaceId:string | undefined){
 const [events,setEvents]=useState<UsageEvent[]>([]);
 const [status,setStatus]=useState<Status>("loading");
 const [error,setError]=useState("");
 const [truncated,setTruncated]=useState(false);
 const load=useCallback(async()=>{
  if(!supabase || !workspaceId)return;
  setStatus("loading");setError("");
  try{
   // Los eventos están aislados por RLS. Paginamos para no perder conversaciones.
   const rows:UsageEvent[]=[];const pageSize=500;const maxPages=30;let more=false;
   for(let page=0;page<maxPages;page++){
    const {data,error:readError}=await supabase.from("arm_ai_usage")
     .select("id,session_id,message_id,model,node,input_tokens,output_tokens,cached_input_tokens,cost_usd,cost_source,occurred_at,source")
     .eq("workspace_id",workspaceId).eq("source","arm_agent").order("id",{ascending:false})
     .range(page*pageSize,(page+1)*pageSize-1);
    if(readError)throw readError;
    rows.push(...((data??[]) as UsageEvent[]));
    if(!data || data.length<pageSize){more=false;break;}
    more=page===maxPages-1;
   }
   setTruncated(more);setEvents(rows);setStatus("ready");
  }catch(e){setStatus("error");setError(e instanceof Error?e.message:"No fue posible consultar tokens");}
 },[workspaceId]);
 useEffect(()=>{void load();},[load]);
 return {events,status,error,truncated,refresh:load};
}
