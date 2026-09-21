const FORM_FIELD_SELECTOR = [
  "input",
  "button",
  "a[href]",
  "summary",
  "[role='button']",
  "[role='link']",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[contenteditable='']",
  "[role='textbox']",
  "[role='searchbox']",
  "[role='combobox']",
  "[role='listbox']",
  "[role='option']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='menuitemcheckbox']",
  "[role='menuitemradio']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='dialog']",
  "[role='alertdialog']",
  "[data-slot='select-content']",
  "[data-slot='dropdown-menu-content']",
  "[data-slot='popover-content']",
  "[data-slot='alert-dialog-content']",
].join(", ");

/** True when keyboard shortcuts should yield to typing / form / overlay controls. */
export function isFormFieldTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const node = target as {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  };
  if (node.isContentEditable) return true;
  const tag = typeof node.tagName === "string" ? node.tagName.toUpperCase() : "";
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY"].includes(tag)) return true;
  if (typeof node.closest === "function") {
    return Boolean(node.closest(FORM_FIELD_SELECTOR));
  }
  return false;
}
