import type { TokenTraceView } from "../../engine/tracing/traceTypes";

interface TokenInspectorProps {
  selectedToken: TokenTraceView | null;
  tokens: readonly TokenTraceView[];
  onSelectToken: (token: TokenTraceView) => void;
}

const MAX_TOKENS = 200;

export function TokenInspector({ selectedToken, tokens, onSelectToken }: TokenInspectorProps) {
  const visibleTokens = tokens.slice(0, MAX_TOKENS);

  return (
    <div className="token-inspector">
      <div className="trace-content-heading">
        <h3>Lexer Tokens</h3>
        <span>{tokens.length} tokens</span>
      </div>
      <div className="token-grid">
        {visibleTokens.map((token, index) => (
          <button
            className={selectedToken === token ? `token-chip is-${token.category} is-selected` : `token-chip is-${token.category}`}
            key={`${token.type}-${token.start}-${index}`}
            type="button"
            onClick={() => onSelectToken(token)}
          >
            <strong>{token.lexeme.length === 0 ? "EOF" : token.lexeme}</strong>
            <span>{token.type}</span>
            <small>{token.start}-{token.end}</small>
          </button>
        ))}
      </div>
      {tokens.length > MAX_TOKENS ? <p className="trace-note">Showing first {MAX_TOKENS} tokens.</p> : null}
    </div>
  );
}
