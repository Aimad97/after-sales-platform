import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert, PackagePlus, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { z } from 'zod';
import { AttachmentPanel } from '@/components/AttachmentPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { PageSkeleton, TableSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants, Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createProduct, deleteProduct, getProduct, listBrands, listCategories, listProducts, updateProduct } from '@/features/catalog/api';
import type { Product, ProductFilters, ProductPayload } from '@/features/catalog/types';
import { Can, usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

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
    const categoriesQuery = useQuery({
        queryKey: ['catalog', 'categories', 'filters'],
        queryFn: () => listCategories({ per_page: 100, sort: 'name', direction: 'asc' }),
    });
    const brandsQuery = useQuery({
        queryKey: ['catalog', 'brands', 'filters'],
        queryFn: () => listBrands({ per_page: 100, sort: 'name', direction: 'asc' }),
    });
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
            cell: (product) => (
                <div>
                    <Link
                        className="font-semibold text-foreground transition-colors hover:text-primary"
                        to={`/admin/products/${product.uuid}`}
                    >
                        {product.name}
                    </Link>
                    <p className="mt-0.5 text-muted-foreground">
                        {product.sku} · {product.model}
                    </p>
                </div>
            ),
        },
        { id: 'category', header: 'Category', cell: (product) => <span className="text-muted-foreground">{product.category.name}</span> },
        { id: 'brand', header: 'Brand', cell: (product) => <span className="text-muted-foreground">{product.brand.name}</span> },
        {
            id: 'warranty',
            header: 'Warranty',
            cell: (product) => <span className="text-muted-foreground">{product.default_warranty_months} months</span>,
        },
        {
            id: 'serial',
            header: 'Serial no.',
            cell: (product) => <span className="text-muted-foreground">{product.serial_number_required ? 'Required' : 'Optional'}</span>,
        },
        { id: 'status', header: 'Status', cell: (product) => <StatusBadge value={product.active ? 'active' : 'inactive'} /> },
        {
            id: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (product) => (
                <div className="flex min-w-max justify-end gap-1">
                    <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/products/${product.uuid}`}>
                        View
                    </Link>
                    <Can permission="products.update">
                        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to={`/admin/products/${product.uuid}/edit`}>
                            <Pencil aria-hidden="true" />
                            Edit
                        </Link>
                    </Can>
                    <Can permission="products.delete">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(product)}
                        >
                            <Trash2 aria-hidden="true" />
                            Delete
                        </Button>
                    </Can>
                </div>
            ),
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader
                eyebrow="Catalog"
                title="Products"
                description="Manage the catalog of serviceable products, warranty defaults, and serial-number requirements."
                actions={
                    <>
                        <Can permission="products.view">
                            <Link className={buttonVariants({ variant: 'outline' })} to="/admin/categories">
                                Categories
                            </Link>
                        </Can>
                        <Can permission="products.view">
                            <Link className={buttonVariants({ variant: 'outline' })} to="/admin/brands">
                                Brands
                            </Link>
                        </Can>
                        <Can permission="products.create">
                            <Link className={buttonVariants({ variant: 'default' })} to="/admin/products/new">
                                <PackagePlus aria-hidden="true" />
                                Add product
                            </Link>
                        </Can>
                    </>
                }
            />

            <Card>
                <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 sm:pt-6 xl:grid-cols-4">
                    <FormField label="Search products">
                        <Input
                            type="search"
                            placeholder="SKU, product, or model"
                            value={filters.search ?? ''}
                            onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                        />
                    </FormField>
                    <FormField label="Category">
                        <Select
                            value={filters.category_id ?? ''}
                            disabled={categoriesQuery.isLoading}
                            onChange={(event) =>
                                updateFilters({ category_id: event.target.value === '' ? '' : Number(event.target.value) })
                            }
                        >
                            <option value="">{categoriesQuery.isLoading ? 'Loading categories…' : 'All categories'}</option>
                            {categoriesQuery.data?.data.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label="Brand">
                        <Select
                            value={filters.brand_id ?? ''}
                            disabled={brandsQuery.isLoading}
                            onChange={(event) => updateFilters({ brand_id: event.target.value === '' ? '' : Number(event.target.value) })}
                        >
                            <option value="">{brandsQuery.isLoading ? 'Loading brands…' : 'All brands'}</option>
                            {brandsQuery.data?.data.map((brand) => (
                                <option key={brand.id} value={brand.id}>
                                    {brand.name}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label="Status">
                        <Select
                            value={filters.active === '' || filters.active === undefined ? '' : String(filters.active)}
                            onChange={(event) => updateFilters({ active: event.target.value === '' ? '' : event.target.value === 'true' })}
                        >
                            <option value="">All statuses</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </Select>
                    </FormField>
                </CardContent>
            </Card>
            <ErrorMessage error={categoriesQuery.error ?? brandsQuery.error} />

            {productsQuery.isLoading ? (
                <TableSkeleton columns={7} />
            ) : (
                <>
                    <ErrorMessage error={productsQuery.error} />
                    <DataTable
                        rows={productsQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(product) => product.uuid}
                        emptyMessage="No products match these filters."
                        emptyDescription="Try changing or clearing one of the filters above."
                        ariaLabel="Product catalog"
                    />
                    {productsQuery.data && (
                        <Pagination
                            meta={productsQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete product"
                description={`Delete ${
                    deleteTarget?.name ?? 'this product'
                }? Products referenced by purchases or warranties cannot be deleted.`}
                confirmLabel="Delete product"
                isPending={deleteMutation.isPending}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.uuid)}
            />
        </section>
    );
}

export function ProductFormPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const isEditing = uuid !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const productQuery = useQuery({ queryKey: ['catalog', 'products', uuid], queryFn: () => getProduct(uuid ?? ''), enabled: isEditing });
    const categoriesQuery = useQuery({
        queryKey: ['catalog', 'categories', 'options'],
        queryFn: () => listCategories({ per_page: 100, sort: 'name', direction: 'asc' }),
    });
    const brandsQuery = useQuery({
        queryKey: ['catalog', 'brands', 'options'],
        queryFn: () => listBrands({ per_page: 100, sort: 'name', direction: 'asc' }),
    });
    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            sku: '',
            name: '',
            slug: '',
            description: '',
            category_id: 0,
            brand_id: 0,
            model: '',
            default_warranty_months: 12,
            serial_number_required: true,
            active: true,
        },
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

    if (isEditing && productQuery.isLoading) return <PageSkeleton />;
    if (isEditing && !productQuery.data && productQuery.error) return <ErrorMessage error={productQuery.error} />;

    const categories = categoriesQuery.data?.data ?? [];
    const brands = brandsQuery.data?.data ?? [];
    const optionListsLoading = categoriesQuery.isLoading || brandsQuery.isLoading;
    const optionListsError = categoriesQuery.error ?? brandsQuery.error;
    const hasRequiredOptions = categories.length > 0 && brands.length > 0;

    return (
        <section className="max-w-4xl space-y-6">
            <PageHeader
                eyebrow="Catalog"
                title={isEditing ? 'Edit product' : 'Add product'}
                description="Set catalog identity, related category and brand, warranty defaults, and serial-number handling."
                actions={
                    <Link className={buttonVariants({ variant: 'outline' })} to={isEditing ? `/admin/products/${uuid}` : '/admin/products'}>
                        <ArrowLeft aria-hidden="true" />
                        Back
                    </Link>
                }
            />
            <ErrorMessage error={optionListsError} />
            {!optionListsLoading && !optionListsError && !hasRequiredOptions ? (
                <Alert
                    className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100"
                    role="status"
                >
                    <CircleAlert className="text-amber-700 dark:text-amber-400" aria-hidden="true" />
                    <div>
                        <AlertTitle>Catalog setup required</AlertTitle>
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                            Create at least one category and one brand before adding a product.
                        </AlertDescription>
                    </div>
                </Alert>
            ) : null}
            <Card>
                <CardContent className="pt-5 sm:pt-6">
                    <form className="space-y-6" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField required label="SKU" error={form.formState.errors.sku?.message}>
                                <Input placeholder="WASH-100" autoComplete="off" {...form.register('sku')} />
                            </FormField>
                            <FormField required label="Model" error={form.formState.errors.model?.message}>
                                <Input autoComplete="off" {...form.register('model')} />
                            </FormField>
                            <FormField required label="Product name" error={form.formState.errors.name?.message}>
                                <Input autoComplete="off" {...form.register('name')} />
                            </FormField>
                            <FormField
                                label="Slug"
                                hint="Leave blank to generate the URL slug automatically."
                                error={form.formState.errors.slug?.message}
                            >
                                <Input placeholder="auto-generated-if-empty" autoComplete="off" {...form.register('slug')} />
                            </FormField>
                            <FormField required label="Category" error={form.formState.errors.category_id?.message}>
                                <Select
                                    value={form.watch('category_id')}
                                    disabled={optionListsLoading}
                                    onChange={(event) => form.setValue('category_id', Number(event.target.value), { shouldValidate: true })}
                                >
                                    <option value={0}>{optionListsLoading ? 'Loading categories…' : 'Select a category'}</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                            {category.active ? '' : ' (inactive)'}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <FormField required label="Brand" error={form.formState.errors.brand_id?.message}>
                                <Select
                                    value={form.watch('brand_id')}
                                    disabled={optionListsLoading}
                                    onChange={(event) => form.setValue('brand_id', Number(event.target.value), { shouldValidate: true })}
                                >
                                    <option value={0}>{optionListsLoading ? 'Loading brands…' : 'Select a brand'}</option>
                                    {brands.map((brand) => (
                                        <option key={brand.id} value={brand.id}>
                                            {brand.name}
                                            {brand.active ? '' : ' (inactive)'}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <FormField
                                required
                                label="Default warranty (months)"
                                error={form.formState.errors.default_warranty_months?.message}
                            >
                                <Input
                                    type="number"
                                    min="0"
                                    max="120"
                                    inputMode="numeric"
                                    {...form.register('default_warranty_months', { valueAsNumber: true })}
                                />
                            </FormField>
                            <fieldset className="space-y-3 sm:self-end">
                                <legend className="sr-only">Product settings</legend>
                                <label
                                    className={cn(
                                        'flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-border px-3',
                                        'text-sm font-medium text-foreground transition-colors hover:bg-muted/50',
                                    )}
                                >
                                    <input
                                        className="size-4 rounded border-input accent-primary"
                                        type="checkbox"
                                        checked={form.watch('serial_number_required')}
                                        onChange={(event) => form.setValue('serial_number_required', event.target.checked)}
                                    />
                                    Serial number required
                                </label>
                                <label
                                    className={cn(
                                        'flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-border px-3',
                                        'text-sm font-medium text-foreground transition-colors hover:bg-muted/50',
                                    )}
                                >
                                    <input
                                        className="size-4 rounded border-input accent-primary"
                                        type="checkbox"
                                        checked={form.watch('active')}
                                        onChange={(event) => form.setValue('active', event.target.checked)}
                                    />
                                    Active in catalog
                                </label>
                            </fieldset>
                        </div>
                        <FormField label="Description" error={form.formState.errors.description?.message}>
                            <Textarea rows={5} {...form.register('description')} />
                        </FormField>
                        <ErrorMessage error={saveMutation.error} />
                        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                            <Link
                                className={cn(buttonVariants({ variant: 'outline' }), 'w-full sm:w-auto')}
                                to={isEditing ? `/admin/products/${uuid}` : '/admin/products'}
                            >
                                Cancel
                            </Link>
                            <Button
                                type="submit"
                                className="w-full sm:w-auto"
                                disabled={saveMutation.isPending || optionListsLoading || !hasRequiredOptions}
                            >
                                {saveMutation.isPending ? 'Saving…' : 'Save product'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </section>
    );
}

export function ProductDetailsPage() {
    const { uuid } = useParams<{ uuid: string }>();
    const { can } = usePermissions();
    const productQuery = useQuery({
        queryKey: ['catalog', 'products', uuid],
        queryFn: () => getProduct(uuid ?? ''),
        enabled: uuid !== undefined,
    });
    const product = productQuery.data;

    if (productQuery.isLoading) return <PageSkeleton />;
    if (!product) return <ErrorMessage error={productQuery.error ?? new Error('Product not found.')} />;

    return (
        <section className="max-w-4xl space-y-6">
            <PageHeader
                eyebrow="Product details"
                title={product.name}
                description={`${product.sku} · ${product.model}`}
                actions={
                    <>
                        <Link className={buttonVariants({ variant: 'outline' })} to="/admin/products">
                            <ArrowLeft aria-hidden="true" />
                            Products
                        </Link>
                        <Can permission="products.update">
                            <Link className={buttonVariants({ variant: 'default' })} to={`/admin/products/${product.uuid}/edit`}>
                                <Pencil aria-hidden="true" />
                                Edit product
                            </Link>
                        </Can>
                    </>
                }
            />
            <AttachmentPanel
                resourceType="products"
                resourceKey={product.uuid}
                canUpload={can('products.update')}
                canDelete={can('products.update')}
            />
            <Card>
                <CardContent className="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2 sm:pt-6 lg:grid-cols-3">
                    <Detail label="Status" value={<StatusBadge value={product.active ? 'active' : 'inactive'} />} />
                    <Detail label="Slug" value={`/${product.slug}`} />
                    <Detail label="SKU" value={product.sku} />
                    <Detail label="Model" value={product.model} />
                    <Detail label="Category" value={product.category.name} />
                    <Detail label="Brand" value={product.brand.name} />
                    <Detail label="Default warranty" value={`${product.default_warranty_months} months`} />
                    <Detail label="Serial number" value={product.serial_number_required ? 'Required' : 'Not required'} />
                    <Detail label="Created" value={formatDate(product.created_at)} />
                    <div className="border-t border-border pt-5 sm:col-span-2 lg:col-span-3">
                        <Detail
                            label="Description"
                            value={<p className="whitespace-pre-wrap">{product.description ?? 'No description.'}</p>}
                        />
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1.5 break-words text-sm text-card-foreground">{value}</div>
        </div>
    );
}
