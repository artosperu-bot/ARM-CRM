// Legacy historical import disabled by STECH's request.
// Keep this endpoint non-operative to prevent old conversations reappearing.
Deno.serve((_req:Request)=>new Response(JSON.stringify({
  error:"La importación histórica de conversaciones fue deshabilitada.",
  code:"LEGACY_IMPORT_DISABLED"
}),{status:410,headers:{"Content-Type":"application/json; charset=utf-8"}}));
