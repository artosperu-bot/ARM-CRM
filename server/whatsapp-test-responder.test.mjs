import {describe,it,expect} from "vitest";
import {createWhatsAppTestResponder} from "./whatsapp-test-responder.mjs";

function fixture(status="pending",onRequest=()=>{},allowedOffers=[],stateAfterModel={}){
  const writes=[];
  let threadReads=0;
  const db={
    async rpc(name,params){
      if(name!=="arm_search_catalog")return {data:[],error:{code:"unexpected"}};
      if(!params.p_query||params.p_query.trim().length<2)return {data:[],error:null};
      return {data:[{id:"qa-product",workspace_id:"ws",title:"Ulefone Armor X13",brand:"ULEFONE",
        partnumber:"ARMOR-X13",attributes:{},price_pen:null,stock_erp:null,verified_at:null,
        category_path:["electronica","celulares"],family_key:null,variant_options:{},search_rank:99}],error:null};
    },
    from(table){
    const q={
      select(fields,opt){q.count=opt?.count;return q;},
      eq(){return q;},in(){return q;},order(){return q;},
      gte:async()=>({count:0,error:null}),
      maybeSingle:async()=>{
        if(table==="arm_lead_insights")return {data:{
          opt_out:Boolean(stateAfterModel.optOut),
          requires_human:Boolean(stateAfterModel.requiresHuman)
        },error:null};
        if(table==="arm_threads"){
          threadReads++;
          return {data:{id:"thread",workspace_id:"ws",contact_id:"contact",
            status:threadReads>1?(stateAfterModel.status||status):status,assigned_to:null},error:null};
        }
        return {data:null,error:null};
      },
      limit:async()=>{
        if(table==="arm_messages")return {data:[],error:null};
        if(table==="arm_product_facts")return {data:[],error:null};
        if(table==="arm_products")return {data:[{title:"Ulefone Armor X13",brand:"ULEFONE",partnumber:"ARMOR-X13",attributes:{},verified_at:null,price_pen:null,stock_erp:null}],error:null};
        if(table==="arm_offer_simulations")return {data:allowedOffers,error:null};
        return {data:[],error:null};
      },
      insert:async value=>{writes.push({table,value});return {error:null};}
    };
    return q;
  }};
  const requests=[];
  const fetcher=async(url,opts)=>{
    requests.push({url,opts});
    onRequest(url,opts);
    if(url.includes("api.openai.com"))return new Response(JSON.stringify({
      id:"resp_test",model:"gpt-5.4-mini",
      output:[{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify({reply:"Para obra te recomiendo el Armor X13 por su resistencia certificada. ¿Qué uso le darás?",followup:{requested:false,full_name:null,phone:null,date_local:null,time_local:null,explicit_consent:false}})}]}],
      usage:{input_tokens:200,output_tokens:60,input_tokens_details:{cached_tokens:0}}
    }),{status:200,headers:{"content-type":"application/json"}});
    return new Response(JSON.stringify({messages:[{id:"wamid.outbound.qa"}]}),{status:200,headers:{"content-type":"application/json"}});
  };
  const respond=createWhatsAppTestResponder({
    db,openaiKey:"fake",whatsappToken:"fake-token",phoneId:"phone-qa",
    allowedNumbers:["51900000001"],fetcher
  });
  const event={messageId:"wamid.inbound.qa",sender:"51900000001",phoneNumberId:"phone-qa",
    text:"Busco un celular resistente para construcción",timestamp:Math.floor(Date.now()/1000)};
  return {respond,db,requests,writes,event};
}
describe("isolated WhatsApp test reply",()=>{
  it("does not call OpenAI, Supabase or Meta for unapproved sender",async()=>{
    const f=fixture();
    expect((await f.respond({...f.event,sender:"51999999999"})).status).toBe("blocked");
    expect(f.requests).toHaveLength(0);
    expect(f.writes).toHaveLength(0);
  });
  it("does not answer stale messages",async()=>{
    const f=fixture();
    expect((await f.respond({...f.event,timestamp:f.event.timestamp-86400})).status).toBe("stale");
    expect(f.requests).toHaveLength(0);
  });
  it("does not answer when an advisor took over",async()=>{
    const f=fixture("human");
    expect((await f.respond(f.event)).status).toBe("human_handoff");
    expect(f.requests).toHaveLength(0);
  });
  it("aborts an in-flight reply when a human takes the thread during model generation",async()=>{
    const f=fixture("pending",()=>{},[],{status:"human"});
    expect((await f.respond(f.event)).status).toBe("human_handoff");
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0].url).toContain("api.openai.com");
    expect(f.writes.map(w=>w.table)).not.toContain("arm_messages");
  });
  it("aborts an in-flight reply when an opt-out arrives before send",async()=>{
    const f=fixture("pending",()=>{},[],{optOut:true});
    expect((await f.respond(f.event)).status).toBe("human_handoff");
    expect(f.requests).toHaveLength(1);
    expect(f.writes.map(w=>w.table)).not.toContain("arm_messages");
  });
  it("calls OpenAI only and sends a single WhatsApp text to the allowlisted sender",async()=>{
    const f=fixture();
    const result=await f.respond(f.event);
    expect(result.status).toBe("sent");
    expect(f.requests).toHaveLength(2);
    const graph=JSON.parse(f.requests[1].opts.body);
    expect(graph.to).toBe("51900000001");
    expect(graph.type).toBe("text");
    expect(graph.text.body).not.toMatch(/S\/\s*999/);
    const ai=JSON.parse(f.requests[0].opts.body);
    expect(ai.model).toBe("gpt-5.4-mini");
    expect(ai.store).toBe(false);
    expect(ai.tools).toBeUndefined();
    expect(f.writes.map(w=>w.table)).toEqual(["arm_ai_usage","arm_messages"]);
  });
  it("in private simulation mode clearly labels simulated pricing",async()=>{
    const f=fixture("pending",()=>{},[{partnumber:"ARMOR-X13",price_pen:999,stock_status:"disponible",is_test_data:true}]);
    f.event.text="¿Cuánto cuesta el Armor X13?";
    const writes=[];
    const responder=createWhatsAppTestResponder({
      db:f.db,openaiKey:"fake",whatsappToken:"fake-token",phoneId:"phone-qa",
      allowedNumbers:["51900000001"],testOffers:true,fetcher:async(url,opts)=>{
        if(url.includes("api.openai.com"))return new Response(JSON.stringify({
          id:"simulated",model:"gpt-5.4-mini",usage:{input_tokens:50,output_tokens:20},
          output:[{type:"message",role:"assistant",content:[{type:"output_text",text:JSON.stringify({reply:"Precio simulado: S/ 999",followup:{requested:false,full_name:null,phone:null,date_local:null,time_local:null,explicit_consent:false}})}]}]
        }),{status:200});
        writes.push(JSON.parse(opts.body));
        return new Response(JSON.stringify({messages:[{id:"wamid.out.qa2"}]}),{status:200});
      }
    });
    expect((await responder(f.event)).status).toBe("sent");
    expect(writes[0].text.body).toMatch(/^🧪 \*PRUEBA STECH\*/);
    expect(writes[0].text.body).toContain("Precio simulado: S/ 999");
  });
});
