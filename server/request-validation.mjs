/** Validate API request identifiers without accepting malformed UUIDs. */
export function validUuid(value){
  return typeof value==="string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validAgentRequest({workspaceId,conversationId=null,message}={}){
  return validUuid(workspaceId) &&
    (conversationId===null || validUuid(conversationId)) &&
    typeof message==="string" &&
    message.trim().length>=2 &&
    message.trim().length<=800;
}
