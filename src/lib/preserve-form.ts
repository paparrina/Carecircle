import { startTransition, type FormEvent } from "react";

// Dispatch explicitly so React does not reset uncontrolled inputs when an
// action returns a validation error. Successful create actions still redirect.
export function preserveForm(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
}
