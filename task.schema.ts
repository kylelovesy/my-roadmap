/*---------------------------------------
File: src/domain/user/task.schema.ts
Description: Task list schemas - project task management
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
  listBaseItemUpdateSchema,
  listBasePendingUpdateSchema,
} from '@/domain/common/list-base.schema';
import { ListType } from '@/constants/enums';

/**
 * ============================================================================
 * TASK CONFIG SCHEMA
 * ============================================================================
 */
export const taskConfigSchema = listBaseConfigSchema.extend({
  type: z.literal(ListType.TASKS),
});

export const taskConfigInputSchema = taskConfigSchema.omit({
  id: true,
  type: true,
  createdBy: true,
  lastModifiedBy: true,
  totalCategories: true,
  totalItems: true,
  createdAt: true,
  updatedAt: true,
});

export const taskConfigUpdateSchema = taskConfigInputSchema.partial();

/**
 * ============================================================================
 * TASK CATEGORY SCHEMA
 * ============================================================================
 */
export const taskCategorySchema = listBaseCategorySchema;
export const taskCategoryInputSchema = listBaseCategoryInputSchema;
export const taskCategoryUpdateSchema = listBaseCategoryUpdateSchema;

/**
 * ============================================================================
 * TASK ITEM SCHEMA
 * ============================================================================
 */
export const taskItemSchema = listBaseItemSchema;
export const taskItemInputSchema = listBaseItemInputSchema;
export const taskItemUpdateSchema = listBaseItemUpdateSchema;

/**
 * ============================================================================
 * TASK PENDING UPDATE SCHEMA
 * ============================================================================
 */
export const taskPendingUpdateSchema = listBasePendingUpdateSchema;

/**
 * ============================================================================
 * TASK LIST WRAPPER SCHEMA
 * ============================================================================
 */
export const taskListSchema = z.object({
  config: taskConfigSchema,
  categories: z.array(taskCategorySchema).default([]),
  items: z.array(taskItemSchema).default([]),
  pendingUpdates: z.array(taskPendingUpdateSchema).optional().default([]),
});

/**
 * ============================================================================
 * TYPE EXPORTS
 * ============================================================================
 */
export type TaskConfig = z.infer<typeof taskConfigSchema>;
export type TaskConfigInput = z.infer<typeof taskConfigInputSchema>;
export type TaskConfigUpdate = z.infer<typeof taskConfigUpdateSchema>;

export type TaskCategory = z.infer<typeof taskCategorySchema>;
export type TaskCategoryInput = z.infer<typeof taskCategoryInputSchema>;
export type TaskCategoryUpdate = z.infer<typeof taskCategoryUpdateSchema>;

export type TaskItem = z.infer<typeof taskItemSchema>;
export type TaskItemInput = z.infer<typeof taskItemInputSchema>;
export type TaskItemUpdate = z.infer<typeof taskItemUpdateSchema>;

export type TaskPendingUpdate = z.infer<typeof taskPendingUpdateSchema>;
export type TaskList = z.infer<typeof taskListSchema>;
