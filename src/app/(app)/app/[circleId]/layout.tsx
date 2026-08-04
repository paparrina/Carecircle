import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CircleHeader } from "@/components/circle/circle-header";
import { BottomNav } from "@/components/shared/bottom-nav";
import { ageFrom } from "@/lib/utils";
import type {
  Doctor,
  EmergencyContact,
  LatestCheckin
} from "@/components/circle/types";

export default async function CircleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // La membresía es la puerta de entrada (RLS ya protege los datos)
  const { data: membership } = await supabase
    .from("circle_members")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const [{ data: recipient }, { data: checkin }, { count: unread }] = await Promise.all([
    supabase
      .from("care_recipients")
      .select(
        "full_name, birth_date, photo_url, phone, emergency_contacts, doctors"
      )
      .eq("circle_id", circleId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("location_checkins")
      .select("place, place_label, created_at, profiles:checked_by(full_name)")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("circle_id", circleId)
      .is("read_at", null)
  ]);

  if (!recipient) notFound();

  const checkedBy = checkin
    ? Array.isArray(checkin.profiles)
      ? checkin.profiles[0]
      : checkin.profiles
    : null;

  const latestCheckin: LatestCheckin = checkin
    ? {
        place: checkin.place,
        placeLabel: checkin.place_label,
        byName: checkedBy?.full_name?.split(" ")[0] ?? "",
        at: checkin.created_at
      }
    : null;

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <CircleHeader
        circleId={circleId}
        recipient={{
          name: recipient.full_name,
          photoUrl: recipient.photo_url,
          age: ageFrom(recipient.birth_date),
          emergencyContacts: (recipient.emergency_contacts ??
            []) as EmergencyContact[],
          doctors: (recipient.doctors ?? []) as Doctor[]
        }}
        recipientPhone={recipient.phone ?? undefined}
        latestCheckin={latestCheckin}
        unreadCount={unread ?? 0}
      />
      <main className="px-4 pb-28 pt-4">{children}</main>
      <BottomNav circleId={circleId} />
    </div>
  );
}
