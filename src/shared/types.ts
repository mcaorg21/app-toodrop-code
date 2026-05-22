import z from "zod";
import { validateCPF } from "./validators";

// User profile status enum
export type ProfileStatus = 
  | "incomplete" 
  | "complete" 
  | "consumer_active" 
  | "receiver_pending" 
  | "receiver_active";

// User schema
export const UserSchema = z.object({
  id: z.number(),
  mocha_user_id: z.string(),
  full_name: z.string().nullable(),
  cpf: z.string().nullable(),
  birth_date: z.string().nullable(),
  phone: z.string().nullable(),
  pix_key: z.string().nullable(),
  profile_status: z.string(),
  is_consumer_active: z.number(),
  is_receiver_pending: z.number(),
  is_receiver_active: z.number(),
  last_active_tab: z.string().nullable(),
  has_seen_consumer_tour: z.number().nullable(),
  has_seen_receiver_tour: z.number().nullable(),
  has_seen_delivery_tour: z.number().nullable(),
  main_interest: z.string().nullable(),
  asaas_account_id: z.string().nullable().optional(),
  asaas_wallet_id: z.string().nullable().optional(),
  asaas_api_key: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type User = z.infer<typeof UserSchema>;

// Address schema
export const AddressSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  address_type: z.string(),
  nickname: z.string(),
  cep: z.string(),
  street: z.string(),
  number: z.string(),
  complement: z.string().nullable(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  receiver_key: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Address = z.infer<typeof AddressSchema>;

// DropTag schema
export const DropTagSchema = z.object({
  id: z.number(),
  uuid: z.string(),
  consumer_user_id: z.number(),
  title: z.string().nullable(),
  tracking_code: z.string(),
  address_id: z.number(),
  secret_word: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.string(),
  qr_code_data: z.string(),
  receiver_user_id: z.number().nullable(),
  receiver_name: z.string().nullable(),
  receiver_phone: z.string().nullable(),
  receiver_address: z.string().nullable(),
  receiver_neighborhood: z.string().nullable(),
  receiver_city: z.string().nullable(),
  receiver_state: z.string().nullable(),
  receiver_complement: z.string().nullable(),
  receiver_key: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DropTag = z.infer<typeof DropTagSchema>;

// Receiver docs schema
export const ReceiverDocsSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  id_document_url: z.string(),
  selfie_url: z.string(),
  address_proof_url: z.string(),
  address_proof_type: z.string().nullable(),
  status: z.string(),
  review_notes: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  all_docs_validated: z.boolean().optional(),
});

export type ReceiverDocs = z.infer<typeof ReceiverDocsSchema>;

// Admin schema
export const AdminSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Admin = z.infer<typeof AdminSchema>;

// Schedule schema
export const ScheduleSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  day_of_week: z.number(),
  range1_start: z.string().nullable(),
  range1_end: z.string().nullable(),
  range2_start: z.string().nullable(),
  range2_end: z.string().nullable(),
  is_active: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Schedule = z.infer<typeof ScheduleSchema>;

// API Input schemas
export const CompleteProfileInputSchema = z.object({
  full_name: z.string().min(1, "Nome completo é obrigatório"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos").refine((cpf) => validateCPF(cpf), {
    message: "CPF inválido",
  }),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  phone: z.string().min(10, "Telefone inválido"),
  main_interest: z.enum(["consumer", "receiver", "delivery"], {
    errorMap: () => ({ message: "Selecione seu interesse principal" }),
  }),
});

export type CompleteProfileInput = z.infer<typeof CompleteProfileInputSchema>;

export const AddressInputSchema = z.object({
  nickname: z.string().min(1, "Apelido é obrigatório"),
  cep: z.string().regex(/^\d{8}$/, "CEP deve conter 8 dígitos"),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().length(2, "Estado deve ter 2 caracteres"),
  address_type: z.enum(["consumer", "receiver"]).default("consumer"),
});

export type AddressInput = z.infer<typeof AddressInputSchema>;

export const CreateDropTagInputSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  tracking_code: z.string().optional().refine(
    (val) => !val || /^\D{2}\d{9}\D{2}$/.test(val),
    { message: "Código de rastreio inválido" }
  ),
  address_id: z.number().int().positive("Selecione um endereço"),
  secret_word: z.string().optional(),
  notes: z.string().optional(),
  authorized_receivers: z.array(z.string()).min(1, "Selecione pelo menos 1 ponto de recebimento").max(15, "Máximo de 15 pontos de recebimento permitidos"),
});

export type CreateDropTagInput = z.infer<typeof CreateDropTagInputSchema>;

export const UpdateDropTagInputSchema = z.object({
  title: z.string().min(1, "Título é obrigatório").optional(),
  tracking_code: z.string().optional().refine(
    (val) => !val || /^\D{2}\d{9}\D{2}$/.test(val),
    { message: "Código de rastreio inválido" }
  ),
  address_id: z.number().int().positive("Selecione um endereço").optional(),
  secret_word: z.string().optional(),
  notes: z.string().optional(),
  authorized_receivers: z.array(z.string()).min(1, "Selecione pelo menos 1 ponto de recebimento").max(15, "Máximo de 15 pontos de recebimento permitidos").optional(),
});

export type UpdateDropTagInput = z.infer<typeof UpdateDropTagInputSchema>;

export const UpdateScheduleInputSchema = z.object({
  schedules: z.array(z.object({
    day_of_week: z.number().min(0).max(6),
    range1_start: z.string().nullable(),
    range1_end: z.string().nullable(),
    range2_start: z.string().nullable(),
    range2_end: z.string().nullable(),
    is_active: z.boolean(),
  })),
});

export type UpdateScheduleInput = z.infer<typeof UpdateScheduleInputSchema>;

export const HubLocationInputSchema = z.object({
  receiver_key: z.string().min(1, "Chave do recebedor é obrigatória"),
  latitude: z.number().min(-90).max(90, "Latitude inválida"),
  longitude: z.number().min(-180).max(180, "Longitude inválida"),
  timestamp: z.string().min(1, "Timestamp é obrigatório"),
});

export type HubLocationInput = z.infer<typeof HubLocationInputSchema>;
