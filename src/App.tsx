import { useEffect, useState } from "react";
import { Activity,ChartNoAxesCombined,Bot,CalendarClock,ChevronRight,ContactRound,Inbox,Kanban,LayoutDashboard,LogOut,Package,PlugZap,ShieldCheck,Sparkles } from "lucide-react";
import AuthPanel from "./features/auth/AuthPanel";
import WorkspaceSetup from "./features/crm/WorkspaceSetup";
import { CrmDataNotice } from "./features/crm/CrmDataNotice";
import { useCrmWorkspace } from "./features/crm/useCrmWorkspace";
import FollowupsPage from "./features/crm/FollowupsPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import ContactsPage from "./features/contacts/ContactsPage";
import PipelinePage from "./features/pipeline/PipelinePage";
import CatalogPage from "./features/catalog/CatalogPage";
import InboxPage from "./features/inbox/InboxPage";
import AgentPage from "./features/agent/AgentPage";
import IntegrationsPage from "./features/integrations/IntegrationsPage";
import UsagePage from "./features/usage/UsagePage";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Section } from "./types";

const sections=[
{id:"resumen",label:"Resumen",icon:LayoutDashboard},
{id:"oportunidades",label:"Pipeline comercial",icon:Kanban},
{id:"clientes",label:"Clientes",icon:ContactRound},
{id:"seguimientos",label:"Seguimientos",icon:CalendarClock},
{id:"mensajes",label:"Bandeja de entrada",icon:Inbox},
{id:"catalogo",label:"Catálogo",icon:Package},
{id:"agente",label:"Agente comercial",icon:Bot},
{id:"consumo",label:"Consumo IA",icon:ChartNoAxesCombined},
{id:"integraciones",label:"Integraciones",icon:PlugZap},
] as const;

export default function App(){
 const [section,setSection]=useState<Section>("resumen");
 const crm=useCrmWorkspace(isSupabaseConfigured);
 const [connectionNotice,setConnectionNotice]=useState("");
 // Una verificación de solo lectura al iniciar sesión de ADMIN.
 // El backend valida JWT y guarda exclusivamente los estados de las cuentas.
 useEffect(()=>{
  if(crm.status!=="ready"||crm.role!=="ADMIN"||!crm.workspace?.id||!supabase)return;
  const workspaceId=crm.workspace.id;
  const key="arm_composio_verify_"+workspaceId+"_20261102";
  if(sessionStorage.getItem(key))return;
  sessionStorage.setItem(key,"checking");
  void supabase.functions.invoke("arm-composio-status",{body:{workspaceId}})
    .then(({data,error})=>{
      if(error||!data?.ok){
        sessionStorage.setItem(key,"error");
        setConnectionNotice("No se pudo comprobar Composio automáticamente. Abre Integraciones para repetir la verificación.");
        return;
      }
      sessionStorage.setItem(key,"verified");
      const summary=data.summary as Record<string,{active:number}> | undefined;
      const count=summary?Object.values(summary).reduce((sum,item)=>sum+(item.active||0),0):0;
      setConnectionNotice("Composio verificado: "+count+" conexiones OAuth activas detectadas. Los envíos automáticos siguen deshabilitados; respuestas manuales de WhatsApp disponibles solo para números de prueba autorizados.");
    })
    .catch(()=>{
      sessionStorage.setItem(key,"error");
      setConnectionNotice("No se pudo consultar Composio. Revisa la clave y permisos desde Integraciones.");
    });
 },[crm.status,crm.role,crm.workspace?.id]);
 if(!isSupabaseConfigured) return <AuthPanel/>;
 if(crm.status==="checking") return <div className="loading-screen"><span className="loading-spin"/><strong>Validando acceso STECH…</strong></div>;
 if(crm.status==="signed-out") return <AuthPanel/>;
 if(crm.status==="blocked") return <div className="loading-screen error-screen"><ShieldCheck size={34}/><h2>Cuenta sin autorización</h2><p>Este correo Google no está habilitado en la lista de acceso STECH CRM.</p><button className="secondary-button" onClick={()=>void crm.signOut()}>Cambiar de cuenta</button></div>;
 if(crm.status==="error") return <div className="loading-screen error-screen"><ShieldCheck size={30}/><h2>Error al consultar Supabase</h2><p>{crm.error}</p><button className="primary-button" onClick={()=>void crm.refresh()}>Reintentar</button><button className="secondary-button" onClick={()=>void crm.signOut()}>Cerrar sesión</button></div>;
 if(crm.status==="no-workspace") return <WorkspaceSetup onCreate={crm.createWorkspace} onExit={crm.signOut} canCreate={crm.role==="ADMIN"}/>;
 const page={
  resumen:<DashboardPage contacts={crm.contacts} deals={crm.deals} followups={crm.followups} products={crm.products} onNavigate={setSection}/>,
  oportunidades:<PipelinePage contacts={crm.contacts} deals={crm.deals} onCreate={crm.createDeal} onMove={crm.updateDealStage}/>,
  clientes:<ContactsPage contacts={crm.contacts} onCreate={crm.createContact}/>,
  seguimientos:<FollowupsPage contacts={crm.contacts} tasks={crm.followups} onCreate={crm.createFollowup} onComplete={crm.completeFollowup} onCancel={crm.cancelFollowup}/>,
  mensajes:<InboxPage workspaceId={crm.workspace!.id}/>,
  catalogo:<CatalogPage products={crm.products} workspaceId={crm.workspace!.id} isAdmin={crm.role==="ADMIN"}/>,
  agente:<AgentPage workspaceId={crm.workspace!.id} contacts={crm.contacts} onNavigate={setSection} onCreateFollowup={crm.createFollowup} onCreateDeal={crm.createDeal}/>,
  consumo:<UsagePage workspaceId={crm.workspace!.id}/>,
  integraciones:<IntegrationsPage workspaceId={crm.workspace!.id} isAdmin={crm.role==="ADMIN"}/>,
 }[section];
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-icon">S</span><div><strong>STECH</strong><small>ARM / CRM</small></div></div><div className="nav-label">GESTIÓN COMERCIAL</div><nav className="nav-list">{sections.map(item=>{const Icon=item.icon;return <button key={item.id} className={"nav-link "+(section===item.id?"active":"")} onClick={()=>setSection(item.id)}><Icon size={17}/><span>{item.label}</span>{section===item.id&&<ChevronRight size={15}/>}</button>})}</nav><div className="sidebar-footer"><span className="circle-icon"><ShieldCheck size={16}/></span><div><strong>Sesión autorizada</strong><small>Supabase y permisos RLS</small></div></div></aside><main className="main"><header className="topbar"><div className="breadcrumbs">STECH <ChevronRight size={14}/> {sections.find(x=>x.id===section)?.label}</div><div className="topbar-right"><span className="demo-chip live-chip"><span className="dot"/> CRM ACTIVO</span><span className="tiny-pill">{crm.role}</span><button className="icon-action" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={()=>void crm.signOut()}><LogOut size={17}/></button></div></header><div className="content"><div className="heading"><div><div className="eyebrow"><Sparkles size={15}/> CENTRO COMERCIAL STECH</div><h1>{sections.find(x=>x.id===section)?.label}</h1><p>{crm.workspace?.name} · Información del CRM almacenada en Supabase.</p></div></div><CrmDataNotice workspace={crm.workspace?.name}/>{connectionNotice&&<div className="notice" role="status">{connectionNotice}</div>}{page}<footer className="footer"><span>STECH PERU · ARM-CRM</span><span><Activity size={14}/> Datos persistentes · Acceso restringido</span></footer></div></main></div>;
}
