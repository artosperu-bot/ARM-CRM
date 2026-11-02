// Validación determinista de propuesta de seguimiento de IA.
// No se agenda por una mera sugerencia ni por consentimiento inferido del modelo.
export function normalizedPhone(text){
 const digits=String(text||"").replace(/\D/g,"");
 const local=digits.startsWith("51")&&digits.length===11?digits.slice(2):digits;
 return /^9\d{8}$/.test(local)?local:null;
}
export function consentInLastMessage(text){
 const v=String(text||"").toLowerCase();
 const confirmed=/(?:^|[\s,.;¡!¿?])(s[ií]|autorizo|acepto|confirmo|de acuerdo)(?=$|[\s,.;¡!¿?])/iu.test(v);
 const action=/(ag[eé]nd|program|contact|escr[ií]b|ll[aá]ma|recu[eé]rd|seguim|confirm[aá]melo)/u.test(v);
 return confirmed&&action;
}
export function validateBookingProposal(proposal,customerTurns,lastText,now=new Date()){
 if(!proposal||proposal.requested!==true||!proposal.explicit_consent||!consentInLastMessage(lastText))return null;
 const all=customerTurns.join(" ").replace(/\s+/g," ").toLowerCase();
 const name=String(proposal.full_name||"").trim().replace(/\s+/g," ");
 const phone=normalizedPhone(proposal.phone);
 if(!phone||name.length<5||name.length>120||name.split(" ").length<2)return null;
 if(!all.includes(name.toLowerCase()))return null;
 if(!all.replace(/\D/g,"").includes(phone))return null;
 const date=String(proposal.date_local||""), time=String(proposal.time_local||"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const dueAt=new Date(date+"T"+time+":00-05:00");
 if(!Number.isFinite(dueAt.getTime())||dueAt.getTime()<now.getTime()+600000||dueAt.getTime()>now.getTime()+90*86400000)return null;
 if(dueAt.toLocaleDateString("en-CA",{timeZone:"America/Lima",year:"numeric",month:"2-digit",day:"2-digit"}).split("/").join("-")!==date){
   // Intl varies by locale; fallback to UTC-5 arithmetic below
   const iso=new Date(dueAt.getTime()-5*3600000).toISOString().slice(0,10);
   if(iso!==date)return null;
 }
 const hasDateEvidence=/(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|ma[ñn]ana|pasado ma[ñn]ana)/iu.test(all);
 const hasTimeEvidence=/(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?|horas)|a las \d{1,2}|\d{1,2}:\d{2})/iu.test(all);
 if(!hasDateEvidence||!hasTimeEvidence)return null;
 return {name,phone,dueAt:dueAt.toISOString(),description:"Seguimiento comercial solicitado a través del agente STECH"};
}
export const crmResponseSchema={
 type:"json_schema",name:"stech_agent_turn",strict:true,
 schema:{type:"object",additionalProperties:false,required:["reply","followup"],
  properties:{
   reply:{type:"string"},
   followup:{type:"object",additionalProperties:false,
    required:["requested","full_name","phone","date_local","time_local","explicit_consent"],
    properties:{
     requested:{type:"boolean"},full_name:{type:["string","null"]},
     phone:{type:["string","null"]},date_local:{type:["string","null"]},
     time_local:{type:["string","null"]},explicit_consent:{type:"boolean"}
    }
   }
  }
 }
};
