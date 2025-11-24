/*---------------------------------------
File: src/domain/common/schemas.ts
Description: Comprehensive Zod validation schemas for the Eye-Doo application.
Provides type-safe validation for user inputs, database entities, and API payloads
with consistent error messages and transformation logic.

Key Features:
- Base validation schemas for common data types (email, password, phone, etc.)
- Robust timestamp handling with Firestore compatibility
- Composable schema patterns for complex objects
- Type-safe validation with TypeScript inference
- User-friendly error messages for form validation

Author: Kyle Lovesy
Date: 27/10-2025 - 09.45
Version: 1.1.0
---------------------------------------*/

import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';
import { dateSchema } from '@/utils/schema-helpers';
import { ProjectStatus } from '@/constants/enums';

/**
 * @description Schema for UUID validation
 * @summary - A basic schema for a string UUID, ensuring it's a valid UUID.
 * @example
 * {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 * }
 */
export const uuidSchema = z.string().uuid();

/**
 * @description Schema for ID validation
 * @summary - A basic schema for a string ID, ensuring it's a valid ID.
 * @example
 * {
 *   id: '123',
 * }
 */
export const idSchema = z.string().min(1, 'ID is required');

/**
 * @description Schema for email address validation
 * @summary - Enforces RFC-compliant email format with length limits and normalization
 * @example
 * {
 *   email: 'john.doe@example.com',
 * }
 */
export const emailSchema = z
  .string()
  .min(1, { message: 'Email address is required' })
  .max(254, { message: 'Email address is too long' })
  .email({ message: 'Please enter a valid email address' })
  .trim()
  .toLowerCase();

/**
 * @description Schema for password validation with security requirements
 * @summary - Enforces minimum complexity rules for account security
 * @example
 * {
 *   password: 'Password123',
 * }
 */
export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters' })
  .max(128, { message: 'Password is too long' })
  .refine(val => /[0-9]/.test(val), { message: 'Password must contain at least one number' })
  // Add this new refinement for special characters (adjust the regex as needed for allowed specials)
  .refine(val => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
    message: 'Password must contain at least one special character',
  });

/**
 * @description Schema for user display names and full names
 * @summary - Balanced length constraints for usability and data integrity
 * @example
 * {
 *   displayName: 'John Doe',
 * }
 */
export const displayNameSchema = z
  .string()
  .min(2, { message: 'Display name must be at least 2 characters' })
  .max(50, { message: 'Display name must be less than 50 characters' })
  .trim();

/**
 * @description Schema for URL validation
 * @summary - Accepts standard web URLs with protocol requirements
 * @example
 * {
 *   url: 'https://www.example.com',
 * }
 */
export const urlSchema = z
  .string()
  .min(1, { message: 'URL is required' })
  .url({ message: 'Please enter a valid URL' })
  .trim();

/**
 * @description Schema for international phone number validation
 * @summary - Normalizes input by removing formatting and validates digit count
 * @example
 * {
 *   phone: '+1234567890',
 * }
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform(phone => phone.replace(/[\s-()]/g, ''))
  .refine(phone => /^\+?\d{7,15}$/.test(phone), {
    message: 'Please enter a valid phone number (7-15 digits)',
  });

/**
 * @description Schema for hex color validation
 * @summary - Enforces hex color format with optional alpha channel
 * @example
 * {
 *   color: '#000000',
 * }
 */
export const hexColorSchema = z.string().regex(/^#([0-9a-f]{3}){1,2}$/i);
export const optionalHexColorSchema = hexColorSchema.optional();

/**
 * @description Robust preprocessor for converting various timestamp formats to JavaScript Date objects
 * @summary - Handles Firestore Timestamps, ISO strings, Unix timestamps, and Date objects *
 * @param val - The value to convert to a Date
 * @returns A valid Date object or undefined if conversion fails
 * @example
 * {
 *   timestamp: '2025-01-01T00:00:00.000Z',
 * }
 */
export const timestampPreprocessor = (val: unknown): Date | undefined => {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (val instanceof Timestamp) return val.toDate();

  // Handle string/number timestamps (ISO strings, Unix timestamps)
  if (typeof val === 'string' || typeof val === 'number') {
    const date = new Date(val);
    if (!isNaN(date.getTime())) return date;
  }

  // Handle Firestore Timestamp-like objects
  if (
    typeof val === 'object' &&
    val !== null &&
    'seconds' in (val as Record<string, unknown>) &&
    typeof (val as Record<string, unknown>).seconds === 'number' &&
    'nanoseconds' in (val as Record<string, unknown>) &&
    typeof (val as Record<string, unknown>).nanoseconds === 'number'
  ) {
    return new Timestamp(
      (val as Record<string, unknown>).seconds as number,
      (val as Record<string, unknown>).nanoseconds as number,
    ).toDate();
  }

  return undefined;
};

/**
 * @description Schema for required date/timestamp fields
 * @summary - Accepts various input formats and converts them to validated Date objects
 * @example
 * {
 *   timestamp: '2025-01-01T00:00:00.000Z',
 * }
 */
// export const requiredTimestampSchema = z.preprocess(
//   timestampPreprocessor,
//   z.date({
//     required_error: 'Date is required',
//     invalid_type_error: 'Invalid date format',
//   }),
// );
export const requiredTimestampSchema = dateSchema;

/**
 * @description Schema for optional date/timestamp fields
 * @summary - Accepts various input formats or null/undefined values
 * @example
 * {
 *   timestamp: '2025-01-01T00:00:00.000Z',
 *   timestamp: 1714732800000,
 *   timestamp: new Date(),
 *   timestamp: new Timestamp(1714732800, 0),
 * }
 */
// export const optionalTimestampSchema = z.preprocess(
//   timestampPreprocessor,
//   z.date().optional().nullable(),
// );
export const optionalTimestampSchema = dateSchema.nullable();

/**
 * @description Schema for basic person name information
 * @summary - Supports first and last name
 * @example
 * {
 *   firstName: 'John',
 *   lastName: 'Doe',
 * }
 */
export const personInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
});

