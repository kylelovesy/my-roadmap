/*---------------------------------------
File: src/domain/user/business-card.schema.ts
Description: Business card schemas - flattened structure following project standards
Author: Kyle Lovesy
Date: 28/10-2025 - 10.00
Version: 2.0.0
---------------------------------------*/
import { z } from 'zod';
import {
  idSchema,
  displayNameSchema,
  urlSchema,
  emailSchema,
  phoneSchema,
  requiredTimestampSchema,
  optionalTimestampSchema,
} from '@/domain/common/shared-schemas';
import { DEFAULTS } from '@/constants/defaults';

/**
 * ============================================================================
 * BUSINESS CARD SCHEMA - Flattened structure
 * ============================================================================
 * Professional contact information and branding
 * All nested objects have been flattened to top-level fields
 */

export const businessCardSchema = z.object({
  id: idSchema,
  userId: idSchema,

  // Name fields (flattened from personInfoSchema)
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(DEFAULTS.TEXT_LENGTHS.NAME, `First name ${DEFAULTS.TEXT_LENGTHS_MSG.NAME}`)
    .trim(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(DEFAULTS.TEXT_LENGTHS.NAME, `Last name ${DEFAULTS.TEXT_LENGTHS_MSG.NAME}`)
    .trim(),
  displayName: displayNameSchema,

  // Company fields (flattened from businessInfoSchema)
  companyName: z
    .string()
    .max(DEFAULTS.TEXT_LENGTHS.DESCRIPTION, `Company name ${DEFAULTS.TEXT_LENGTHS_MSG.DESCRIPTION}`)
    .trim()
    .optional()
    .nullable()
    .default(null),
  jobTitle: z
    .string()
    .max(DEFAULTS.TEXT_LENGTHS.DESCRIPTION, `Job title ${DEFAULTS.TEXT_LENGTHS_MSG.DESCRIPTION}`)
    .trim()
    .optional()
    .nullable()
    .default(null),

  // Address fields (flattened from addressInfoSchema)
  street: z
    .string()
    .min(1, 'Street is required')
    .max(200, 'Street is too long')
    .trim()
    .optional()
    .nullable()
    .default(null),
  city: z
    .string()
    .min(1, 'City is required')
    .max(DEFAULTS.TEXT_LENGTHS.DESCRIPTION, `City ${DEFAULTS.TEXT_LENGTHS_MSG.DESCRIPTION}`)
    .trim()
    .optional()
    .nullable()
    .default(null),
  postalCode: z
    .string()
    .min(1, 'Postal code is required')
    .max(20, 'Postal code is too long')
    .trim()
    .optional()
    .nullable()
    .default(null),

  // Contact fields (flattened from contactInfoSchema)
  contactEmail: emailSchema.optional().nullable().default(null),
  contactPhone: phoneSchema.optional().nullable().default(null),
  website: urlSchema.optional().nullable().default(null),

  // Social media fields (flattened from socialMediaSchema)
  instagram: urlSchema.optional().nullable().default(null),
  facebook: urlSchema.optional().nullable().default(null),
  twitter: urlSchema.optional().nullable().default(null),
  linkedin: urlSchema.optional().nullable().default(null),
  youtube: urlSchema.optional().nullable().default(null),
  tiktok: urlSchema.optional().nullable().default(null),
  pinterest: urlSchema.optional().nullable().default(null),
  socialMediaOther: urlSchema.optional().nullable().default(null),

  // Notes
  notes: z
    .string()
    .max(DEFAULTS.TEXT_LENGTHS.NOTES, `Notes ${DEFAULTS.TEXT_LENGTHS_MSG.NOTES}`)
    .optional()
    .nullable()
    .default(null),

  // Timestamps
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

/**
 * ============================================================================
 * INPUT SCHEMAS
 * ============================================================================
 */

export const businessCardInputSchema = businessCardSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const businessCardUpdateSchema = businessCardInputSchema.partial();

/**
 * ============================================================================
 * CONTACT INPUT SCHEMAS
 * ============================================================================
 * Simplified schemas for contact information only
 */

export const businessCardContactInputSchema = businessCardSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  website: true,
  instagram: true,
  facebook: true,
  twitter: true,
  linkedin: true,
  youtube: true,
  tiktok: true,
  pinterest: true,
  socialMediaOther: true,
  notes: true,
});

export const businessCardContactUpdateSchema = businessCardContactInputSchema.partial();

/**
 * ============================================================================
 * SOCIAL MEDIA INPUT SCHEMAS
 * ============================================================================
 */

export const businessCardSocialMediaInputSchema = z.object({
  instagram: urlSchema.optional(),
  facebook: urlSchema.optional(),
  twitter: urlSchema.optional(),
  linkedin: urlSchema.optional(),
  youtube: urlSchema.optional(),
  tiktok: urlSchema.optional(),
  pinterest: urlSchema.optional(),
  socialMediaOther: urlSchema.optional(),
});

export const businessCardSocialMediaUpdateSchema = businessCardSocialMediaInputSchema.partial();

/**
 * ============================================================================
 * QR CODE & VCARD SCHEMAS
 * ============================================================================
 * Configuration schemas for QR code and vCard generation
 */

export const businessCardQRCodeSchema = z.object({
  businessCardId: idSchema,
  format: z.enum(['png', 'svg']).default('png'),
  size: z.number().int().min(100).max(1000).default(300),
  includeBackground: z.boolean().default(DEFAULTS.ENABLED),
});

export const businessCardVCardSchema = z.object({
  businessCardId: idSchema,
  version: z.enum(['3.0', '4.0']).default(DEFAULTS.BUSINESS_CARD_VERSION),
});

/**
 * ============================================================================
 * SHARE SCHEMA
 * ============================================================================
 */

export const businessCardShareSchema = z.object({
  businessCardId: idSchema,
  method: z.enum(['email', 'sms', 'qr', 'link']),
  recipientEmail: emailSchema.optional(),
  recipientPhone: phoneSchema.optional(),
});

/**
 * ============================================================================
 * VALIDATION REFINEMENTS
 * ============================================================================
 */

export const businessCardWithContactSchema = businessCardInputSchema.refine(
  data => {
    if (!data.contactEmail && !data.contactPhone && !data.website) {
      return false;
    }
    return true;
  },
  {
    message: 'At least one contact method (email, phone, or website) is required',
    path: ['contactEmail'],
  },
);

/**
 * ============================================================================
 * TYPES
 * ============================================================================
 */

export type BusinessCard = z.infer<typeof businessCardSchema>;
export type BusinessCardInput = z.infer<typeof businessCardInputSchema>;
export type BusinessCardUpdate = z.infer<typeof businessCardUpdateSchema>;

export type BusinessCardContactInput = z.infer<typeof businessCardContactInputSchema>;
export type BusinessCardContactUpdate = z.infer<typeof businessCardContactUpdateSchema>;

export type BusinessCardSocialMediaInput = z.infer<typeof businessCardSocialMediaInputSchema>;
export type BusinessCardSocialMediaUpdate = z.infer<typeof businessCardSocialMediaUpdateSchema>;

export type BusinessCardQRCode = z.infer<typeof businessCardQRCodeSchema>;
export type BusinessCardVCard = z.infer<typeof businessCardVCardSchema>;
export type BusinessCardShare = z.infer<typeof businessCardShareSchema>;
export type BusinessCardWithContact = z.infer<typeof businessCardWithContactSchema>;

/**
 * ============================================================================
 * DEFAULT VALUE FACTORIES
 * ============================================================================
 */

export const defaultBusinessCard = (userId: string): BusinessCard => ({
  id: '', // Generated by Firestore
  userId,
  firstName: '',
  lastName: '',
  displayName: '',
  companyName: null,
  jobTitle: null,
  street: null,
  city: null,
  postalCode: null,
  contactEmail: null,
  contactPhone: null,
  website: null,
  instagram: null,
  facebook: null,
  twitter: null,
  linkedin: null,
  youtube: null,
  tiktok: null,
  pinterest: null,
  socialMediaOther: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: null,
});
