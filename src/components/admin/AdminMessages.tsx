"use client";

export type AdminContactMessage = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  status: "new" | "read" | "archived";
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message: string;
  locale?: "fr" | "en";
};

type ContactFilter = "new" | "all" | "archived";

export function AdminMessages({
  messages,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onRefresh,
  onStatusChange,
}: {
  messages: AdminContactMessage[];
  filter: ContactFilter;
  search: string;
  onFilterChange: (filter: ContactFilter) => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void | Promise<void>;
  onStatusChange: (id: string, status: AdminContactMessage["status"]) => void | Promise<void>;
}) {
  const needle = search.trim().toLowerCase();
  const filteredMessages = messages.filter((item) => {
    const matchesStatus =
      filter === "all" ? item.status !== "archived" : item.status === filter;
    const haystack =
      `${item.first_name} ${item.last_name} ${item.email} ${item.phone} ${item.message}`.toLowerCase();
    return matchesStatus && (!needle || haystack.includes(needle));
  });
  const newCount = messages.filter((item) => item.status === "new").length;

  return (
    <div className="contact-admin-v228">
      <div className="section-inline contact-admin-heading-v228">
        <div>
          <p className="eyebrow">CONTACT</p>
          <h2>Messages reçus</h2>
          <p className="muted">
            Les demandes envoyées depuis le formulaire du site apparaissent ici.
          </p>
        </div>
        <button type="button" className="button ghost small" onClick={onRefresh}>
          Actualiser
        </button>
      </div>

      <div className="contact-admin-toolbar-v228">
        <div className="order-filter-buttons">
          {([
            ["new", "Nouveaux"],
            ["all", "À traiter"],
            ["archived", "Archivés"],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => onFilterChange(value)}
            >
              {label}
              {value === "new" && newCount ? ` · ${newCount}` : ""}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Nom, email, téléphone, message…"
        />
      </div>

      {filteredMessages.length ? (
        <div className="contact-message-list-v228">
          {filteredMessages.map((item) => (
            <article
              key={item.id}
              className={`contact-message-card-v228 status-${item.status}`}
            >
              <div className="contact-message-meta-v228">
                <div>
                  <span className={`contact-status-dot-v228 ${item.status}`}></span>
                  <strong>
                    {[item.first_name, item.last_name].filter(Boolean).join(" ") ||
                      "Sans nom"}
                  </strong>
                  <small>
                    {new Date(item.created_at).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </div>
                <span className="contact-status-label-v228">
                  {item.status === "new"
                    ? "Nouveau"
                    : item.status === "read"
                      ? "Lu"
                      : "Archivé"}
                </span>
              </div>

              <div className="contact-message-links-v228">
                {item.email && (
                  <a
                    href={`mailto:${item.email}?subject=${encodeURIComponent(
                      "Re: votre message — Ichigo Ichie",
                    )}`}
                  >
                    {item.email}
                  </a>
                )}
                {item.phone && (
                  <a href={`tel:${item.phone.replace(/\s+/g, "")}`}>
                    {item.phone}
                  </a>
                )}
              </div>

              <p className="contact-message-body-v228">{item.message}</p>

              <div className="contact-message-actions-v228">
                {item.email && (
                  <a
                    className="button primary small"
                    href={`mailto:${item.email}?subject=${encodeURIComponent(
                      "Re: votre message — Ichigo Ichie",
                    )}`}
                  >
                    Répondre par e-mail
                  </a>
                )}
                {item.status === "new" && (
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => onStatusChange(item.id, "read")}
                  >
                    Marquer lu
                  </button>
                )}
                {item.status !== "archived" ? (
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => onStatusChange(item.id, "archived")}
                  >
                    Archiver
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => onStatusChange(item.id, "read")}
                  >
                    Réouvrir
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">Aucun message dans cette vue.</div>
      )}
    </div>
  );
}
