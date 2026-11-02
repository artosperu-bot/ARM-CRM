
import { useState } from "react";
import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function AuthPanel({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const credentials = { email: email.trim(), password };
      const result = register
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      if (register && !result.data.session) setMessage("Revisa tu correo para confirmar el registro. Después inicia sesión.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo autenticar.");
    } finally { setWorking(false); }
  }

  return <div className="auth-screen"><div className="auth-hero"><div className="auth-brand"><span className="brand-icon">S</span><div><strong>STECH</strong><small>ARM / CRM</small></div></div><div><span className="eyebrow"><Sparkles size={16}/> CENTRO COMERCIAL INTELIGENTE</span><h1>Gestiona clientes.<br/><em>Convierte oportunidades.</em></h1><p>Un solo lugar para tu pipeline, catálogo y próximo agente de ventas. Los datos reales se protegen con Supabase Auth y políticas RLS.</p></div><div className="auth-features"><div><ShieldCheck size={20}/> Acceso con credenciales privadas</div><div><LockKeyhole size={20}/> Datos separados por espacio comercial</div></div></div><section className="auth-form-panel"><div className="auth-form-card"><div className="auth-icon"><KeyRound size={23}/></div><h2>{register ? "Crear cuenta de trabajo" : "Iniciar sesión"}</h2><p>Accede a tus clientes y oportunidades almacenados en Supabase.</p><form onSubmit={submit}><label>Correo de trabajo<input aria-label="Correo de trabajo" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" autoComplete="email"/></label><label>Contraseña<input aria-label="Contraseña" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete={register ? "new-password" : "current-password"}/></label>{error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-success" role="status"><Mail size={16}/>{message}</div>}<button type="submit" disabled={working} className="primary-button full-width">{working ? "Validando…" : register ? "Crear cuenta" : "Ingresar"}<ArrowRight size={17}/></button></form><button className="auth-switch" onClick={() => { setRegister(!register); setError(""); setMessage(""); }}>{register ? "¿Ya tienes cuenta? Iniciar sesión" : "¿Aún no tienes cuenta? Registrarte"}</button><div className="auth-divider">O</div><button className="secondary-button full-width" onClick={onDemo}>Explorar demostración sin conectarse</button><small className="auth-hint">No se envían mensajes a WhatsApp, Instagram ni Facebook.</small></div></section></div>;
}
