/** ERP physical stock is NOT available-to-promise. Never pass quantity to ALEX. */
export function buildErpObservations(mappings,erpRows,{now=Date.now(),maxAgeMinutes=180}={}){
 const rows=Array.isArray(erpRows)?erpRows:[];
 const result=[],errors=[];
 for(const map of Array.isArray(mappings)?mappings:[]){
   if(!map?.workspace_id||!map?.arm_partnumber||!map?.erp_partnumber)continue;
   const matches=rows.filter(x=>x?.partnumber===map.erp_partnumber);
   if(matches.length!==1){errors.push({partnumber:map.arm_partnumber,reason:matches.length?"duplicate_pn":"missing_pn"});continue;}
   const data=matches[0];
   const ts=Date.parse(String(data.source_updated_at||""));
   const qty=data.physical_units;
   const validQuantity=Number.isInteger(qty);
   const invalidTime=!Number.isFinite(ts)||ts>now+120000;
   const ageMin=(now-ts)/60000;
   const freshness=map.mapping_status!=="verified_exact"?"pending_mapping":
      !validQuantity||qty<0||invalidTime?"anomaly":
      ageMin>maxAgeMinutes?"stale":"fresh";
   // Store ERP physical stock in an isolated RLS table, never in product.price_pen
   // or product.stock_erp until commitments/reservations have been accounted for.
   result.push({
     workspace_id:map.workspace_id,arm_partnumber:map.arm_partnumber,
     erp_partnumber:map.erp_partnumber,source_server:"PC005",
     source_table:"DB_ST.dbo.ST_STOCK_HST_CONSULTA",
     physical_units:validQuantity?qty:null,
     source_updated_at:Number.isFinite(ts)?new Date(ts).toISOString():new Date(0).toISOString(),
     observed_at:new Date(now).toISOString(),freshness,
     physical_stock_not_available_stock:true
   });
 }
 return {observations:result,errors};
}
