import { useMemo, type CSSProperties } from "react";
import { DataLLM, useToolInfo, useViewState } from "skybridge/web";

type FlowerOffer = {
  id: string;
  merchant: string;
  product: string;
  price: number;
  delivery: number;
  match?: number;
  checkoutUrl: string;
  productUrl?: string;
  sourceUrl: string;
  fit?: {
    occasion?: string[];
    relationship?: string[];
    style?: string[];
    colors?: string[];
  };
};

type SearchFlowersInput = {
  flowerType?: string;
  location?: string;
  address?: string;
  budgetMin?: number;
  budgetMax?: number;
  deliveryDate?: string;
  occasion?: string;
  relationship?: string;
  lovedColors?: string;
  avoidedColors?: string;
  style?: string;
};

type SearchFlowersOutput = {
  criteria: Record<string, unknown>;
  offers: FlowerOffer[];
  recommendedOfferId: string | null;
  reason: string;
  sourceStatus: Array<{ id?: string; merchant?: string; ok?: boolean; message?: string }>;
  fetchedAt: string;
  cached: boolean;
};

type FloweraViewState = {
  selectedOfferId: string;
  occasion: string;
  style: string;
  avoidedColors: string;
  budgetMax: number | null;
  checkoutIntent: null | {
    offerId: string;
    merchant: string;
    product: string;
    checkoutUrl: string;
  };
};

const initialViewState: FloweraViewState = {
  selectedOfferId: "",
  occasion: "",
  style: "",
  avoidedColors: "",
  budgetMax: null,
  checkoutIntent: null
};

export default function SearchFlowersView() {
  const tool = useToolInfo<{
    input: SearchFlowersInput;
    output: SearchFlowersOutput;
  }>();
  const [viewState, setViewState] = useViewState<FloweraViewState>(initialViewState);

  const output = tool.isSuccess ? tool.output : null;
  const offers = output?.offers ?? [];
  const recommendedOffer = offers.find((offer) => offer.id === output?.recommendedOfferId) ?? offers[0] ?? null;
  const selectedOffer = offers.find((offer) => offer.id === viewState.selectedOfferId) ?? recommendedOffer;
  const effectiveState = useMemo(
    () => ({
      ...viewState,
      selectedOfferId: selectedOffer?.id ?? "",
      recommendedOfferId: recommendedOffer?.id ?? "",
      recommendedOffer: summarizeOffer(recommendedOffer),
      selectedOffer: summarizeOffer(selectedOffer),
      offersCount: offers.length,
      reason: output?.reason ?? ""
    }),
    [offers.length, output?.reason, recommendedOffer, selectedOffer, viewState]
  );

  if (tool.isPending || tool.isIdle) {
    return <div style={styles.shell}>Searching live merchant pages...</div>;
  }

  return (
    <main style={styles.shell}>
      <DataLLM content="Flowera widget state">
        <DataLLM content={`Occasion: ${viewState.occasion || tool.input.occasion || "not set"}`} />
        <DataLLM content={`Style: ${viewState.style || tool.input.style || "not set"}`} />
        <DataLLM content={`Avoid colors: ${viewState.avoidedColors || tool.input.avoidedColors || "none"}`} />
        <DataLLM content={`Recommended: ${recommendedOffer ? `${recommendedOffer.merchant} - ${recommendedOffer.product}` : "none"}`} />
      </DataLLM>

      <header style={styles.header}>
        <div>
          <strong style={styles.title}>Flowera</strong>
          <span style={styles.subtitle}>
            {String(output?.criteria.location ?? tool.input.location ?? "Berlin")} ·{" "}
            {String(output?.criteria.flowerType ?? tool.input.flowerType ?? "Flowers")} · {offers.length} offers
          </span>
        </div>
        <span style={styles.badge}>Skybridge DevTools</span>
      </header>

      <section style={styles.controls} aria-label="Shared widget state controls">
        <label style={styles.field}>
          Occasion
          <select
            value={viewState.occasion}
            onChange={(event) => setViewState((state) => ({ ...state, occasion: event.target.value }))}
          >
            <option value="">Any</option>
            <option value="birthday">Birthday</option>
            <option value="anniversary">Anniversary</option>
            <option value="thank-you">Thank you</option>
            <option value="sympathy">Sympathy</option>
          </select>
        </label>
        <label style={styles.field}>
          Style
          <select
            value={viewState.style}
            onChange={(event) => setViewState((state) => ({ ...state, style: event.target.value }))}
          >
            <option value="">Any</option>
            <option value="elegant">Elegant</option>
            <option value="soft">Soft</option>
            <option value="wild">Wild</option>
            <option value="minimal">Minimal</option>
          </select>
        </label>
        <label style={styles.field}>
          Avoid colors
          <input
            value={viewState.avoidedColors}
            placeholder="yellow"
            onChange={(event) => setViewState((state) => ({ ...state, avoidedColors: event.target.value }))}
          />
        </label>
        <label style={styles.field}>
          Max budget
          <input
            type="number"
            value={viewState.budgetMax ?? ""}
            placeholder={String(tool.input.budgetMax ?? 55)}
            onChange={(event) =>
              setViewState((state) => ({
                ...state,
                budgetMax: event.target.value ? Number(event.target.value) : null
              }))
            }
          />
        </label>
      </section>

      <p style={styles.reason}>{output?.reason}</p>

      <section style={styles.offers} aria-label="Flower offers">
        {offers.map((offer) => {
          const isSelected = effectiveState.selectedOfferId === offer.id;
          return (
            <article
              key={offer.id}
              style={{ ...styles.card, ...(isSelected ? styles.cardSelected : {}) }}
              onClick={() => setViewState((state) => ({ ...state, selectedOfferId: offer.id, checkoutIntent: null }))}
            >
              <div style={styles.cardTop}>
                <strong>{offer.merchant}</strong>
                <span>{offer.match ?? 0}%</span>
              </div>
              <p style={styles.product}>{offer.product}</p>
              <div style={styles.price}>EUR {(offer.price + offer.delivery).toFixed(2)}</div>
              <button
                type="button"
                style={styles.button}
                onClick={(event) => {
                  event.stopPropagation();
                  setViewState((state) => ({
                    ...state,
                    selectedOfferId: offer.id,
                    checkoutIntent: {
                      offerId: offer.id,
                      merchant: offer.merchant,
                      product: offer.product,
                      checkoutUrl: offer.checkoutUrl
                    }
                  }));
                }}
              >
                Checkout intent
              </button>
            </article>
          );
        })}
      </section>

      <section style={styles.statePanel} aria-label="Model-visible widget state">
        <strong>Model-visible state</strong>
        <pre>{JSON.stringify(effectiveState, null, 2)}</pre>
      </section>
    </main>
  );
}

