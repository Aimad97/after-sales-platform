import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import {
    createBrand,
    createCategory,
    deleteBrand,
    deleteCategory,
    listBrands,
    listCategories,
    updateBrand,
    updateCategory,
} from '@/features/catalog/api';
import type { Brand, BrandPayload, CatalogEntityFilters, Category, CategoryPayload } from '@/features/catalog/types';
import { Can } from '@/hooks/usePermissions';
import type { PaginatedResponse } from '@/types/pagination';

const inputClassName =
    'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const entitySchema = z.object({
    name: z.string().trim().min(1, 'Name is required.').max(255),
    slug: z.string().trim().max(255),
    description: z.string().max(5000),
    logo_path: z.string().trim().max(2048),
    active: z.boolean(),
});

type EntityFormValues = z.infer<typeof entitySchema>;
type CatalogEntity = Category | Brand;
type EntityKind = 'category' | 'brand';

const defaultValues: EntityFormValues = {
    name: '',
    slug: '',
    description: '',
    logo_path: '',
    active: true,
};

function isBrand(entity: CatalogEntity): entity is Brand {
    return 'logo_path' in entity;
}

export function CategoriesPage() {
    return <CatalogEntityManagementPage kind="category" />;
}

export function BrandsPage() {
    return <CatalogEntityManagementPage kind="brand" />;
}

