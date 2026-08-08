import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import {
    createProduct,
    deleteProduct,
    getProduct,
    listBrands,
    listCategories,
    listProducts,
    updateProduct,
} from '@/features/catalog/api';
import type { Product, ProductFilters, ProductPayload } from '@/features/catalog/types';
import { Can } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

const inputClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export const productSchema = z.object({
    sku: z.string().trim().min(1, 'SKU is required.').max(100),
    name: z.string().trim().min(1, 'Product name is required.').max(255),
    slug: z.string().trim().max(255),
    description: z.string().max(5000),
    category_id: z.number().int().positive('Select a category.'),
    brand_id: z.number().int().positive('Select a brand.'),
    model: z.string().trim().min(1, 'Model is required.').max(255),
    default_warranty_months: z.number().int().min(0).max(120),
    serial_number_required: z.boolean(),
    active: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function ProductsPage() {
    const [filters, setFilters] = useState<ProductFilters>({ per_page: 10, sort: 'created_at', direction: 'desc' });
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const queryClient = useQueryClient();
    const productsQuery = useQuery({ queryKey: ['catalog', 'products', filters], queryFn: () => listProducts(filters) });
    const categoriesQuery = useQuery({ queryKey: ['catalog', 'categories', 'filters'], queryFn: () => listCategories({ per_page: 100, sort: 'name', direction: 'asc' }) });
    const brandsQuery = useQuery({ queryKey: ['catalog', 'brands', 'filters'], queryFn: () => listBrands({ per_page: 100, sort: 'name', direction: 'asc' }) });
    const deleteMutation = useMutation({
        mutationFn: deleteProduct,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
            setDeleteTarget(null);
        },
    });
    const updateFilters = (next: Partial<ProductFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

    const columns: DataTableColumn<Product>[] = [
        {
            id: 'product',
            header: 'Product',
            cell: (product) => <div><Link className="font-semibold text-slate-900 hover:text-blue-700" to={`/admin/products/${product.uuid}`}>{product.name}</Link><p className="mt-0.5 text-slate-500">{product.sku} · {product.model}</p></div>,
        },
        { id: 'category', header: 'Category', cell: (product) => <span className="text-slate-600">{product.category.name}</span> },
        { id: 'brand', header: 'Brand', cell: (product) => <span className="text-slate-600">{product.brand.name}</span> },
        { id: 'warranty', header: 'Warranty', cell: (product) => <span className="text-slate-600">{product.default_warranty_months} months</span> },
        { id: 'serial', header: 'Serial no.', cell: (product) => <span className="text-slate-600">{product.serial_number_required ? 'Required' : 'Optional'}</span> },
        { id: 'status', header: 'Status', cell: (product) => <StatusBadge value={product.active ? 'active' : 'inactive'} /> },
        {
            id: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (product) => <div className="flex justify-end gap-3"><Link className="font-medium text-blue-700" to={`/admin/products/${product.uuid}`}>View</Link><Can permission="products.update"><Link className="font-medium text-blue-700" to={`/admin/products/${product.uuid}/edit`}>Edit</Link></Can><Can permission="products.delete"><button className="font-medium text-rose-700" onClick={() => setDeleteTarget(product)}>Delete</button></Can></div>,
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader
                title="Products"
                description="Manage the catalog of serviceable products, warranty defaults, and serial-number requirements."
                action={<div className="flex flex-wrap gap-2"><Can permission="products.view"><Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" to="/admin/categories">Categories</Link></Can><Can permission="products.view"><Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" to="/admin/brands">Brands</Link></Can><Can permission="products.create"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm" to="/admin/products/new">Add product</Link></Can></div>}
            />

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                <input className={inputClassName} placeholder="Search SKU, product, model..." value={filters.search ?? ''} onChange={(event) => updateFilters({ search: event.target.value || undefined })} />
                <select className={inputClassName} value={filters.category_id ?? ''} onChange={(event) => updateFilters({ category_id: event.target.value === '' ? '' : Number(event.target.value) })}><option value="">All categories</option>{categoriesQuery.data?.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
                <select className={inputClassName} value={filters.brand_id ?? ''} onChange={(event) => updateFilters({ brand_id: event.target.value === '' ? '' : Number(event.target.value) })}><option value="">All brands</option>{brandsQuery.data?.data.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
                <select className={inputClassName} value={filters.active === '' || filters.active === undefined ? '' : String(filters.active)} onChange={(event) => updateFilters({ active: event.target.value === '' ? '' : event.target.value === 'true' })}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select>
            </div>

            {productsQuery.isLoading ? <p className="text-sm text-slate-600">Loading products...</p> : <><ErrorMessage error={productsQuery.error} /><DataTable rows={productsQuery.data?.data ?? []} columns={columns} getRowKey={(product) => product.uuid} emptyMessage="No products match these filters." />{productsQuery.data && <Pagination meta={productsQuery.data.meta} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />}</>}

            <ConfirmDialog open={deleteTarget !== null} title="Delete product" description={`Delete ${deleteTarget?.name ?? 'this product'}? Products referenced by purchases or warranties cannot be deleted.`} confirmLabel="Delete product" isPending={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.uuid)} />
        </section>
    );
}

export function ProductFormPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const isEditing = uuid !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const productQuery = useQuery({ queryKey: ['catalog', 'products', uuid], queryFn: () => getProduct(uuid ?? ''), enabled: isEditing });
    const categoriesQuery = useQuery({ queryKey: ['catalog', 'categories', 'options'], queryFn: () => listCategories({ per_page: 100, sort: 'name', direction: 'asc' }) });
    const brandsQuery = useQuery({ queryKey: ['catalog', 'brands', 'options'], queryFn: () => listBrands({ per_page: 100, sort: 'name', direction: 'asc' }) });
    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: { sku: '', name: '', slug: '', description: '', category_id: 0, brand_id: 0, model: '', default_warranty_months: 12, serial_number_required: true, active: true },
    });

    useEffect(() => {
        if (!productQuery.data) return;

        form.reset({
            sku: productQuery.data.sku,
            name: productQuery.data.name,
            slug: productQuery.data.slug,
            description: productQuery.data.description ?? '',
            category_id: productQuery.data.category_id,
            brand_id: productQuery.data.brand_id,
            model: productQuery.data.model,
            default_warranty_months: productQuery.data.default_warranty_months,
            serial_number_required: productQuery.data.serial_number_required,
            active: productQuery.data.active,
        });
    }, [form, productQuery.data]);

    const saveMutation = useMutation({
        mutationFn: (values: ProductFormValues) => {
            const payload: ProductPayload = {
                ...values,
                slug: values.slug || null,
                description: values.description || null,
            };

            return isEditing ? updateProduct(uuid ?? '', payload) : createProduct(payload);
        },
        onSuccess: (product) => {
            void queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
            navigate(`/admin/products/${product.uuid}`);
        },
    });

    if (isEditing && productQuery.isLoading) return <p className="text-sm text-slate-600">Loading product...</p>;
    if (isEditing && !productQuery.data && productQuery.error) return <ErrorMessage error={productQuery.error} />;

    const categories = categoriesQuery.data?.data ?? [];
    const brands = brandsQuery.data?.data ?? [];

    return (
        <section className="max-w-4xl space-y-6">
            <PageHeader title={isEditing ? 'Edit product' : 'Add product'} description="Set catalog identity, related category and brand, warranty defaults, and serial-number handling." />
            {categories.length === 0 || brands.length === 0 ? <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">Create at least one category and one brand before adding a product.</p> : null}
            <form className="space-y-6 rounded-xl border border-slate-200 bg-white p-6" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="SKU" error={form.formState.errors.sku?.message}><input className={inputClassName} placeholder="WASH-100" {...form.register('sku')} /></Field>
                    <Field label="Model" error={form.formState.errors.model?.message}><input className={inputClassName} {...form.register('model')} /></Field>
                    <Field label="Product name" error={form.formState.errors.name?.message}><input className={inputClassName} {...form.register('name')} /></Field>
                    <Field label="Slug" error={form.formState.errors.slug?.message}><input className={inputClassName} placeholder="auto-generated-if-empty" {...form.register('slug')} /></Field>
                    <Field label="Category" error={form.formState.errors.category_id?.message}><select className={inputClassName} value={form.watch('category_id')} onChange={(event) => form.setValue('category_id', Number(event.target.value), { shouldValidate: true })}><option value={0}>Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active ? '' : ' (inactive)'}</option>)}</select></Field>
                    <Field label="Brand" error={form.formState.errors.brand_id?.message}><select className={inputClassName} value={form.watch('brand_id')} onChange={(event) => form.setValue('brand_id', Number(event.target.value), { shouldValidate: true })}><option value={0}>Select a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.active ? '' : ' (inactive)'}</option>)}</select></Field>
                    <Field label="Default warranty (months)" error={form.formState.errors.default_warranty_months?.message}><input className={inputClassName} type="number" min="0" max="120" {...form.register('default_warranty_months', { valueAsNumber: true })} /></Field>
                    <div className="mt-7 flex flex-wrap items-center gap-5 text-sm font-medium text-slate-800"><label className="flex items-center gap-2"><input type="checkbox" checked={form.watch('serial_number_required')} onChange={(event) => form.setValue('serial_number_required', event.target.checked)} />Serial number required</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.watch('active')} onChange={(event) => form.setValue('active', event.target.checked)} />Active</label></div>
                </div>
                <Field label="Description" error={form.formState.errors.description?.message}><textarea className={inputClassName} rows={5} {...form.register('description')} /></Field>
                <ErrorMessage error={saveMutation.error} />
                <div className="flex justify-end gap-3"><Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" to={isEditing ? `/admin/products/${uuid}` : '/admin/products'}>Cancel</Link><button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saveMutation.isPending || categories.length === 0 || brands.length === 0}>{saveMutation.isPending ? 'Saving...' : 'Save product'}</button></div>
            </form>
        </section>
    );
}

