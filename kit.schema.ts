/*---------------------------------------
File: src/domain/user/kit.schema.ts
Description: Kit list schemas - equipment and gear management
Author: Kyle Lovesy
Date: 03/11-2025
Version: 2.0.0
---------------------------------------*/
import { z } from 'zod';
import {
  listBaseConfigSchema,
  listBaseCategorySchema,
  listBaseCategoryInputSchema,
  listBaseCategoryUpdateSchema,
  listBaseItemSchema,
  listBaseItemInputSchema,
  listBasePendingUpdateSchema,
} from '@/domain/common/list-base.schema';
import { ListType } from '@/constants/enums';

/**
 * ============================================================================
 * KIT CONFIG SCHEMA
 * ============================================================================
 */
export const kitConfigSchema = listBaseConfigSchema.extend({
  type: z.literal(ListType.KIT),
});

export const kitConfigInputSchema = kitConfigSchema.omit({
  id: true,
  type: true,
  createdBy: true,
  lastModifiedBy: true,
  totalCategories: true,
  totalItems: true,
  createdAt: true,
  updatedAt: true,
});

export const kitConfigUpdateSchema = kitConfigInputSchema.partial();

/**
 * ============================================================================
 * KIT CATEGORY SCHEMA
 * ============================================================================
 */
export const kitCategorySchema = listBaseCategorySchema;
export const kitCategoryInputSchema = listBaseCategoryInputSchema;
export const kitCategoryUpdateSchema = listBaseCategoryUpdateSchema;

/**
 * ============================================================================
 * KIT ITEM SCHEMA
 * ============================================================================
 */
export const kitItemSchema = listBaseItemSchema.extend({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const kitItemInputSchema = listBaseItemInputSchema.extend({
  quantity: z.number().int().min(1, 'Quantity must be at least 1').optional(),
});

export const kitItemUpdateSchema = kitItemInputSchema.partial();

/**
 * ============================================================================
 * KIT PENDING UPDATE SCHEMA
 * ============================================================================
 */
export const kitPendingUpdateSchema = listBasePendingUpdateSchema;

/**
 * ============================================================================
 * KIT LIST WRAPPER SCHEMA
 * ============================================================================
 */
export const kitListSchema = z.object({
  config: kitConfigSchema,
  categories: z.array(kitCategorySchema).default([]),
  items: z.array(kitItemSchema).default([]),
  pendingUpdates: z.array(kitPendingUpdateSchema).optional().default([]),
});

/**
 * ============================================================================
 * TYPE EXPORTS
 * ============================================================================
 */
export type KitConfig = z.infer<typeof kitConfigSchema>;
export type KitConfigInput = z.infer<typeof kitConfigInputSchema>;
export type KitConfigUpdate = z.infer<typeof kitConfigUpdateSchema>;

export type KitCategory = z.infer<typeof kitCategorySchema>;
export type KitCategoryInput = z.infer<typeof kitCategoryInputSchema>;
export type KitCategoryUpdate = z.infer<typeof kitCategoryUpdateSchema>;

export type KitItem = z.infer<typeof kitItemSchema>;
export type KitItemInput = z.infer<typeof kitItemInputSchema>;
export type KitItemUpdate = z.infer<typeof kitItemUpdateSchema>;

export type KitPendingUpdate = z.infer<typeof kitPendingUpdateSchema>;
export type KitList = z.infer<typeof kitListSchema>;

/**
 * ============================================================================
 * DEFAULT VALUE FACTORY
 * ============================================================================
 */
export const defaultKitItem = (input: KitItemInput): Omit<KitItem, 'id'> => ({
  categoryId: undefined,
  itemName: input.itemName,
  itemDescription: input.itemDescription,
  quantity: input.quantity ?? 1, // Default applied here
  isCustom: false,
  isChecked: false,
  isDisabled: false,
});
