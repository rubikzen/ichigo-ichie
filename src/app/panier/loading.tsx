export default function CartLoading() {
  return (
    <section
      className="cart-page cart-page-v216 cart-loading-v378"
      aria-busy="true"
      aria-label="Chargement du panier"
    >
      <div className="cart-page-head-v216">
        <div className="page-heading cart-heading-v216">
          <p className="eyebrow">ICHIGO ICHIE</p>
          <h1>Votre panier</h1>
          <p className="cart-loading-line-v378">Chargement…</p>
        </div>
      </div>

      <div className="cart-loading-layout-v378">
        <div className="cart-loading-items-v378">
          {[0, 1].map((item) => (
            <div className="cart-loading-card-v378" key={item}>
              <span className="cart-loading-image-v378" />
              <div>
                <span className="cart-loading-bar-v378 wide" />
                <span className="cart-loading-bar-v378 medium" />
                <span className="cart-loading-bar-v378 short" />
              </div>
            </div>
          ))}
        </div>

        <div className="cart-loading-summary-v378">
          <span className="cart-loading-bar-v378 medium" />
          <span className="cart-loading-bar-v378 wide" />
          <span className="cart-loading-bar-v378 wide" />
        </div>
      </div>

      <style>{`
        .cart-loading-v378 {
          min-height: 55vh;
        }

        .cart-loading-line-v378 {
          opacity: .62;
        }

        .cart-loading-layout-v378 {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
          gap: 28px;
          margin-top: 24px;
        }

        .cart-loading-items-v378 {
          display: grid;
          gap: 14px;
        }

        .cart-loading-card-v378 {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr);
          gap: 18px;
          padding: 16px;
          border: 1px solid rgba(38, 61, 49, .12);
          border-radius: 18px;
          background: rgba(255,255,255,.54);
        }

        .cart-loading-card-v378 > div {
          display: grid;
          align-content: center;
          gap: 11px;
        }

        .cart-loading-image-v378,
        .cart-loading-bar-v378 {
          display: block;
          background: linear-gradient(
            90deg,
            rgba(37, 67, 53, .07),
            rgba(37, 67, 53, .13),
            rgba(37, 67, 53, .07)
          );
          background-size: 220% 100%;
          animation: cart-loading-shimmer-v378 1.15s ease-in-out infinite;
        }

        .cart-loading-image-v378 {
          width: 110px;
          height: 110px;
          border-radius: 14px;
        }

        .cart-loading-bar-v378 {
          height: 12px;
          border-radius: 999px;
        }

        .cart-loading-bar-v378.wide { width: 88%; }
        .cart-loading-bar-v378.medium { width: 62%; }
        .cart-loading-bar-v378.short { width: 38%; }

        .cart-loading-summary-v378 {
          display: grid;
          align-content: start;
          gap: 18px;
          min-height: 190px;
          padding: 22px;
          border: 1px solid rgba(38, 61, 49, .12);
          border-radius: 20px;
        }

        @keyframes cart-loading-shimmer-v378 {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }

        @media (max-width: 760px) {
          .cart-loading-layout-v378 {
            grid-template-columns: 1fr;
          }

          .cart-loading-summary-v378 {
            min-height: 140px;
          }
        }

        @media (max-width: 520px) {
          .cart-loading-card-v378 {
            grid-template-columns: 78px minmax(0, 1fr);
          }

          .cart-loading-image-v378 {
            width: 78px;
            height: 78px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cart-loading-image-v378,
          .cart-loading-bar-v378 {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
