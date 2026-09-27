"use client";

/** Opens the browser's print dialog, where "Save as PDF" is one of the printers. */
export function PrintButton() {
  return (
    <button type="button" className="mg-button is-primary" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