function summarizeOffer(offer: FlowerOffer | null) {
  if (!offer) return null;
  return {
    id: offer.id,
    merchant: offer.merchant,
    product: offer.product,
    total: Number((offer.price + offer.delivery).toFixed(2)),
    match: offer.match ?? null,
    checkoutUrl: offer.checkoutUrl,
    productUrl: offer.productUrl ?? offer.sourceUrl,
    fit: offer.fit ?? null
  };
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gap: 14,
    minHeight: "100%",
    padding: 18,
    background: "#f7faf8",
    color: "#1d2d29",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  title: {
    display: "block",
    fontSize: 20
  },
  subtitle: {
    display: "block",
    color: "#6b7774",
    fontSize: 13
  },
  badge: {
    border: "1px solid #dfe6e3",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    background: "#ffffff"
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10
  },
  field: {
    display: "grid",
    gap: 6,
    color: "#6b7774",
    fontSize: 12,
    fontWeight: 800
  },
  reason: {
    margin: 0,
    lineHeight: 1.45
  },
  offers: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10
  },
  card: {
    display: "grid",
    gap: 8,
    border: "1px solid #dfe6e3",
    borderRadius: 8,
    padding: 12,
    background: "#ffffff",
    cursor: "pointer"
  },
  cardSelected: {
    borderColor: "#9d2f47",
    boxShadow: "0 0 0 2px rgba(157, 47, 71, 0.12)"
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10
  },
  product: {
    minHeight: 42,
    margin: 0,
    color: "#33423e",
    fontSize: 13,
    lineHeight: 1.35
  },
  price: {
    fontWeight: 900
  },
  button: {
    minHeight: 32,
    border: 0,
    borderRadius: 8,
    background: "#9d2f47",
    color: "#ffffff",
    fontWeight: 850
  },
  statePanel: {
    border: "1px solid #dfe6e3",
    borderRadius: 8,
    padding: 12,
    background: "#ffffff",
    overflow: "auto"
  }
};
