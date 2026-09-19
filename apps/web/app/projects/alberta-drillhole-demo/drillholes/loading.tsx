export default function DrillholesLoading() {
  return (
    <div className="workspace-content workspace-content-dense" aria-busy="true">
      <div className="loading-stack">
        <div className="loading-line loading-line-short" />
        <div className="loading-line loading-line-title" />
        <div className="loading-line loading-line-copy" />
        <div className="loading-table" />
      </div>
    </div>
  );
}
