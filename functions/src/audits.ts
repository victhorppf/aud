import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {logAction} from "./core";

const db = admin.firestore();

export const changeAuditStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }

    const { auditId, newStatus, details } = data;
    const auditRef = db.collection("audits").doc(auditId);
    const auditDoc = await auditRef.get();

    if (!auditDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Auditoria não encontrada.");
    }

    const oldStatus = auditDoc.data()?.status;
    const userName = context.auth.token.name || "Usuário";

    // Aqui viria a lógica complexa da máquina de estados (RBAC)
    // Ex: if (userData.role !== 'Gestor' && newStatus === 'COMPLETED') throw ...

    await auditRef.update({
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logAction({
        userId: context.auth.uid,
        userName: userName,
        action: "AUDIT_STATUS_CHANGED",
        entity: "AUDIT",
        entityId: auditId,
        details: { from: oldStatus, to: newStatus, ...details },
    });

    return { success: true };
});