import Form from "next/form";
import { volverAlAdmin } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";

export function VolverAdminButton() {
  return (
    <Form action={volverAlAdmin}>
      <Button size="xs" type="submit" variant="outline">
        Volver al admin
      </Button>
    </Form>
  );
}
