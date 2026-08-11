import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

function settingString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return value == null ? "" : String(value);
}

function isEnabled(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return value !== "false" && value !== "0";
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] || char
  );
}

function parseRecipients(value: string) {
  return value
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceSupabase();

    if (!supabase) {
      return NextResponse.json(
        { error: "Service indisponible." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Honeypot anti-spam
    if (clean(body.website, 200)) {
      return NextResponse.json({ ok: true });
    }

    const firstName = clean(body.firstName, 100);
    const lastName = clean(body.lastName, 100);
    const email = clean(body.email, 180).toLowerCase();
    const phone = clean(body.phone, 60);
    const message = clean(body.message, 4000);
    const locale = clean(body.locale, 2) === "en" ? "en" : "fr";

    const keys = [
      "contact_first_name_required",
      "contact_last_name_required",
      "contact_email_required",
      "contact_phone_required",
      "contact_message_required",
      "support_email",
    ];

    const { data: settingRows } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", keys);

    const settings = Object.fromEntries(
      (settingRows ?? []).map((row) => [
        row.key,
        settingString(row.value),
      ])
    );

    // Validation
    if (
      isEnabled(settings.contact_first_name_required, true) &&
      !firstName
    ) {
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? "Prénom requis."
              : "First name is required.",
        },
        { status: 400 }
      );
    }

    if (
      isEnabled(settings.contact_last_name_required, false) &&
      !lastName
    ) {
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? "Nom requis."
              : "Last name is required.",
        },
        { status: 400 }
      );
    }

    if (
      isEnabled(settings.contact_email_required, true) &&
      !email
    ) {
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? "E-mail requis."
              : "Email is required.",
        },
        { status: 400 }
      );
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? "E-mail invalide."
              : "Invalid email.",
        },
        { status: 400 }
      );
    }

    if (
      isEnabled(settings.contact_phone_required, false) &&
      !phone
    ) {
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? "Téléphone requis."
              : "Phone is required.",
        },
        { status: 400 }
      );
    }

    if (
      isEnabled(settings.contact_message_required, true) &&
      !message
    ) {
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? "Message requis."
              : "Message is required.",
        },
        { status: 400 }
      );
    }

    if (message && message.length < 3) {
      return NextResponse.json(
        {
          error:
            locale === "fr"
              ? "Message trop court."
              : "Message is too short.",
        },
        { status: 400 }
      );
    }

    // Sauvegarde également dans l'admin
    const { data: inserted, error } = await supabase
      .from("contact_messages")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        message,
        locale,
        status: "new",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw error ?? new Error("CONTACT_INSERT_FAILED");
    }

    // Envoi e-mail vers la boutique
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.EMAIL_FROM?.trim() ||
      "Ichigo Ichie <noreply@ichigoichiematcha.fr>";

    const recipientValue =
      process.env.CONTACT_NOTIFICATION_EMAIL?.trim() ||
      settings.support_email?.trim() ||
      "";

    const recipients = parseRecipients(recipientValue);

    if (!apiKey) {
      console.error(
        "Contact notification skipped: RESEND_API_KEY missing"
      );
    } else if (!recipients.length) {
      console.error(
        "Contact notification skipped: recipient missing"
      );
    } else {
      const fullName =
        [firstName, lastName].filter(Boolean).join(" ") ||
        "Visiteur du site";

      const html = `
        <div style="
          font-family:Arial,Helvetica,sans-serif;
          line-height:1.6;
          color:#26362d;
          max-width:640px;
          margin:auto;
        ">
          <div style="
            border:1px solid #e4e1d8;
            border-radius:18px;
            padding:28px;
            background:#fffdf9;
          ">
            <div style="
              font-size:12px;
              letter-spacing:3px;
              font-weight:700;
              color:#42664f;
              margin-bottom:12px;
            ">
              ICHIGO ICHIE
            </div>

            <h2 style="
              margin:0 0 24px;
              font-size:26px;
              color:#263f31;
            ">
              Nouveau message
            </h2>

            <p>
              <strong>Nom :</strong><br>
              ${escapeHtml(fullName)}
            </p>

            <p>
              <strong>E-mail :</strong><br>
              ${escapeHtml(email || "—")}
            </p>

            <p>
              <strong>Téléphone :</strong><br>
              ${escapeHtml(phone || "—")}
            </p>

            <div style="
              margin-top:24px;
              padding-top:20px;
              border-top:1px solid #e4e1d8;
            ">
              <strong>Message :</strong>

              <div style="
                margin-top:10px;
                white-space:pre-wrap;
              ">${escapeHtml(message)}</div>
            </div>

            ${
              email
                ? `
                  <div style="margin-top:28px;">
                    <a
                      href="mailto:${escapeHtml(email)}"
                      style="
                        display:inline-block;
                        background:#294b3a;
                        color:#ffffff;
                        text-decoration:none;
                        padding:12px 20px;
                        border-radius:999px;
                        font-weight:700;
                      "
                    >
                      Répondre au client
                    </a>
                  </div>
                `
                : ""
            }
          </div>
        </div>
      `;

      try {
        const response = await fetch(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: recipients,
              reply_to: email || undefined,
              subject: `Nouveau message · ${fullName}`,
              html,
            }),
          }
        );

        if (!response.ok) {
          const responseText = await response.text();

          console.error(
            "Contact notification email error",
            response.status,
            responseText
          );
        }
      } catch (notificationError) {
        console.error(
          "Contact notification email error",
          notificationError
        );
      }
    }

    return NextResponse.json({
      ok: true,
      id: inserted.id,
    });
  } catch (error) {
    console.error("Contact form error", error);

    return NextResponse.json(
      {
        error:
          "Impossible d’envoyer le message pour le moment.",
      },
      { status: 500 }
    );
  }
}