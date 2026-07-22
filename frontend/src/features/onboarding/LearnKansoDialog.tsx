interface LearnKansoDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LearnKansoDialog({ open, onClose }: LearnKansoDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card learn-dialog" role="dialog" aria-modal="true" aria-labelledby="learn-kanso-title">
        <h2 id="learn-kanso-title">How KansoDB Works</h2>
        <ol>
          <li>SQL text is tokenized by the lexer.</li>
          <li>The parser builds a typed AST.</li>
          <li>The executor evaluates the statement against in-memory tables.</li>
          <li>Storage validates schema, types, and constraints.</li>
          <li>The workbench renders results, errors, history, and engine traces.</li>
        </ol>
        <div className="dialog-actions">
          <button className="primary-button" type="button" onClick={onClose}>Got it</button>
        </div>
      </section>
    </div>
  );
}
