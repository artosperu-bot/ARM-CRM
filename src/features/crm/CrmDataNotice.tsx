import { Database } from "lucide-react";
export function CrmDataNotice({ workspace }: { workspace?: string }) {
 return <div className="data-notice live"><Database size={16}/><span><strong>Datos reales · Supabase</strong> · Espacio: {workspace || "STECH PERU"}</span></div>;
}