/**
 * @description Schema for contact information including email and phone
 * @summary - Supports email, phone, and website
 * @example
 * {
 *   email: 'john.doe@example.com',
 *   phone: '+1234567890',
 *   website: 'https://www.example.com',
 * }
 */
export const contactInfoSchema = z.object({
  email: emailSchema,
  phone: phoneSchema.optional(),
  website: urlSchema.optional(),
});

/**
 * @description Schema for business information including company name and job title
 * @summary - Supports company name and job title
 * @example
 * {
 *   companyName: 'Acme Inc.',
 *   jobTitle: 'Software Engineer',
 * }
 */
export const businessInfoSchema = z
  .object({
    companyName: z
      .string()
      .min(1, 'Company name is required')
      .max(100, 'Company name is too long')
      .trim()
      .optional(),
    jobTitle: z
      .string()
      .min(1, 'Job title is required')
      .max(100, 'Job title is too long')
      .trim()
      .optional(),
  })
  .strict();

/**
 * @description Schema for address information including street, city, state, and zip code
 * @summary - Supports street, city, state, and postal code
 * @example
 * {
 *   street: '123 Main St',
 *   city: 'Anytown',
 *   //state: 'CA',
 *   postalCode: '12345',
 *   //country: 'USA',
 * }
 */
export const addressInfoSchema = z
  .object({
    street: z.string().min(1, 'Street is required').trim(),
    city: z.string().min(1, 'City is required').trim(),
    // state: z.string().min(1, 'State is required').trim(),
    postalCode: z.string().min(1, 'Postal code is required').trim(),
    // country: z.string().min(1, 'Country is required').trim(),
  })
  .strict();

/**
 * @description Schema for project tracking and metadata
 * @summary - Used in project management, status tracking, and audit trails
 * @example
 * {
 *   projectName: 'Project 1',
 *   projectStatus: ProjectStatus.DRAFT,
 *   personA: PersonInfoSchema,
 *   personB: PersonInfoSchema,
 *   contact: ContactInfoSchema,
 *   eventDate: RequiredTimestampSchema,
 *   coverImage: z.string().optional(),
 * }
 */
export const projectTrackingSchema = z
  .object({
    projectName: z
      .string()
      .min(1, 'Project name is required')
      .max(50, 'Must be less than 50 characters')
      .trim(),
    projectStatus: z.nativeEnum(ProjectStatus).default(ProjectStatus.SETUP),
    personA: personInfoSchema,
    personB: personInfoSchema,
    contact: contactInfoSchema,
    eventDate: requiredTimestampSchema,
    coverImage: z.string().optional(),
  })
  .strict();

/**
 * @description Schema for social media profile URLs
 * @summary - Supports major social media platforms and custom URLs
 * @example
 * {
 *   instagram: 'https://www.instagram.com/user',
 *   facebook: 'https://www.facebook.com/user',
 *   twitter: 'https://www.twitter.com/user',
 *   linkedin: 'https://www.linkedin.com/user',
 *   youtube: 'https://www.youtube.com/user',
 *   tiktok: 'https://www.tiktok.com/user',
 *   pinterest: 'https://www.pinterest.com/user',
 *   other: 'https://www.user.com',
 * }
 */
export const socialMediaSchema = z
  .object({
    instagram: urlSchema.optional(),
    facebook: urlSchema.optional(),
    twitter: urlSchema.optional(),
    linkedin: urlSchema.optional(),
    youtube: urlSchema.optional(),
    tiktok: urlSchema.optional(),
    pinterest: urlSchema.optional(),
    other: urlSchema.optional(),
  })
  .strict();

/**
 * @description Schema for common timestamp pairs used across domain objects
 * @summary - Provides consistent created/updated timestamp tracking
 * @example
 * {
 *   createdAt: requiredTimestampSchema,
 *   updatedAt: optionalTimestampSchema,
 * }
 */
export const timestampPairSchema = z
  .object({
    createdAt: requiredTimestampSchema,
    updatedAt: optionalTimestampSchema,
  })
  .strict();

