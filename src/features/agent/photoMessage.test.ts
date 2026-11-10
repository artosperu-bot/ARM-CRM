import {describe,it,expect} from "vitest";
import {parseAgentPhotoMessage} from "./photoMessage";
const photo="https://store.ulefone.com/cdn/shop/files/Rugged_Phone_Armor_22_Night_Vision_Camera.jpg?v=1762843122&width=1024";
describe("persistent product photo in private CRM conversation",()=>{
 it("renders an authorized image without displaying internal marker text",()=>{
  const parsed=parseAgentPhotoMessage("Foto referencial del modelo: Armor 22\n[FOTO_VERIFICADA]("+photo+")");
  expect(parsed.body).toBe("Foto referencial del modelo: Armor 22");
  expect(parsed.photoUrl).toBe(photo);
 });
 it("never creates an image from ordinary links or customer input",()=>{
  expect(parseAgentPhotoMessage("Te puedo enviar esta foto https://store.ulefone.com/foto.jpg").photoUrl).toBeNull();
 });
 it("renders a future manufacturer image from authenticated server marker",()=>{
  const future="https://store.dji.com/media/mavic-3e.jpg";
  const parsed=parseAgentPhotoMessage("Foto oficial del Mavic 3E\n[FOTO_VERIFICADA]("+future+")");
  expect(parsed.photoUrl).toBe(future);
 });
 it.each([
  "http://store.ulefone.com/a.jpg",
  "https://evil.test/a.jpg",
  "https://store.ulefone.com.evil.test/a.jpg",
  "https://store.ulefone.com/a.svg",
  "https://user:pass@store.ulefone.com/a.jpg",
  "https://store.ulefone.com/a.webp",
  "https://127.0.0.1/a.jpg",
  "https://a.example.com/a.jpg",
  "https://a.nip.io/a.jpg"
 ])("doesn't render an untrusted media URL: %s",url=>{
  expect(parseAgentPhotoMessage("Foto\n[FOTO_VERIFICADA]("+url+")").photoUrl).toBeNull();
 });
});
