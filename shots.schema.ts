/*---------------------------------------
File: src/domain/user/shots.schema.ts
Description: Photo shots schemas - couple and group shot management
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
import { idSchema, optionalTimestampSchema } from '@/domain/common/shared-schemas';
import { ListType, SectionStatus, ActionOn } from '@/constants/enums';
import { DEFAULTS } from '@/constants/defaults';

/**
 * ============================================================================
 * BASE SHOT CONFIG SCHEMA (shared between couple and group shots)
 * ============================================================================
 */
const shotConfigBaseSchema = listBaseConfigSchema.extend({
  status: z.nativeEnum(SectionStatus).default(SectionStatus.UNLOCKED),
  actionOn: z.nativeEnum(ActionOn).default(ActionOn.PHOTOGRAPHER),
  clientLastViewed: optionalTimestampSchema.optional(),
  finalized: z.boolean().default(DEFAULTS.DISABLED),
  totalTimeEstimated: z.number().int().min(0).default(0),
  clientItemIds: z.array(idSchema).default([]),
});

/**
 * ============================================================================
 * COUPLE SHOT CONFIG SCHEMA
 * ============================================================================
 */
export const coupleShotConfigSchema = shotConfigBaseSchema.extend({
  type: z.literal(ListType.COUPLE_SHOTS),
});

export const coupleShotConfigInputSchema = coupleShotConfigSchema.omit({
  id: true,
  type: true,
  source: true,
  status: true,
  actionOn: true,
  createdBy: true,
  lastModifiedBy: true,
  totalCategories: true,
  totalItems: true,
  createdAt: true,
  updatedAt: true,
});

export const coupleShotConfigUpdateSchema = coupleShotConfigInputSchema.partial();

/**
 * ============================================================================
 * COUPLE SHOT CATEGORY SCHEMA
 * ============================================================================
 */
export const coupleShotCategorySchema = listBaseCategorySchema;
export const coupleShotCategoryInputSchema = listBaseCategoryInputSchema;
export const coupleShotCategoryUpdateSchema = listBaseCategoryUpdateSchema;

/**
 * ============================================================================
 * COUPLE SHOT ITEM SCHEMA
 * ============================================================================
 */
export const coupleShotItemSchema = listBaseItemSchema.extend({
  clientSelected: z.boolean(),
  time: z.number().int().min(0),
});

export const coupleShotItemInputSchema = listBaseItemInputSchema.extend({
  clientSelected: z.boolean().optional(),
  time: z.number().int().min(0).optional(),
});

export const coupleShotItemUpdateSchema = coupleShotItemInputSchema.partial();

/**
 * ============================================================================
 * COUPLE SHOT LIST WRAPPER SCHEMA
 * ============================================================================
 */
export const coupleShotListSchema = z.object({
  config: coupleShotConfigSchema,
  categories: z.array(coupleShotCategorySchema).default([]),
  items: z.array(coupleShotItemSchema).default([]),
  pendingUpdates: z.array(listBasePendingUpdateSchema).optional().default([]),
});

/**
 * ============================================================================
 * GROUP SHOT CONFIG SCHEMA
 * ============================================================================
 */
export const groupShotConfigSchema = shotConfigBaseSchema.extend({
  type: z.literal(ListType.GROUP_SHOTS),
});

export const groupShotConfigInputSchema = groupShotConfigSchema.omit({
  id: true,
  type: true,
  createdBy: true,
  lastModifiedBy: true,
  totalCategories: true,
  totalItems: true,
  createdAt: true,
  updatedAt: true,
});

export const groupShotConfigUpdateSchema = groupShotConfigInputSchema.partial();

/**
 * ============================================================================
 * GROUP SHOT CATEGORY SCHEMA
 * ============================================================================
 */
export const groupShotCategorySchema = listBaseCategorySchema;
export const groupShotCategoryInputSchema = listBaseCategoryInputSchema;
export const groupShotCategoryUpdateSchema = listBaseCategoryUpdateSchema;

