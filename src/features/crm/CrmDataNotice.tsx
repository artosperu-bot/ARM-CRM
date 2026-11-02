
import { Database, ShieldCheck } from "lucide-react";

export function CrmDataNotice({ live, workspace }: { live: boolean; workspace?: string }) {
  return <div className={"data-notice " + (live ? "live" : "demo")}>
    {live ? <Database size={16}/> : <ShieldCheck size={16}/>}
    <span><strong>{live ? "Datos reales · Supabase" : "Modo de demostración"}</strong>
    {live ? " · Espacio: " + (workspace || "Cargando") : " · Los cambios son temporales y no se envían a clientes"}</span>
  </div>;
}