function CatalogEntityManagementPage({ kind }: { kind: EntityKind }) {
    const [filters, setFilters] = useState<CatalogEntityFilters>({ per_page: 10, sort: 'name', direction: 'asc' });
    const [editing, setEditing] = useState<CatalogEntity | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<CatalogEntity | null>(null);
    const queryClient = useQueryClient();
    const isCategory = kind === 'category';
    const entityLabel = isCategory ? 'Category' : 'Brand';
    const entityLabelPlural = isCategory ? 'Categories' : 'Brands';
    const form = useForm<EntityFormValues>({ resolver: zodResolver(entitySchema), defaultValues });
    const entitiesQuery = useQuery({
        queryKey: ['catalog', kind, filters],
        queryFn: async (): Promise<PaginatedResponse<CatalogEntity>> => {
            return isCategory ? listCategories(filters) : listBrands(filters);
        },
    });

    const saveMutation = useMutation({
        mutationFn: (values: EntityFormValues): Promise<CatalogEntity> => {
            if (isCategory) {
                const payload: CategoryPayload = {
                    name: values.name,
                    slug: values.slug || null,
                    description: values.description || null,
                    active: values.active,
                };

                return editing === null ? createCategory(payload) : updateCategory(editing.id, payload);
            }

            const payload: BrandPayload = {
                name: values.name,
                slug: values.slug || null,
                logo_path: values.logo_path || null,
                active: values.active,
            };

            return editing === null ? createBrand(payload) : updateBrand(editing.id, payload);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['catalog'] });
            setEditing(null);
            setShowForm(false);
            form.reset(defaultValues);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (entity: CatalogEntity): Promise<void> => (isCategory ? deleteCategory(entity.id) : deleteBrand(entity.id)),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['catalog'] });
            setDeleteTarget(null);
        },
    });

    const updateFilters = (next: Partial<CatalogEntityFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));
    const startCreate = () => {
        setEditing(null);
        form.reset(defaultValues);
        setShowForm(true);
    };
    const startEdit = (entity: CatalogEntity) => {
        setEditing(entity);
        form.reset({
            name: entity.name,
            slug: entity.slug,
            description: isBrand(entity) ? '' : (entity.description ?? ''),
            logo_path: isBrand(entity) ? (entity.logo_path ?? '') : '',
            active: entity.active,
        });
        setShowForm(true);
    };

    const columns: DataTableColumn<CatalogEntity>[] = [
        {
            id: 'name',
            header: entityLabel,
            cell: (entity) => (
                <div>
                    <p className="font-semibold text-slate-900">{entity.name}</p>
                    <p className="mt-0.5 text-slate-500">/{entity.slug}</p>
                </div>
            ),
        },
        {
            id: 'detail',
            header: isCategory ? 'Description' : 'Logo path',
            cell: (entity) => (
                <span className="text-slate-600">{isBrand(entity) ? (entity.logo_path ?? '—') : (entity.description ?? '—')}</span>
            ),
        },
        {
            id: 'products',
            header: 'Products',
            cell: (entity) => <span className="text-slate-600">{entity.products_count ?? 0}</span>,
        },
        {
            id: 'status',
            header: 'Status',
            cell: (entity) => <StatusBadge value={entity.active ? 'active' : 'inactive'} />,
        },
        {
            id: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            cellClassName: 'text-right',
            cell: (entity) => (
                <div className="flex justify-end gap-3">
                    <Can permission="products.update">
                        <button className="font-medium text-blue-700" onClick={() => startEdit(entity)}>
                            Edit
                        </button>
                    </Can>
                    <Can permission="products.delete">
                        <button className="font-medium text-rose-700" onClick={() => setDeleteTarget(entity)}>
                            Delete
                        </button>
                    </Can>
                </div>
            ),
        },
    ];

    return (
        <section className="space-y-6">
            <PageHeader
                title={entityLabelPlural}
                description={
                    isCategory
                        ? 'Organize products into active catalog categories.'
                        : 'Manage product manufacturers and their optional logo paths.'
                }
                action={
                    <Can permission="products.create">
                        <button
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                            onClick={startCreate}
                        >
                            Add {entityLabel.toLowerCase()}
                        </button>
                    </Can>
                }
            />

            {showForm && (
                <form
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">
                                {editing === null ? `Add ${entityLabel.toLowerCase()}` : `Edit ${entityLabel.toLowerCase()}`}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">Leave the slug blank to generate one from the name.</p>
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Name" error={form.formState.errors.name?.message}>
                            <input className={inputClassName} {...form.register('name')} />
                        </Field>
                        <Field label="Slug" error={form.formState.errors.slug?.message}>
                            <input className={inputClassName} placeholder="auto-generated-if-empty" {...form.register('slug')} />
                        </Field>
                        {isCategory ? (
                            <Field label="Description" error={form.formState.errors.description?.message}>
                                <textarea className={inputClassName} rows={3} {...form.register('description')} />
                            </Field>
                        ) : (
                            <Field label="Logo path" error={form.formState.errors.logo_path?.message}>
                                <input className={inputClassName} placeholder="brands/example.svg" {...form.register('logo_path')} />
                            </Field>
                        )}
                        <label className="mt-7 flex items-center gap-2 text-sm font-medium text-slate-800">
                            <input
                                type="checkbox"
                                checked={form.watch('active')}
                                onChange={(event) => form.setValue('active', event.target.checked)}
                            />
                            Active
                        </label>
                    </div>
                    <ErrorMessage error={saveMutation.error} />
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                            onClick={() => {
                                setShowForm(false);
                                setEditing(null);
                                form.reset(defaultValues);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? 'Saving...' : `Save ${entityLabel.toLowerCase()}`}
                        </button>
                    </div>
                </form>
            )}

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                <input
                    className={inputClassName}
                    placeholder={`Search ${entityLabelPlural.toLowerCase()}...`}
                    value={filters.search ?? ''}
                    onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                />
                <select
                    className={inputClassName}
                    value={filters.active === '' || filters.active === undefined ? '' : String(filters.active)}
                    onChange={(event) => updateFilters({ active: event.target.value === '' ? '' : event.target.value === 'true' })}
                >
                    <option value="">All statuses</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
                <select
                    className={inputClassName}
                    value={filters.sort ?? 'name'}
                    onChange={(event) => updateFilters({ sort: event.target.value as NonNullable<CatalogEntityFilters['sort']> })}
                >
                    <option value="name">Name</option>
                    <option value="created_at">Newest first</option>
                    <option value="active">Status</option>
                </select>
            </div>

            {entitiesQuery.isLoading ? (
                <p className="text-sm text-slate-600">Loading {entityLabelPlural.toLowerCase()}...</p>
            ) : (
                <>
                    <ErrorMessage error={entitiesQuery.error} />
                    <DataTable
                        rows={entitiesQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(entity) => entity.id}
                        emptyMessage={`No ${entityLabelPlural.toLowerCase()} match these filters.`}
                    />
                    {entitiesQuery.data && (
                        <Pagination
                            meta={entitiesQuery.data.meta}
                            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
                        />
                    )}
                </>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title={`Delete ${entityLabel.toLowerCase()}`}
                description={`Delete ${deleteTarget?.name ?? 'this record'}? Catalog records that are in use cannot be deleted.`}
                confirmLabel={`Delete ${entityLabel.toLowerCase()}`}
                isPending={deleteMutation.isPending}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            />
        </section>
    );
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
            </div>
            {action}
        </div>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <label className="block text-sm font-medium text-slate-800">
            {label}
            {children}
            {error && <span className="mt-1 block text-sm font-normal text-rose-700">{error}</span>}
        </label>
    );
}
