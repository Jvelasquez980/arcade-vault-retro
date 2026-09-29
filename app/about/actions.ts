"use server";

import { Resend } from "resend";
import {
  validateContact,
  type ContactState,
  type ContactValues,
} from "@/lib/contact";

const DEFAULT_FROM = "Arcade Vault <onboarding@resend.dev>";

const field = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
};

export async function sendContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const values: ContactValues = {
    name: field(formData, "name"),
    email: field(formData, "email"),
    message: field(formData, "message"),
  };

  // Honeypot: un bot rellenó el campo oculto; fingir éxito sin enviar.
  if (field(formData, "website") !== "") {
    return { status: "success", name: values.name };
  }

  if (!validateContact(values)) {
    return { status: "invalid", values };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const genericError = {
    status: "error",
    values,
    message: "No pudimos enviar tu mensaje. Inténtalo de nuevo más tarde.",
  } as const;

  if (!apiKey || !to) {
    console.error("sendContact: faltan RESEND_API_KEY o CONTACT_TO_EMAIL");
    return genericError;
  }

  const from = process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM;
  const subjectName = values.name.replace(/[\r\n]+/g, " ");

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      replyTo: values.email,
      subject: `[Arcade Vault] Mensaje de ${subjectName}`,
      text: `Nombre: ${values.name}\nEmail: ${values.email}\n\n${values.message}`,
    });
    if (error) {
      console.error("sendContact: Resend devolvió error", error);
      return genericError;
    }
  } catch (err) {
    console.error("sendContact: fallo al llamar a Resend", err);
    return genericError;
  }

  return { status: "success", name: values.name };
}
