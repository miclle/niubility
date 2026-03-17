import client from './client'
import type { Category } from 'src/types/content'

// ListCategoriesResponse represents the response for listing categories.
interface ListCategoriesResponse {
  categories: Category[]
}

// CreateCategoryArgs represents the fields required to create a category.
export interface CreateCategoryArgs {
  name: string
  slug: string
  icon?: string
  sort_order?: number
}

// UpdateCategoryArgs represents the fields that can be updated for a category.
export interface UpdateCategoryArgs {
  name?: string
  slug?: string
  icon?: string
  visible?: boolean
  sort_order?: number
}

// ReorderItem represents a single item in a reorder request.
interface ReorderItem {
  id: string
  sort_order: number
}

// listCategories fetches visible categories (public).
export function listCategories() {
  return client.get<ListCategoriesResponse>('/categories')
}

// listAllCategories fetches all categories including hidden ones (admin only).
export function listAllCategories() {
  return client.get<ListCategoriesResponse>('/admin/categories')
}

// createCategory creates a new category (admin only).
export function createCategory(data: CreateCategoryArgs) {
  return client.post<Category>('/admin/categories', data)
}

// updateCategory updates an existing category (admin only).
export function updateCategory(id: string, data: UpdateCategoryArgs) {
  return client.put<Category>(`/admin/categories/${id}`, data)
}

// reorderCategories updates sort_order for multiple categories (admin only).
export function reorderCategories(items: ReorderItem[]) {
  return client.post<ListCategoriesResponse>('/admin/categories/reorder', { items })
}

// deleteCategory deletes a category by ID (admin only).
export function deleteCategory(id: string) {
  return client.delete(`/admin/categories/${id}`)
}
