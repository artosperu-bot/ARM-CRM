
import { useState } from "react";
import { Building2, CircleCheckBig } from "lucide-react";

export default function WorkspaceSetup({ onCreate, onExit, canCreate }: {
  onCreate: (name: string) => Promise<void>;
  canCreate: boolean;
  onExit: () => Promise<unknown> | undefined;
}) {
  const [name, setName] = useState("STECH PERU");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError("");
    try { await onCreate(name); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear el espacio."); }
    finally { setWorking(false); }
  }
  return <div className="workspace-setup"><div className="workspace-card"><span className="setup-icon"><Building2 size={28}/></span><h1>{canCreate ? "Configura tu espacio comercial" : "Acceso habilitado"}</h1><p>{canCreate ? "Crea el espacio STECH para guardar clientes y oportunidades reales." : "Tu correo está autorizado. Un administrador deberá asignarte a un espacio comercial para comenzar."}</p>{canCreate && <form onSubmit={submit}><label>Nombre de empresa<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)}/></label>{error && <p className="auth-error" role="alert">{error}</p>}<button disabled={working} type="submit" className="primary-button full-width"><CircleCheckBig size={17}/>{working ? "Creando…" : "Crear espacio seguro"}</button></form>}<button className="auth-switch" onClick={() => void onExit()}>Cerrar sesión</button></div></div>;
}
