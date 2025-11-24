/*---------------------------------------
File: src/domain/common/list-base.schema.ts
Description: Base list schemas - flattened structure
Author: Kyle Lovesy
Date: 03/11-2025
Version: 2.0.0
---------------------------------------*/
import { z } from 'zod';
import {
  idSchema,
  uuidSchema,
  optionalTimestampSchema,
  requiredTimestampSchema,
  hexColorSchema,
} from './shared-schemas';
import { ListType, ListSource } from '@/constants/enums';
import { DEFAULTS } from '@/constants/defaults';

/**
 * ============================================================================
 * BASE LIST CONFIG SCHEMA
 * ============================================================================
 * Core configuration for all list types - flattened structure
 */
export const listBaseConfigSchema = z.object({
  id: uuidSchema,
  type: z.nativeEnum(ListType),
  source: z.nativeEnum(ListSource).default(ListSource.MASTER_LIST),
  defaultValues: z.boolean().default(DEFAULTS.ENABLED),
  version: z.string().default(DEFAULTS.VERSION),

  // Audit fields (flattened from auditMetadata)
  createdBy: z.string().optional(),
  lastModifiedBy: z.string().optional(),

  // List metadata (flattened)
  totalCategories: z.number().int().min(0).default(0),
  totalItems: z.number().int().min(0).default(0),

  // Timestamps
  createdAt: requiredTimestampSchema,
  updatedAt: optionalTimestampSchema.optional(),
});

export const listBaseConfigInputSchema = listBaseConfigSchema.omit({
  id: true,
  createdBy: true,
  lastModifiedBy: true,
  totalCategories: true,
  totalItems: true,
  createdAt: true,
  updatedAt: true,
});

export const listBaseConfigUpdateSchema = listBaseConfigInputSchema.partial();

/**
 * ============================================================================
 * BASE CATEGORY SCHEMA
 * ============================================================================
 */
export const listBaseCategorySchema = z.object({
  id: idSchema,
  catName: z
    .string()
    .min(1, `Name ${DEFAULTS.TEXT_LENGTHS_MSG.REQUIRED}`)
    .max(DEFAULTS.TEXT_LENGTHS.NAME, DEFAULTS.TEXT_LENGTHS_MSG.NAME)
    .trim(),
  catDescription: z
    .string()
    .min(1, `Description ${DEFAULTS.TEXT_LENGTHS_MSG.REQUIRED}`)
    .max(DEFAULTS.TEXT_LENGTHS.DESCRIPTION, DEFAULTS.TEXT_LENGTHS_MSG.DESCRIPTION)
    .trim(),
  iconName: z
    .string()
    .max(DEFAULTS.TEXT_LENGTHS.ICON_NAME, DEFAULTS.TEXT_LENGTHS_MSG.ICON_NAME)
    .optional(),
  isCustom: z.boolean().default(false),
  isComplete: z.boolean().default(false),
  itemIds: z.array(idSchema).default([]),
  show: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
  color: hexColorSchema.optional(),
});

export const listBaseCategoryInputSchema = listBaseCategorySchema.omit({
  id: true,
  isCustom: true,
  itemIds: true,
  isComplete: true,
});

export const listBaseCategoryUpdateSchema = listBaseCategoryInputSchema.partial();

/**
 * ============================================================================
 * BASE ITEM SCHEMA
 * ============================================================================
 */
export const listBaseItemSchema = z.object({
  id: idSchema,
  categoryId: idSchema.optional(),
  itemName: z
    .string()
    .min(1, `Name ${DEFAULTS.TEXT_LENGTHS_MSG.REQUIRED}`)
    .max(DEFAULTS.TEXT_LENGTHS.NAME, `Name ${DEFAULTS.TEXT_LENGTHS_MSG.NAME}`)
    .trim(),
  itemDescription: z
    .string()
    .min(1, `Description ${DEFAULTS.TEXT_LENGTHS_MSG.REQUIRED}`)
    .max(DEFAULTS.TEXT_LENGTHS.DESCRIPTION, `Description ${DEFAULTS.TEXT_LENGTHS_MSG.DESCRIPTION}`)
    .trim(),
  isCustom: z.boolean().default(false),
  isChecked: z.boolean().default(false),
  isDisabled: z.boolean().default(false),
});

export const listBaseItemInputSchema = listBaseItemSchema.omit({
  id: true,
  categoryId: true,
  isCustom: true,
  isDisabled: true,
});

export const listBaseItemUpdateSchema = listBaseItemSchema
  .omit({
    id: true,
    isCustom: true,
  })
  .partial();

/**
 * ============================================================================
 * PENDING UPDATE SCHEMA
 * ============================================================================
 */
export const listBasePendingUpdateSchema = z.object({
  itemId: idSchema,
  update: listBaseItemUpdateSchema,
  status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED']),
  timestamp: optionalTimestampSchema,
});

/**
 * ============================================================================
 * BASE LIST WRAPPER SCHEMA
 * ============================================================================
 */
export const listBaseWrapperSchema = z.object({
  config: listBaseConfigSchema,
  categories: z.array(listBaseCategorySchema).default([]),
  items: z.array(listBaseItemSchema).default([]),
  pendingUpdates: z.array(listBasePendingUpdateSchema).optional().default([]),
});

/**
 * ============================================================================
 * TYPE EXPORTS
 * ============================================================================
 */
export type ListBaseConfig = z.infer<typeof listBaseConfigSchema>;
export type ListBaseConfigInput = z.infer<typeof listBaseConfigInputSchema>;
export type ListBaseConfigUpdate = z.infer<typeof listBaseConfigUpdateSchema>;

export type ListBaseCategory = z.infer<typeof listBaseCategorySchema>;
export type ListBaseCategoryInput = z.infer<typeof listBaseCategoryInputSchema>;
export type ListBaseCategoryUpdate = z.infer<typeof listBaseCategoryUpdateSchema>;

export type ListBaseItem = z.infer<typeof listBaseItemSchema>;
export type ListBaseItemInput = z.infer<typeof listBaseItemInputSchema>;
export type ListBaseItemUpdate = z.infer<typeof listBaseItemUpdateSchema>;

export type ListBasePendingUpdate = z.infer<typeof listBasePendingUpdateSchema>;
export type ListBaseWrapper = z.infer<typeof listBaseWrapperSchema>;

/**
 * ============================================================================
 * GENERIC CONSTRAINT FOR LIST TYPES
 * ============================================================================
 */
export type ListConstraint<TItem extends ListBaseItem> = {
  config: ListBaseConfig;
  categories: ListBaseCategory[];
  items: TItem[];
  pendingUpdates?: ListBasePendingUpdate[];
};

/**
 * Generic constraint for list types with optional categories
 * Used for modules that don't require categories (notes, vendors, key-people, photo-request)
 */
export type ListConstraintOptionalCategories<TItem extends ListBaseItem> = {
  config: ListBaseConfig;
  categories?: ListBaseCategory[];
  items: TItem[];
  pendingUpdates?: ListBasePendingUpdate[];
};
