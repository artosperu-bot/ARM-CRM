export type Channel = "whatsapp" | "instagram" | "facebook" | "web";
export type DealStage = "nuevo" | "interesado" | "cotizado" | "negociacion" | "ganado";
export type Section = "resumen" | "oportunidades" | "clientes" | "seguimientos" | "mensajes" | "catalogo" | "agente" | "integraciones";
export type Contact = { id: string; name: string; phone: string; email?: string; source: Channel; interest: string; createdAt: string };
export type Deal = { id: string; contactId: string; title: string; stage: DealStage; amount: number | null; channel: Channel; lastActivity: string };
export type Followup = { id: string; contactId: string; dealId: string | null; dueAt: string; status: "pending" | "completed" | "cancelled"; description: string };
export type InboxThread = { id: string; contactId: string; channel: Channel; text: string; at: string; needsHuman: boolean };
export type Product = { partnumber: string; title: string; brand: string; category: string; status: "pendiente_erp"; price: number | null; stock: number | null };
export const STAGES: { id: DealStage; title: string; accent: string }[] = [
  { id: "nuevo", title: "Nuevo", accent: "#7ddcff" },
  { id: "interesado", title: "Interesado", accent: "#bca7fb" },
  { id: "cotizado", title: "Cotizado", accent: "#f4c577" },
  { id: "negociacion", title: "Negociación", accent: "#f4a57e" },
  { id: "ganado", title: "Ganado", accent: "#79e6b2" },
];
