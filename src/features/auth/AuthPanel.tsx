import { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";

/** Acceso interno exclusivo: Google + perfil autorizado en crm_usuarios. */
export default function AuthPanel() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    let mounted = true;
    void fetch(url + "/auth/v1/settings", { headers: { apikey: key } })
      .then((response) => {
        if (!response.ok) throw new Error("Proveedor no verificable");
        return response.json();
      })
      .then((settings: { external?: { google?: boolean } }) => {
        if (mounted) setGoogleEnabled(settings.external?.google === true);
      })
      .catch(() => { if (mounted) setGoogleEnabled(null); });
    return () => { mounted = false; };
  }, []);

  async function login() {
    if (!supabase) return;
    setWorking(true); setError("");
    try {
      const { error: loginError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (loginError) throw loginError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo acceder con Google.");
    } finally {
      setWorking(false);
    }
  }

  return <div className="auth-screen">
    <div className="auth-hero">
      <div className="auth-brand"><span className="brand-icon">S</span><div><strong>STECH</strong><small>ARM / CRM</small></div></div>
      <div><span className="eyebrow"><Sparkles size={16}/> CENTRO COMERCIAL INTELIGENTE</span>
        <h1>Gestiona clientes.<br/><em>Convierte oportunidades.</em></h1>
        <p>Seguimiento comercial, catálogo y agentes de IA en un único sistema. Acceso exclusivo para el equipo autorizado de STECH.</p>
      </div>
      <div className="auth-features"><div><ShieldCheck size={20}/> Cuentas autorizadas</div><div><LockKeyhole size={20}/> Datos protegidos en Supabase</div></div>
    </div>
    <section className="auth-form-panel"><div className="auth-form-card">
      <div className="auth-icon"><ShieldCheck size={23}/></div>
      <h2>Ingresa a STECH CRM</h2>
      <p>Utiliza exclusivamente tu cuenta de Google autorizada por STECH. No existe registro público.</p>
      {!supabase && <div className="auth-error" role="alert">La conexión Supabase no está configurada. Contacta al administrador.</div>}
      {googleEnabled === false && <div className="auth-error" role="alert">El acceso con Google todavía debe habilitarse en Supabase Authentication del nuevo proyecto STECH. La lista de correos autorizados ya está configurada.</div>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button type="button" onClick={() => void login()} disabled={!supabase || working || googleEnabled === false} className="google-login-button full-width">
        <span className="google-mark" aria-hidden="true">G</span>{working ? "Abriendo Google…" : "Continuar con Google"}
      </button>
      <small className="auth-hint">Solo correos previamente habilitados en el CRM. No se envían mensajes a redes sociales desde esta pantalla.</small>
    </div></section>
  </div>;
}
