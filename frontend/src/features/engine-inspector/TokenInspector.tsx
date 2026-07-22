import { useMemo, useState, type KeyboardEvent } from "react";
import type { KansoErrorView } from "../execution/executionTypes";
import type { TokenTraceView } from "../../engine/tracing/traceTypes";
import { filterTokens, getTokenDescription, getTokenDisplayCategory, getTokenKindLabel } from "./tokenInspectorModel";

interface TokenInspectorProps {
  selectedToken: TokenTraceView | null;
  tokens: readonly TokenTraceView[];
  error: KansoErrorView | null;
  onSelectToken: (token: TokenTraceView) => void;
}

export function TokenInspector({ selectedToken, tokens, error, onSelectToken }: TokenInspectorProps) {
  const [search, setSearch] = useState("");
  const filteredTokens = useMemo(() => filterTokens(tokens, search), [tokens, search]);
  const lexerError = error?.code === "LEXER_ERROR" ? error : null;

  if (tokens.length === 0 && lexerError === null) {
    return (
      <section className="token-inspector is-empty" aria-label="Lexer tokens">
        <h3>No tokens available.</h3>
        <p>Run a SQL statement to inspect the lexer output.</p>
      </section>
    );
  }

  return (
    <section className="token-inspector" aria-label="Lexer tokens">
      <div className="token-inspector-header">
        <div>
          <h3>Token Stream</h3>
          <span>{tokens.length} lexer tokens</span>
        </div>
        <label className="token-search">
          <span className="sr-only">Search tokens</span>
          <input
            type="search"
            placeholder="Search tokens..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {lexerError === null ? null : <LexerErrorSummary error={lexerError} />}

      <div className="token-inspector-layout">
        <div className="token-stream-panel" aria-label="Token stream">
          {filteredTokens.length === 0 ? (
            <p className="trace-note">No tokens match the current search.</p>
          ) : (
            <div className="token-stream" role="list">
              {filteredTokens.map((token, index) => {
                const selected = selectedToken === token;
                const displayCategory = getTokenDisplayCategory(token);
                return (
                  <button
                    aria-label={`${formatLexeme(token)} token, ${getTokenKindLabel(token)}`}
                    aria-pressed={selected}
                    className={selected ? `token-card is-${displayCategory} is-selected` : `token-card is-${displayCategory}`}
                    key={`${token.type}-${token.start}-${token.end}-${index}`}
                    role="listitem"
                    type="button"
                    onClick={() => onSelectToken(token)}
                    onKeyDown={(event) => handleTokenKeyDown(event, filteredTokens, index, onSelectToken)}
                  >
                    <strong title={formatLexeme(token)}>{formatLexeme(token)}</strong>
                    <span>{getTokenKindLabel(token)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <TokenDetailsPanel token={selectedToken} />
      </div>
    </section>
  );
}

function TokenDetailsPanel({ token }: { token: TokenTraceView | null }) {
  if (token === null) {
    return (
      <aside className="token-details-panel" aria-label="Token details">
        <h3>Token Details</h3>
        <p className="trace-note">Select a token to inspect its lexer output.</p>
      </aside>
    );
  }

  const length = Math.max(0, token.end - token.start);

  return (
    <aside className="token-details-panel" aria-label="Token details">
      <p className="token-detail-eyebrow">Token</p>
      <h3>{formatLexeme(token)}</h3>
      <dl className="token-detail-list">
        <div>
          <dt>Type</dt>
          <dd>{getTokenKindLabel(token)}</dd>
        </div>
        <div>
          <dt>Raw type</dt>
          <dd>{token.type}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{length}</dd>
        </div>
        <div>
          <dt>Start offset</dt>
          <dd>{token.start}</dd>
        </div>
        <div>
          <dt>End offset</dt>
          <dd>{token.end}</dd>
        </div>
        {"literal" in token ? (
          <div>
            <dt>Literal</dt>
            <dd>{formatLiteral(token.literal)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="token-description">
        <strong>Description</strong>
        <p>{getTokenDescription(token)}</p>
      </div>
    </aside>
  );
}

function LexerErrorSummary({ error }: { error: KansoErrorView }) {
  const position = typeof error.metadata?.position === "number" ? error.metadata.position : null;

  return (
    <div className="token-lexer-error" role="alert">
      <strong>Lexer failed</strong>
      <span>{error.message}</span>
      {position === null ? null : <small>Position {position}</small>}
    </div>
  );
}

function handleTokenKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  tokens: readonly TokenTraceView[],
  index: number,
  onSelectToken: (token: TokenTraceView) => void
) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowUp") {
    return;
  }

  event.preventDefault();
  const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const nextToken = tokens[index + direction];
  if (nextToken !== undefined) {
    onSelectToken(nextToken);
  }
}

function formatLexeme(token: TokenTraceView): string {
  return token.lexeme.length === 0 ? "EOF" : token.lexeme;
}

function formatLiteral(value: TokenTraceView["literal"]): string {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  return String(value);
}
