import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiErrorAlert as ErrorMessage } from '@/components/ApiErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FormField } from '@/components/FormField';
import { PageHeader, SectionHeader } from '@/components/PageHeader';
import { TableSkeleton } from '@/components/PageStates';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

    useEffect(() => {
        if (showForm) form.setFocus('name');
    }, [form, showForm]);

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
                    <p className="font-semibold text-foreground">{entity.name}</p>
                    <p className="mt-0.5 text-muted-foreground">/{entity.slug}</p>
                </div>
            ),
        },
        {
            id: 'detail',
            header: isCategory ? 'Description' : 'Logo path',
            cell: (entity) => (
                <span
                    className="block max-w-md truncate text-muted-foreground"
                    title={isBrand(entity) ? (entity.logo_path ?? undefined) : (entity.description ?? undefined)}
                >
                    {isBrand(entity) ? (entity.logo_path ?? '—') : (entity.description ?? '—')}
                </span>
            ),
        },
        {
            id: 'products',
            header: 'Products',
            cell: (entity) => <span className="text-muted-foreground">{entity.products_count ?? 0}</span>,
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
                <div className="flex min-w-max justify-end gap-1">
                    <Can permission="products.update">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(entity)}>
                            <Pencil aria-hidden="true" />
                            Edit
                        </Button>
                    </Can>
                    <Can permission="products.delete">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(entity)}
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
                title={entityLabelPlural}
                description={
                    isCategory
                        ? 'Organize products into active catalog categories.'
                        : 'Manage product manufacturers and their optional logo paths.'
                }
                actions={
                    <Can permission="products.create">
                        <Button onClick={startCreate} aria-expanded={showForm} aria-controls={`${kind}-form-panel`}>
                            <Plus aria-hidden="true" />
                            Add {entityLabel.toLowerCase()}
                        </Button>
                    </Can>
                }
            />

            {showForm && (
                <Card
                    id={`${kind}-form-panel`}
                    role="region"
                    aria-label={`${editing === null ? 'Add' : 'Edit'} ${entityLabel.toLowerCase()}`}
                >
                    <CardContent className="pt-5 sm:pt-6">
                        <form className="space-y-5" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
                            <SectionHeader
                                title={editing === null ? `Add ${entityLabel.toLowerCase()}` : `Edit ${entityLabel.toLowerCase()}`}
                                description="Leave the slug blank to generate one from the name."
                            />
                            <div className="grid gap-5 sm:grid-cols-2">
                                <FormField required label="Name" error={form.formState.errors.name?.message}>
                                    <Input autoComplete="off" {...form.register('name')} />
                                </FormField>
                                <FormField
                                    label="Slug"
                                    hint="Used in readable URLs when supplied."
                                    error={form.formState.errors.slug?.message}
                                >
                                    <Input autoComplete="off" placeholder="auto-generated-if-empty" {...form.register('slug')} />
                                </FormField>
                                {isCategory ? (
                                    <FormField label="Description" error={form.formState.errors.description?.message}>
                                        <Textarea rows={3} {...form.register('description')} />
                                    </FormField>
                                ) : (
                                    <FormField
                                        label="Logo path"
                                        hint="Relative asset path or an absolute URL."
                                        error={form.formState.errors.logo_path?.message}
                                    >
                                        <Input autoComplete="off" placeholder="brands/example.svg" {...form.register('logo_path')} />
                                    </FormField>
                                )}
                                <label className="flex min-h-10 cursor-pointer items-center gap-3 self-end rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50">
                                    <input
                                        className="size-4 rounded border-input accent-primary"
                                        type="checkbox"
                                        checked={form.watch('active')}
                                        onChange={(event) => form.setValue('active', event.target.checked)}
                                    />
                                    Active in catalog
                                </label>
                            </div>
                            <ErrorMessage error={saveMutation.error} />
                            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditing(null);
                                        form.reset(defaultValues);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" className="w-full sm:w-auto" disabled={saveMutation.isPending}>
                                    {saveMutation.isPending ? 'Saving…' : `Save ${entityLabel.toLowerCase()}`}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 sm:pt-6 lg:grid-cols-3">
                    <FormField label={`Search ${entityLabelPlural.toLowerCase()}`}>
                        <Input
                            type="search"
                            placeholder={`Name or slug`}
                            value={filters.search ?? ''}
                            onChange={(event) => updateFilters({ search: event.target.value || undefined })}
                        />
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
                    <FormField label="Sort by" className="sm:col-span-2 lg:col-span-1">
                        <Select
                            value={filters.sort ?? 'name'}
                            onChange={(event) => updateFilters({ sort: event.target.value as NonNullable<CatalogEntityFilters['sort']> })}
                        >
                            <option value="name">Name</option>
                            <option value="created_at">Newest first</option>
                            <option value="active">Status</option>
                        </Select>
                    </FormField>
                </CardContent>
            </Card>

            {entitiesQuery.isLoading ? (
                <TableSkeleton columns={4} />
            ) : (
                <>
                    <ErrorMessage error={entitiesQuery.error} />
                    <DataTable
                        rows={entitiesQuery.data?.data ?? []}
                        columns={columns}
                        getRowKey={(entity) => entity.id}
                        emptyMessage={`No ${entityLabelPlural.toLowerCase()} match these filters.`}
                        emptyDescription="Try changing or clearing one of the filters above."
                        ariaLabel={`${entityLabelPlural} catalog table`}
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
