export type EmergencyContact = { name: string; relation?: string; phone: string };
export type Doctor = { name: string; specialty?: string; phone?: string; address?: string };

export type RecipientHeader = {
  name: string;
  photoUrl: string | null;
  age: number | null;
  emergencyContacts: EmergencyContact[];
  doctors: Doctor[];
};

export type LatestCheckin = {
  place: "home" | "day_center" | "doctor" | "walk" | "other";
  placeLabel: string | null;
  byName: string;
  at: string; // ISO
} | null;
