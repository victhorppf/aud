import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {logAction} from "./core";

const db = admin.firestore();

// Função para validar o segredo de cadastro
export const validateSecret = functions.https.onCall(async (data) => {
  const secret = data.secret;
  if (!secret || typeof secret !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Segredo inválido.");
  }

  const secretRef = db.collection("secrets").doc(secret);
  const secretDoc = await secretRef.get();

  if (!secretDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Segredo não encontrado ou inválido.");
  }

  return secretDoc.data();
});

// Gatilho para quando um novo usuário é criado
export const onUserCreate = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snap, context) => {
    const newUser = snap.data();
    const userId = context.params.userId;

    await logAction({
      userId: userId,
      userName: newUser.fullName,
      action: "USER_CREATED_PENDING_APPROVAL",
      entity: "USER",
      entityId: userId,
    });

    // Aqui você adicionaria a lógica para notificar o gestor por e-mail
    console.log(`Notificar gestor do setor ${newUser.sector} sobre ${newUser.fullName}`);
  });