/**
 * @description Schema for geographical coordinates.
 * @summary - Supports latitude and longitude coordinates
 * @example
 * {
 *   latitude: 40.7128,
 *   longitude: -74.0060,
 * }
 */
export const geoPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

/**
 * @description Schema for a time range, ensuring endTime is after startTime.
 * @summary - Ensures endTime is after startTime
 * @example
 * {
 *   startTime: '10:00',
 *   endTime: '12:00',
 * }
 */
export const timeRangeSchema = z
  .object({
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
  })
  .refine(data => data.startTime < data.endTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

/**
 * @description Schema for weather data used in timeline and location features
 * @summary - Supports temperature and weather condition information
 * @example
 * {
 *   temperature: 72,
 *   condition: 'sunny',
 * }
 */
export const weatherDataSchema = z
  .object({
    temperature: z.number().optional(),
    condition: z.string().optional(),
  })
  .strict();

/**
 * @description Schema for notification data used in timeline and notification features
 * @summary - Tracks notification scheduling and delivery status
 * @example
 * {
 *   scheduledTime: OptionalTimestampSchema,
 *   hasBeenSent: z.boolean().default(false),
 *   message: z.string().max(200, 'Message is too long').optional(),
 * }
 */
export const notificationDataSchema = z
  .object({
    scheduledTime: optionalTimestampSchema.optional(),
    hasBeenSent: z.boolean().default(false),
    message: z.string().optional(),
  })
  .strict();

/**
 * @description Schema for list metadata
 * @summary - Tracks the number of items in a list, the number of checked items, and the number of custom items
 * @example
 * {
 *   totalItems: 10,
 *   checkedItems: 5,
 *   customItems: 3,
 * }
 */
export const listMetadataSchema = z
  .object({
    totalItems: z.number().int().min(0).default(0),
    checkedItems: z.number().int().min(0).default(0).optional(),
    customItems: z.number().int().min(0).default(0).optional(),
  })
  .strict();

/**
 * @description Schema for audit metadata
 * @summary - Tracks the user who updated the data and the timestamp of the update
 * @example
 * {
 *   updatedBy: '123e4567-e89b-12d3-a456-426614174000',
 *   updatedAt: '2025-01-01T00:00:00.000Z',
 * }
 */
export const auditMetadataSchema = z
  .object({
    updatedBy: uuidSchema.optional(),
    updatedAt: optionalTimestampSchema.optional(),
  })
  .strict();

/**
 * @description Schema for base metadata
 * @summary - Tracks the user who created the data and the timestamp of the creation, the user who updated the data and the timestamp of the update, the number of items in a list, the number of checked items, and the number of custom items
 * @example
 * {
 *   createdBy: '123e4567-e89b-12d3-a456-426614174000',
 *   createdAt: '2025-01-01T00:00:00.000Z',
 *   updatedBy: '123e4567-e89b-12d3-a456-426614174000',
 *   updatedAt: '2025-01-01T00:00:00.000Z',
 *   totalItems: 100,
 *   checkedItems: 50,
 *   customItems: 50,
 * }
 */
export const baseMetadataSchema = z
  .object({
    createdBy: uuidSchema.optional(),
    createdAt: requiredTimestampSchema,
    audit: auditMetadataSchema.optional(),
    listMetadata: listMetadataSchema.optional(),
  })
  .strict();

export type UUID = z.infer<typeof uuidSchema>;
export type ID = z.infer<typeof idSchema>;
export type Email = z.infer<typeof emailSchema>;
export type Password = z.infer<typeof passwordSchema>;
export type DisplayName = z.infer<typeof displayNameSchema>;
export type URL = z.infer<typeof urlSchema>;
export type Phone = z.infer<typeof phoneSchema>;
export type HexColor = z.infer<typeof hexColorSchema>;
export type OptionalHexColor = z.infer<typeof optionalHexColorSchema>;

export type RequiredTimestamp = z.infer<typeof requiredTimestampSchema>;
export type OptionalTimestamp = z.infer<typeof optionalTimestampSchema>;
export type PersonInfo = z.infer<typeof personInfoSchema>;
export type ContactInfo = z.infer<typeof contactInfoSchema>;
export type BusinessInfo = z.infer<typeof businessInfoSchema>;
export type AddressInfo = z.infer<typeof addressInfoSchema>;
export type ProjectTracking = z.infer<typeof projectTrackingSchema>;
export type SocialMedia = z.infer<typeof socialMediaSchema>;

export type TimestampPair = z.infer<typeof timestampPairSchema>;
export type GeoPoint = z.infer<typeof geoPointSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;
export type WeatherData = z.infer<typeof weatherDataSchema>;
export type NotificationData = z.infer<typeof notificationDataSchema>;

export type AuditMetadata = z.infer<typeof auditMetadataSchema>;
export type ListMetadata = z.infer<typeof listMetadataSchema>;
export type BaseMetadata = z.infer<typeof baseMetadataSchema>;

/**
 * @description Default value for BaseMetadata
 */
export const defaultMetadata: BaseMetadata = {
  createdAt: new Date(),
  audit: {
    updatedAt: new Date(),
    updatedBy: 'system',
  },
  createdBy: 'system',
};
