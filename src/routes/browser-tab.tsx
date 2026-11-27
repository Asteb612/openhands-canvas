import { BrowserPanel } from "#/components/features/browser/browser";
import { useFactoryPreview } from "#/factory/preview-panel"; // factory: stack preview
import { FactoryPreviewFrame } from "#/factory/preview-frame";

function Browser() {
  // factory: in a ticket conversation of a project with a preview, its stack.
  const preview = useFactoryPreview();
  if (preview) return <FactoryPreviewFrame preview={preview} />;
  return <BrowserPanel />;
}

export default Browser;
