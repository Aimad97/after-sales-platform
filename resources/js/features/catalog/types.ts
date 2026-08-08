export interface Category {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    active: boolean;
    products_count?: number;
    created_at: string | null;
    updated_at: string | null;
}

export interface Brand {
    id: number;
    name: string;
    slug: string;
    logo_path: string | null;
    active: boolean;
    products_count?: number;
    created_at: string | null;
    updated_at: string | null;
}

export interface ProductCategorySummary {
    id: number;
    name: string;
    slug: string;
    active: boolean;
}

export interface ProductBrandSummary {
    id: number;
    name: string;
    slug: string;
    logo_path: string | null;
    active: boolean;
}

export interface Product {
    id: number;
    uuid: string;
    sku: string;
    name: string;
    slug: string;
    description: string | null;
    category_id: number;
    brand_id: number;
    model: string;
    default_warranty_months: number;
    serial_number_required: boolean;
    active: boolean;
    category: ProductCategorySummary;
    brand: ProductBrandSummary;
    created_at: string | null;
    updated_at: string | null;
}

export interface CatalogEntityFilters {
    search?: string;
    active?: boolean | '';
    sort?: 'name' | 'slug' | 'active' | 'created_at';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface ProductFilters {
    search?: string;
    category_id?: number | '';
    brand_id?: number | '';
    active?: boolean | '';
    sort?: 'sku' | 'name' | 'slug' | 'model' | 'default_warranty_months' | 'active' | 'created_at';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface CategoryPayload {
    name: string;
    slug: string | null;
    description: string | null;
    active: boolean;
}

export interface BrandPayload {
    name: string;
    slug: string | null;
    logo_path: string | null;
    active: boolean;
}

export interface ProductPayload {
    sku: string;
    name: string;
    slug: string | null;
    description: string | null;
    category_id: number;
    brand_id: number;
    model: string;
    default_warranty_months: number;
    serial_number_required: boolean;
    active: boolean;
}
