"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardTitle } from "@/components/ui/card";
import { updateRecipient, type ActionState } from "@/lib/circle/actions";
import type { Doctor, EmergencyContact } from "./types";

export type ProfileInitial = {
  fullName: string;
  birthDate: string;
  phone: string;
  allergies: string;
  conditions: string;
  notes: string;
  contacts: EmergencyContact[];
  doctors: Doctor[];
};

export function ProfileForm({
  circleId,
  initial
}: {
  circleId: string;
  initial: ProfileInitial;
}) {
  const t = useTranslations("profile");
  const tc = useTranslations("auth");
  const [contacts, setContacts] = useState<EmergencyContact[]>(
    initial.contacts
  );
  const [doctors, setDoctors] = useState<Doctor[]>(initial.doctors);
  const [saved, setSaved] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateRecipient,
    null
  );

  // Mostrar "guardado" cuando la acción termina sin error
  const [wasPending, setWasPending] = useState(false);
  useEffect(() => {
    if (pending) setWasPending(true);
    else if (wasPending && !state?.error) {
      setSaved(true);
      setWasPending(false);
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    } else if (wasPending) setWasPending(false);
  }, [pending, state, wasPending]);

  const inputCls = "text-[16px]";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />
      <input type="hidden" name="doctors" value={JSON.stringify(doctors)} />

      <Card>
        <CardTitle>{t("basic")}</CardTitle>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <Label htmlFor="p-name">{t("nameLabel")}</Label>
            <Input
              id="p-name"
              name="fullName"
              defaultValue={initial.fullName}
              required
              minLength={2}
            />
          </div>
          <div>
            <Label htmlFor="p-birth">{t("birthLabel")}</Label>
            <Input
              id="p-birth"
              name="birthDate"
              type="date"
              defaultValue={initial.birthDate}
            />
          </div>
          <div>
            <Label htmlFor="p-phone">{t("phoneLabel")}</Label>
            <Input
              id="p-phone"
              name="phone"
              type="tel"
              defaultValue={initial.phone}
            />
          </div>
          <div>
            <Label htmlFor="p-all">{t("allergies")}</Label>
            <Input
              id="p-all"
              name="allergies"
              defaultValue={initial.allergies}
              placeholder={t("allergiesPh")}
            />
          </div>
          <div>
            <Label htmlFor="p-cond">{t("conditions")}</Label>
            <Input
              id="p-cond"
              name="conditions"
              defaultValue={initial.conditions}
              placeholder={t("conditionsPh")}
            />
          </div>
          <div>
            <Label htmlFor="p-notes">{t("notes")}</Label>
            <textarea
              id="p-notes"
              name="notes"
              defaultValue={initial.notes}
              rows={3}
              className="w-full rounded-md border border-line bg-surface p-3 text-lg text-ink focus:border-primary focus:outline focus:outline-2 focus:outline-primary/30"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>{t("contacts")}</CardTitle>
        <div className="mt-3 flex flex-col gap-3">
          {contacts.map((c, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-md border border-line p-3"
            >
              <Input
                aria-label={t("cName")}
                placeholder={t("cName")}
                value={c.name}
                className={inputCls}
                onChange={(e) =>
                  setContacts((cs) =>
                    cs.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    )
                  )
                }
              />
              <div className="flex gap-2">
                <Input
                  aria-label={t("cRelation")}
                  placeholder={t("cRelation")}
                  value={c.relation ?? ""}
                  className={inputCls}
                  onChange={(e) =>
                    setContacts((cs) =>
                      cs.map((x, j) =>
                        j === i ? { ...x, relation: e.target.value } : x
                      )
                    )
                  }
                />
                <Input
                  aria-label={t("cPhone")}
                  placeholder={t("cPhone")}
                  type="tel"
                  value={c.phone}
                  className={inputCls}
                  onChange={(e) =>
                    setContacts((cs) =>
                      cs.map((x, j) =>
                        j === i ? { ...x, phone: e.target.value } : x
                      )
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setContacts((cs) => cs.filter((_, j) => j !== i))
                }
                className="flex min-h-touch items-center gap-1.5 self-start text-[15px] font-medium text-danger"
              >
                <Trash2 size={17} /> {t("remove")}
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setContacts((cs) => [...cs, { name: "", relation: "", phone: "" }])
            }
          >
            <Plus size={20} /> {t("addContact")}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>{t("doctors")}</CardTitle>
        <div className="mt-3 flex flex-col gap-3">
          {doctors.map((d, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-md border border-line p-3"
            >
              <div className="flex gap-2">
                <Input
                  aria-label={t("cName")}
                  placeholder={t("cName")}
                  value={d.name}
                  className={inputCls}
                  onChange={(e) =>
                    setDoctors((ds) =>
                      ds.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x
                      )
                    )
                  }
                />
                <Input
                  aria-label={t("dSpecialty")}
                  placeholder={t("dSpecialty")}
                  value={d.specialty ?? ""}
                  className={inputCls}
                  onChange={(e) =>
                    setDoctors((ds) =>
                      ds.map((x, j) =>
                        j === i ? { ...x, specialty: e.target.value } : x
                      )
                    )
                  }
                />
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label={t("cPhone")}
                  placeholder={t("cPhone")}
                  type="tel"
                  value={d.phone ?? ""}
                  className={inputCls}
                  onChange={(e) =>
                    setDoctors((ds) =>
                      ds.map((x, j) =>
                        j === i ? { ...x, phone: e.target.value } : x
                      )
                    )
                  }
                />
                <Input
                  aria-label={t("dAddress")}
                  placeholder={t("dAddress")}
                  value={d.address ?? ""}
                  className={inputCls}
                  onChange={(e) =>
                    setDoctors((ds) =>
                      ds.map((x, j) =>
                        j === i ? { ...x, address: e.target.value } : x
                      )
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => setDoctors((ds) => ds.filter((_, j) => j !== i))}
                className="flex min-h-touch items-center gap-1.5 self-start text-[15px] font-medium text-danger"
              >
                <Trash2 size={17} /> {t("remove")}
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setDoctors((ds) => [
                ...ds,
                { name: "", specialty: "", phone: "", address: "" }
              ])
            }
          >
            <Plus size={20} /> {t("addDoctor")}
          </Button>
        </div>
      </Card>

      {state?.error && (
        <p role="alert" className="text-[16px] font-medium text-danger">
          {tc("errorGeneric")}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className="rounded-md bg-success-soft p-3 text-center text-[16px] font-medium text-success"
        >
          {t("saved")}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
