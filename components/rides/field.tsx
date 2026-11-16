import { FieldError } from "@/components/form-message";
import { Label } from "@/components/ui/label";

/** Label + control + inline error, wired up for screen readers. */
export function Field({
  id,
  label,
  errors,
  help,
  children,
}: {
  id: string;
  label: string;
  errors?: string[];
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? (
        <p id={`${id}-help`} className="text-muted-foreground text-sm">
          {help}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} errors={errors} />
    </div>
  );
}

/** id/name/aria props for a control inside <Field>. */
export function fieldAria(id: string, errors?: string[], help?: boolean) {
  return {
    id,
    name: id,
    "aria-invalid": errors ? true : undefined,
    "aria-describedby": [help ? `${id}-help` : null, `${id}-error`].filter(Boolean).join(" "),
  } as const;
}
