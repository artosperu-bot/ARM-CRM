import type { Contact, Deal, InboxThread, Product } from "./types";

export const sampleContacts: Contact[] = [
  { id: "c1", name: "María Torres", phone: "Número de prueba", source: "whatsapp", interest: "Celular resistente", createdAt: "Demostración" },
  { id: "c2", name: "Carlos Vega", phone: "Número de prueba", source: "instagram", interest: "Laptop para estudiar", createdAt: "Demostración" },
  { id: "c3", name: "Ana Rojas", phone: "Número de prueba", source: "facebook", interest: "Impresora Epson", createdAt: "Demostración" },
  { id: "c4", name: "José Pérez", phone: "Número de prueba", source: "web", interest: "Accesorios", createdAt: "Demostración" },
];
export const sampleDeals: Deal[] = [
  { id: "d1", contactId: "c1", title: "Ulefone Armor", stage: "interesado", amount: null, channel: "whatsapp", lastActivity: "Ejemplo" },
  { id: "d2", contactId: "c2", title: "Laptop Lenovo", stage: "cotizado", amount: null, channel: "instagram", lastActivity: "Ejemplo" },
  { id: "d3", contactId: "c3", title: "Impresora Epson", stage: "nuevo", amount: null, channel: "facebook", lastActivity: "Ejemplo" },
  { id: "d4", contactId: "c4", title: "Accesorios HOCO", stage: "negociacion", amount: null, channel: "web", lastActivity: "Ejemplo" },
];
export const sampleInbox: InboxThread[] = [
  { id: "t1", contactId: "c1", channel: "whatsapp", text: "¿Qué celular resistente recomiendan para trabajo de campo?", at: "Mensaje de ejemplo", needsHuman: false },
  { id: "t2", contactId: "c2", channel: "instagram", text: "Busco laptop para mis clases y proyectos.", at: "Mensaje de ejemplo", needsHuman: false },
  { id: "t3", contactId: "c3", channel: "facebook", text: "¿Tienen una Epson para mi negocio?", at: "Mensaje de ejemplo", needsHuman: true },
];
export const sampleProducts: Product[] = [
  { partnumber: "CAT-ULEFONE", title: "Celulares Ulefone", brand: "Ulefone", category: "Celulares", status: "pendiente_erp", price: null, stock: null },
  { partnumber: "CAT-LENOVO", title: "Laptops Lenovo", brand: "Lenovo", category: "Laptops", status: "pendiente_erp", price: null, stock: null },
  { partnumber: "CAT-EPSON", title: "Impresoras Epson", brand: "Epson", category: "Impresoras", status: "pendiente_erp", price: null, stock: null },
];
