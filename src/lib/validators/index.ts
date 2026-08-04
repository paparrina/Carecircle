import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6).max(72)
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z.string().min(8).max(72)
});

export const magicLinkSchema = z.object({ email: emailSchema });

const currentYear = new Date().getFullYear();
export const newCircleSchema = z.object({
  recipientName: z.string().trim().min(2).max(80),
  birthYear: z
    .union([z.literal(""), z.coerce.number().int().min(1900).max(currentYear)])
    .optional(),
  consent: z.literal("on")
});

export const checkinSchema = z.object({
  circleId: z.string().uuid(),
  place: z.enum(["home", "day_center", "doctor", "walk", "other"]),
  placeLabel: z.string().trim().max(80).optional()
});

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const medicationSchema = z.object({
  circleId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  dosage: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(200).optional().or(z.literal("")),
  times: z.array(z.string().regex(timeRe)).min(1).max(8),
  days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  assignedTo: z.string().uuid().optional().or(z.literal(""))
});

export const doseLogSchema = z.object({
  circleId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  medicationId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["taken", "skipped"])
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  relation: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().min(3).max(30)
});
const doctorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  specialty: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(160).optional().or(z.literal(""))
});

export const recipientSchema = z.object({
  circleId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  allergies: z.string().max(400),
  conditions: z.string().max(400),
  notes: z.string().max(1000),
  contacts: z.array(contactSchema).max(10),
  doctors: z.array(doctorSchema).max(10)
});

export const eventSchema = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  type: z.enum(["medical", "visit", "task", "other"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .or(z.literal("")),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  assignedTo: z.string().uuid().optional().or(z.literal("")),
  reminders: z.array(z.coerce.number().int().positive().max(20160)).max(4)
});

export const inviteSchema = z.object({
  circleId: z.string().uuid(),
  role: z.enum(["member", "viewer"]),
  email: emailSchema.optional().or(z.literal(""))
});

export const roleChangeSchema = z.object({
  circleId: z.string().uuid(),
  memberRowId: z.string().uuid(),
  role: z.enum(["coordinator", "member", "viewer"])
});

const attachmentSchema = z.object({
  storage_path: z.string().min(5).max(400),
  mime_type: z.string().max(120),
  name: z.string().max(160)
});

export const postSchema = z.object({
  circleId: z.string().uuid(),
  body: z.string().trim().max(2000),
  mentions: z.array(z.string().uuid()).max(15),
  attachments: z.array(attachmentSchema).max(4)
});

export const commentSchema = z.object({
  circleId: z.string().uuid(),
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000)
});

export const importantDateSchema = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["birthday", "anniversary", "expiry", "other"]),
  recurring: z.boolean(),
  remindDaysBefore: z.array(z.coerce.number().int().min(0).max(60)).max(4)
});
