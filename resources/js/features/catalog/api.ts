import { apiClient } from '@/api/client';
import type {
    Brand,
    BrandPayload,
    CatalogEntityFilters,
    Category,
    CategoryPayload,
    Product,
    ProductFilters,
    ProductPayload,
} from '@/features/catalog/types';
import type { PaginatedResponse } from '@/types/pagination';

interface DataResponse<T> {
    data: T;
}

export async function listCategories(filters: CatalogEntityFilters): Promise<PaginatedResponse<Category>> {
    const response = await apiClient.get<PaginatedResponse<Category>>('/categories', { params: filters });
    return response.data;
}

export async function getCategory(id: number): Promise<Category> {
    const response = await apiClient.get<DataResponse<Category>>(`/categories/${id}`);
    return response.data.data;
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
    const response = await apiClient.post<DataResponse<Category>>('/categories', payload);
    return response.data.data;
}

export async function updateCategory(id: number, payload: CategoryPayload): Promise<Category> {
    const response = await apiClient.patch<DataResponse<Category>>(`/categories/${id}`, payload);
    return response.data.data;
}

export async function deleteCategory(id: number): Promise<void> {
    await apiClient.delete(`/categories/${id}`);
}

export async function listBrands(filters: CatalogEntityFilters): Promise<PaginatedResponse<Brand>> {
    const response = await apiClient.get<PaginatedResponse<Brand>>('/brands', { params: filters });
    return response.data;
}

export async function getBrand(id: number): Promise<Brand> {
    const response = await apiClient.get<DataResponse<Brand>>(`/brands/${id}`);
    return response.data.data;
}

export async function createBrand(payload: BrandPayload): Promise<Brand> {
    const response = await apiClient.post<DataResponse<Brand>>('/brands', payload);
    return response.data.data;
}

export async function updateBrand(id: number, payload: BrandPayload): Promise<Brand> {
    const response = await apiClient.patch<DataResponse<Brand>>(`/brands/${id}`, payload);
    return response.data.data;
}

export async function deleteBrand(id: number): Promise<void> {
    await apiClient.delete(`/brands/${id}`);
}

export async function listProducts(filters: ProductFilters): Promise<PaginatedResponse<Product>> {
    const response = await apiClient.get<PaginatedResponse<Product>>('/products', { params: filters });
    return response.data;
}

export async function getProduct(uuid: string): Promise<Product> {
    const response = await apiClient.get<DataResponse<Product>>(`/products/${uuid}`);
    return response.data.data;
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
    const response = await apiClient.post<DataResponse<Product>>('/products', payload);
    return response.data.data;
}

export async function updateProduct(uuid: string, payload: ProductPayload): Promise<Product> {
    const response = await apiClient.patch<DataResponse<Product>>(`/products/${uuid}`, payload);
    return response.data.data;
}

export async function deleteProduct(uuid: string): Promise<void> {
    await apiClient.delete(`/products/${uuid}`);
}