export function ProductDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const productQuery = useQuery({ queryKey: ['catalog', 'products', uuid], queryFn: () => getProduct(uuid ?? ''), enabled: uuid !== undefined });
    const product = productQuery.data;

    if (productQuery.isLoading) return <p className="text-sm text-slate-600">Loading product...</p>;
    if (!product) return <ErrorMessage error={productQuery.error ?? new Error('Product not found.')} />;

    return (
        <section className="max-w-4xl space-y-6">
            <PageHeader title={product.name} description={`${product.sku} · ${product.model}`} action={<Can permission="products.update"><Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" to={`/admin/products/${product.uuid}/edit`}>Edit product</Link></Can>} />
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2 lg:grid-cols-3">
                <Detail label="Status" value={<StatusBadge value={product.active ? 'active' : 'inactive'} />} />
                <Detail label="Slug" value={`/${product.slug}`} />
                <Detail label="SKU" value={product.sku} />
                <Detail label="Model" value={product.model} />
                <Detail label="Category" value={product.category.name} />
                <Detail label="Brand" value={product.brand.name} />
                <Detail label="Default warranty" value={`${product.default_warranty_months} months`} />
                <Detail label="Serial number" value={product.serial_number_required ? 'Required' : 'Not required'} />
                <Detail label="Created" value={formatDate(product.created_at)} />
                <div className="md:col-span-2 lg:col-span-3"><Detail label="Description" value={<p className="whitespace-pre-wrap">{product.description ?? 'No description.'}</p>} /></div>
            </section>
        </section>
    );
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div>{action}</div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return <label className="block text-sm font-medium text-slate-800">{label}{children}{error && <span className="mt-1 block text-sm font-normal text-rose-700">{error}</span>}</label>;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-1 text-sm text-slate-800">{value}</div></div>;
}

function ErrorMessage({ error }: { error: unknown }) {
    return error instanceof Error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error.message}</p> : null;
}