/**
 * ============================================================================
 * GROUP SHOT ITEM SCHEMA
 * ============================================================================
 */
export const groupShotItemSchema = listBaseItemSchema.extend({
  clientSelected: z.boolean(),
  time: z.number().int().min(0),
});

export const groupShotItemInputSchema = listBaseItemInputSchema.extend({
  clientSelected: z.boolean().optional(),
  time: z.number().int().min(0).optional(),
});

export const groupShotItemUpdateSchema = groupShotItemInputSchema.partial();

/**
 * ============================================================================
 * GROUP SHOT LIST WRAPPER SCHEMA
 * ============================================================================
 */
export const groupShotListSchema = z.object({
  config: groupShotConfigSchema,
  categories: z.array(groupShotCategorySchema).default([]),
  items: z.array(groupShotItemSchema).default([]),
  pendingUpdates: z.array(listBasePendingUpdateSchema).optional().default([]),
});

/**
 * ============================================================================
 * TYPE EXPORTS - COUPLE SHOTS
 * ============================================================================
 */
export type CoupleShotConfig = z.infer<typeof coupleShotConfigSchema>;
export type CoupleShotConfigInput = z.infer<typeof coupleShotConfigInputSchema>;
export type CoupleShotConfigUpdate = z.infer<typeof coupleShotConfigUpdateSchema>;

export type CoupleShotCategory = z.infer<typeof coupleShotCategorySchema>;
export type CoupleShotCategoryInput = z.infer<typeof coupleShotCategoryInputSchema>;
export type CoupleShotCategoryUpdate = z.infer<typeof coupleShotCategoryUpdateSchema>;

export type CoupleShotItem = z.infer<typeof coupleShotItemSchema>;
export type CoupleShotItemInput = z.infer<typeof coupleShotItemInputSchema>;
export type CoupleShotItemUpdate = z.infer<typeof coupleShotItemUpdateSchema>;

export type CoupleShotPendingUpdate = z.infer<typeof listBasePendingUpdateSchema>;
export type CoupleShotList = z.infer<typeof coupleShotListSchema>;

/**
 * ============================================================================
 * TYPE EXPORTS - GROUP SHOTS
 * ============================================================================
 */
export type GroupShotConfig = z.infer<typeof groupShotConfigSchema>;
export type GroupShotConfigInput = z.infer<typeof groupShotConfigInputSchema>;
export type GroupShotConfigUpdate = z.infer<typeof groupShotConfigUpdateSchema>;

export type GroupShotCategory = z.infer<typeof groupShotCategorySchema>;
export type GroupShotCategoryInput = z.infer<typeof groupShotCategoryInputSchema>;
export type GroupShotCategoryUpdate = z.infer<typeof groupShotCategoryUpdateSchema>;

export type GroupShotItem = z.infer<typeof groupShotItemSchema>;
export type GroupShotItemInput = z.infer<typeof groupShotItemInputSchema>;
export type GroupShotItemUpdate = z.infer<typeof groupShotItemUpdateSchema>;

export type GroupShotPendingUpdate = z.infer<typeof listBasePendingUpdateSchema>;
export type GroupShotList = z.infer<typeof groupShotListSchema>;

/**
 * ============================================================================
 * DEFAULT VALUE FACTORIES
 * ============================================================================
 */
export const defaultCoupleShotItem = (input: CoupleShotItemInput): Omit<CoupleShotItem, 'id'> => ({
  categoryId: undefined,
  itemName: input.itemName,
  itemDescription: input.itemDescription,
  clientSelected: input.clientSelected ?? false,
  time: input.time ?? 0,
  isCustom: false,
  isChecked: false,
  isDisabled: false,
});

export const defaultGroupShotItem = (input: GroupShotItemInput): Omit<GroupShotItem, 'id'> => ({
  categoryId: undefined,
  itemName: input.itemName,
  itemDescription: input.itemDescription,
  clientSelected: input.clientSelected ?? false,
  time: input.time ?? 0,
  isCustom: false,
  isChecked: false,
  isDisabled: false,
});
