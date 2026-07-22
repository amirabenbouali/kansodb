import type { StorageReadView } from "../../engine/tracing/traceTypes";

interface StorageInspectorProps {
  storageReads: readonly StorageReadView[] | undefined;
}

export function StorageInspector({ storageReads }: StorageInspectorProps) {
  if (storageReads === undefined || storageReads.length === 0) {
    return <p className="trace-note">No storage activity was recorded for this execution.</p>;
  }

  return (
    <div className="storage-inspector">
      <div className="trace-content-heading">
        <h3>Storage Activity</h3>
        <span>{storageReads.length} events</span>
      </div>
      <div className="storage-events">
        {storageReads.map((event) => (
          <article className="storage-event" key={event.id}>
            <strong>{event.activity.replaceAll("_", " ")}</strong>
            {event.detail === undefined ? null : <span>{event.detail}</span>}
            <dl>
              {event.tableName === undefined ? null : <Metric label="Table" value={event.tableName} />}
              {event.rowsInspected === undefined ? null : <Metric label="Inspected" value={event.rowsInspected} />}
              {event.rowsMatched === undefined ? null : <Metric label="Matched" value={event.rowsMatched} />}
              {event.rowsChanged === undefined ? null : <Metric label="Changed" value={event.rowsChanged} />}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
