"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type WithdrawalRow = {
  id: string;
  request_number: string;
  order_number: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  acknowledgement_email: string;
  scope: "full" | "partial";
  selected_items: Array<{ id: string; productName: string; quantity: number }>;
  customer_note: string;
  status: "received" | "reviewed" | "processed" | "rejected";
  submitted_at: string;
  acknowledgement_sent_at: string | null;
};

export function WithdrawalAdmin({ supabase }: { supabase: SupabaseClient }) {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("consumer_withdrawals")
      .select("id,request_number,order_number,customer_first_name,customer_last_name,customer_email,acknowledgement_email,scope,selected_items,customer_note,status,submitted_at,acknowledgement_sent_at")
      .order("submitted_at", { ascending: false })
      .limit(20);

    if (error) {
      setMessage(error.message);
      return;
    }
    setRows((data ?? []) as WithdrawalRow[]);
  }

  useEffect(() => {
    void load();
  }, [supabase]);

  async function setStatus(id: string, status: WithdrawalRow["status"]) {
    setMessage("Enregistrement…");
    const { error } = await supabase
      .from("consumer_withdrawals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Rétractation mise à jour ✓");
    await load();
  }

  const pending = rows.filter((row) => row.status === "received").length;

  return (
    <section className="withdrawal-admin-v484" data-withdrawal-admin-v484 aria-labelledby="withdrawal-admin-title-v484">
      <header>
        <div>
          <p className="eyebrow">RÉTRACTATIONS</p>
          <h3 id="withdrawal-admin-title-v484">Déclarations reçues</h3>
          <p>La réception ne déclenche automatiquement ni annulation, remboursement ni mouvement de stock.</p>
        </div>
        <strong className={pending ? "has-pending" : ""}>{pending} à traiter</strong>
      </header>

      {message && <p className="save-message">{message}</p>}

      {!rows.length ? (
        <p className="withdrawal-admin-empty-v484">Aucune déclaration de rétractation reçue.</p>
      ) : (
        <div className="withdrawal-admin-list-v484">
          {rows.map((row) => (
            <article key={row.id}>
              <div className="withdrawal-admin-row-head-v484">
                <div>
                  <strong>{row.request_number}</strong>
                  <span>Commande {row.order_number} · {new Date(row.submitted_at).toLocaleString("fr-FR")}</span>
                </div>
                <span className={`status-${row.status}`}>
                  {row.status === "received" ? "À traiter" : row.status === "reviewed" ? "Vérifiée" : row.status === "processed" ? "Traitée" : "Refusée"}
                </span>
              </div>

              <div className="withdrawal-admin-meta-v484">
                <span>{[row.customer_first_name, row.customer_last_name].filter(Boolean).join(" ")}</span>
                <a href={`mailto:${row.customer_email}`}>{row.customer_email}</a>
                <span>Accusé : {row.acknowledgement_sent_at ? "envoyé ✓" : "à vérifier"}</span>
              </div>

              <ul>
                {(row.selected_items ?? []).map((item) => (
                  <li key={item.id}>{item.quantity} × {item.productName}</li>
                ))}
              </ul>

              {row.customer_note && <p className="withdrawal-admin-note-v484">{row.customer_note}</p>}

              <div className="withdrawal-admin-actions-v484">
                {row.status === "received" && <button type="button" onClick={() => setStatus(row.id, "reviewed")}>Marquer vérifiée</button>}
                {row.status !== "processed" && <button type="button" onClick={() => setStatus(row.id, "processed")}>Marquer traitée</button>}
                {row.status !== "rejected" && <button type="button" className="ghost" onClick={() => setStatus(row.id, "rejected")}>Marquer refusée</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
