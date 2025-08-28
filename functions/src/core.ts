import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

interface LogData {
  userId: string;
  userName: string;
  action: string;
  entity: "USER" | "AUDIT" | "APONTAMENTO" | "SYSTEM";
  entityId: string;
  details?: object;
}

export async function logAction(data: LogData) {
  return db.collection("logs").add({
    ...data,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export const logActionCallable = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { action, entity, entityId, details } = data;
    const userName = context.auth.token.name || context.auth.token.email || "Usuário Desconhecido";

    await logAction({
        userId: context.auth.uid,
        userName: userName,
        action,
        entity,
        entityId,
        details,
    });

    return { success: true };
});